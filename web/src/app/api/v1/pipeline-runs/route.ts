import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  getBearerToken,
  getPgPool,
  normalizeStatus,
  optionalString,
  parseTimestamp,
  requireString,
  tokenFingerprint,
  verifyInstallationToken,
} from "@/lib/insights-saas-db";
import { writeMetaPipelineRun } from "@/lib/meta-ingest";

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(`v1:pipeline-runs:${clientIp}`);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } },
    );
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing Bearer token" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const installationId = requireString(body.installation_id, "installation_id");
    const authorized = await verifyInstallationToken(installationId, token);
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized installation/token" }, { status: 401 });
    }

    const timestampUtc = parseTimestamp(body.timestamp_utc);
    const datasetId = requireString(body.dataset_id, "dataset_id");
    const runId = requireString(body.run_id, "run_id");
    const step = requireString(body.step, "step");
    const runStatus = normalizeStatus(body.status);
    const environment = requireString(body.environment, "environment");

    const executionSecondsRaw = body.execution_seconds;
    const durationMs = typeof executionSecondsRaw === "number" && Number.isFinite(executionSecondsRaw)
      ? Math.max(0, Math.round(executionSecondsRaw * 1000))
      : null;

    const pool = getPgPool();
    await pool.query(
      `
        INSERT INTO pipeline_runs (
          event_type,
          timestamp_utc,
          dataset_id,
          source_system,
          step,
          run_id,
          run_status,
          duration_ms,
          installation_id,
          environment,
          payload
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
        )
      `,
      [
        "pipeline_run",
        timestampUtc,
        datasetId,
        optionalString(body.source_system),
        step,
        runId,
        runStatus,
        durationMs,
        installationId,
        environment,
        JSON.stringify(body),
      ],
    );

    await pool.query(
      `
        INSERT INTO ingest_audit (endpoint, installation_id, status_code, request_body, response_body)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
      `,
      [
        "pipeline-runs",
        installationId,
        201,
        JSON.stringify(body),
        JSON.stringify({ accepted: true, token_fingerprint: tokenFingerprint(token) }),
      ],
    );

    // LADR-040 fase 1: parallel schrijven naar meta.* schema (best-effort)
    writeMetaPipelineRun(pool, {
      installationId,
      datasetId,
      sourceSystem: optionalString(body.source_system),
      runId,
      step,
      status: runStatus,
      environment,
      timestampUtc,
      durationMs,
    }).catch((metaErr: unknown) => {
      console.error("[meta-ingest] pipeline-run write failed:", metaErr);
    });

    const response = NextResponse.json(
      { accepted: true, event_type: "pipeline_run", installation_id: installationId },
      { status: 201 },
    );
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
