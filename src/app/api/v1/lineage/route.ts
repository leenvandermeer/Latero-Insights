import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  getBearerToken,
  getPgPool,
  optionalString,
  parseTimestamp,
  requireString,
  tokenFingerprint,
  verifyInstallationToken,
} from "@/lib/insights-saas-db";

function normalizeHopKind(value: unknown): string {
  const hopKind = String(value ?? "data_flow").trim().toLowerCase();
  if (hopKind === "data_flow" || hopKind === "context") {
    return hopKind;
  }
  throw new Error("hop_kind must be one of: data_flow, context");
}

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(`v1:lineage:${clientIp}`);
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
    const sourceEntity = requireString(body.input_entity, "input_entity");
    const targetEntity = requireString(body.output_entity, "output_entity");
    const environment = requireString(body.environment, "environment");
    const hopKind = normalizeHopKind(body.hop_kind);

    const pool = getPgPool();
    await pool.query(
      `
        INSERT INTO data_lineage (
          event_type,
          timestamp_utc,
          dataset_id,
          step,
          run_id,
          source_entity,
          source_type,
          source_ref,
          source_attribute,
          target_entity,
          target_type,
          target_ref,
          target_attribute,
          hop_kind,
          source_system,
          installation_id,
          environment,
          schema_version,
          lineage_evidence,
          payload
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
        )
      `,
      [
        "data_lineage",
        timestampUtc,
        datasetId,
        step,
        runId,
        sourceEntity,
        optionalString(body.source_type),
        optionalString(body.source_ref),
        optionalString(body.source_attribute),
        targetEntity,
        optionalString(body.target_type),
        optionalString(body.target_ref),
        optionalString(body.target_attribute),
        hopKind,
        optionalString(body.source_system),
        installationId,
        environment,
        optionalString(body.schema_version),
        optionalString(body.lineage_evidence),
        JSON.stringify(body),
      ],
    );

    await pool.query(
      `
        INSERT INTO ingest_audit (endpoint, installation_id, status_code, request_body, response_body)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
      `,
      [
        "lineage",
        installationId,
        201,
        JSON.stringify(body),
        JSON.stringify({ accepted: true, token_fingerprint: tokenFingerprint(token) }),
      ],
    );

    const response = NextResponse.json(
      { accepted: true, event_type: "data_lineage", installation_id: installationId },
      { status: 201 },
    );
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
