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
import { writeMetaDqCheck } from "@/lib/meta-ingest";

function normalizeSeverity(value: unknown): string {
  const severity = String(value ?? "").trim().toLowerCase();
  if (severity === "high" || severity === "medium" || severity === "low") {
    return severity;
  }
  throw new Error("severity must be one of: high, medium, low");
}

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(`v1:dq-checks:${clientIp}`);
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
    const checkId = requireString(body.check_id, "check_id");
    const checkName = requireString(body.check_name ?? body.check_id, "check_name");
    const checkStatus = normalizeStatus(body.status);
    const severity = normalizeSeverity(body.severity);
    const environment = requireString(body.environment, "environment");

    const pool = getPgPool();
    await pool.query(
      `
        INSERT INTO data_quality_checks (
          event_type,
          timestamp_utc,
          dataset_id,
          step,
          run_id,
          check_id,
          check_name,
          check_status,
          severity,
          check_category,
          policy_version,
          message,
          installation_id,
          environment,
          payload
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
        )
      `,
      [
        "data_quality_check",
        timestampUtc,
        datasetId,
        optionalString(body.step),
        optionalString(body.run_id),
        checkId,
        checkName,
        checkStatus,
        severity,
        optionalString(body.check_category),
        optionalString(body.policy_version),
        optionalString(body.message),
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
        "dq-checks",
        installationId,
        201,
        JSON.stringify(body),
        JSON.stringify({ accepted: true, token_fingerprint: tokenFingerprint(token) }),
      ],
    );

    // LADR-040 fase 1: parallel schrijven naar meta.* schema (best-effort)
    writeMetaDqCheck(pool, {
      installationId,
      datasetId,
      checkId,
      checkName,
      checkStatus,
      severity,
      checkCategory: optionalString(body.check_category),
      policyVersion: optionalString(body.policy_version),
      message: optionalString(body.message),
      externalRunId: optionalString(body.run_id),
      timestampUtc,
    }).catch((metaErr: unknown) => {
      console.error("[meta-ingest] dq-check write failed:", metaErr);
    });

    const response = NextResponse.json(
      { accepted: true, event_type: "data_quality_check", installation_id: installationId },
      { status: 201 },
    );
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
