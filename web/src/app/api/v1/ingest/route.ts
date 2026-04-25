// WP-5.2 — Unified ingest endpoint for latero-core adapter events.
// Accepts a JSON array of events dispatched by event_type.
// WP-5.6 — Validates schema_version; rejects MAJOR >= 2 with 422.
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  getBearerToken,
  getPgPool,
  normalizeStatus,
  optionalString,
  requireString,
  SchemaVersionError,
  tokenFingerprint,
  validateSchemaVersion,
  verifyInstallationToken,
} from "@/lib/insights-saas-db";

interface AdapterEvent {
  event_type: string;
  schema_version?: string;
  installation_id?: string;
  [key: string]: unknown;
}

async function ingestPipelineRun(event: AdapterEvent, pool: ReturnType<typeof getPgPool>) {
  validateSchemaVersion(event.schema_version);
  const installationId = requireString(event.installation_id, "installation_id");
  const datasetId = requireString(event.dataset_id, "dataset_id");
  const runId = requireString(event.run_id, "run_id");
  const step = requireString(event.step, "step");
  const status = normalizeStatus(event.status);
  const environment = requireString(event.environment, "environment");

  const finishedAt = event.finished_at ? new Date(String(event.finished_at)) : new Date();
  const startedAt = event.started_at ? new Date(String(event.started_at)) : finishedAt;
  const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());

  await pool.query(
    `INSERT INTO pipeline_runs
       (event_type, timestamp_utc, dataset_id, source_system, step, run_id, run_status,
        duration_ms, installation_id, environment, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      "pipeline_run",
      finishedAt.toISOString(),
      datasetId,
      optionalString(event.source_system),
      step,
      runId,
      status,
      durationMs,
      installationId,
      environment,
      JSON.stringify(event),
    ],
  );
}

async function ingestDqCheck(event: AdapterEvent, pool: ReturnType<typeof getPgPool>) {
  validateSchemaVersion(event.schema_version);
  const installationId = requireString(event.installation_id, "installation_id");
  const datasetId = requireString(event.dataset_id, "dataset_id");
  const checkId = requireString(event.check_id, "check_id");
  const checkStatus = normalizeStatus(event.check_status ?? event.status);
  const environment = requireString(event.environment, "environment");

  const severity = String(event.severity ?? "medium").trim().toLowerCase();
  if (!["high", "medium", "low"].includes(severity)) {
    throw new Error("severity must be one of: high, medium, low");
  }

  await pool.query(
    `INSERT INTO data_quality_checks
       (event_type, timestamp_utc, dataset_id, step, run_id, check_id, check_name,
        check_status, severity, check_category, installation_id, environment, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      "data_quality_check",
      new Date().toISOString(),
      datasetId,
      optionalString(event.step),
      optionalString(event.run_id),
      checkId,
      checkId,
      checkStatus,
      severity,
      optionalString(event.check_category),
      installationId,
      environment,
      JSON.stringify(event),
    ],
  );
}

async function ingestLineage(event: AdapterEvent, pool: ReturnType<typeof getPgPool>) {
  validateSchemaVersion(event.schema_version);
  const installationId = requireString(event.installation_id, "installation_id");
  const datasetId = requireString(event.dataset_id, "dataset_id");
  const runId = requireString(event.run_id, "run_id");
  const step = requireString(event.step, "step");
  const environment = requireString(event.environment, "environment");

  // New collector event format uses source_ref / target_ref as entity identifiers
  const sourceRef = String(event.source_ref ?? "").trim();
  const targetRef = String(event.target_ref ?? "").trim();
  if (!sourceRef) throw new Error("source_ref is required");
  if (!targetRef) throw new Error("target_ref is required");

  const hopKind = String(event.hop_kind ?? "data_flow").trim().toLowerCase();
  if (!["data_flow", "context"].includes(hopKind)) {
    throw new Error("hop_kind must be one of: data_flow, context");
  }

  await pool.query(
    `INSERT INTO data_lineage
       (event_type, timestamp_utc, dataset_id, step, run_id,
        source_entity, source_ref, target_entity, target_ref,
        hop_kind, installation_id, environment, schema_version, lineage_evidence, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      "data_lineage",
      new Date().toISOString(),
      datasetId,
      step,
      runId,
      sourceRef,
      sourceRef,
      targetRef,
      targetRef,
      hopKind,
      installationId,
      environment,
      optionalString(event.schema_version),
      event.evidence ? JSON.stringify(event.evidence) : null,
      JSON.stringify(event),
    ],
  );
}

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(`v1:ingest:${clientIp}`);
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

  let events: AdapterEvent[];
  try {
    const body = await request.json();
    events = Array.isArray(body) ? body : [body];
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (events.length === 0) {
    return NextResponse.json({ accepted: true, count: 0 }, { status: 200 });
  }

  // All events in a batch must belong to the same installation
  const installationId = String(events[0]?.installation_id ?? "").trim();
  if (!installationId) {
    return NextResponse.json({ error: "installation_id is required" }, { status: 400 });
  }

  const authorized = await verifyInstallationToken(installationId, token);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized installation/token" }, { status: 401 });
  }

  const pool = getPgPool();
  const results: Array<{ index: number; event_type: string; status: "accepted" | "rejected"; error?: string }> = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const eventType = String(event?.event_type ?? "").trim();

    try {
      // WP-5.6: schema_version validated inside each handler
      if (eventType === "pipeline_run") {
        await ingestPipelineRun(event, pool);
      } else if (eventType === "data_quality_check") {
        await ingestDqCheck(event, pool);
      } else if (eventType === "lineage") {
        await ingestLineage(event, pool);
      } else {
        throw new Error(`Unknown event_type '${eventType}'`);
      }
      results.push({ index: i, event_type: eventType, status: "accepted" });
    } catch (err) {
      if (err instanceof SchemaVersionError) {
        return NextResponse.json({ error: err.message }, { status: 422 });
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({ index: i, event_type: eventType, status: "rejected", error: message });
    }
  }

  await pool.query(
    `INSERT INTO ingest_audit (endpoint, installation_id, status_code, request_body, response_body)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
    [
      "ingest",
      installationId,
      201,
      JSON.stringify(events),
      JSON.stringify({ results, token_fingerprint: tokenFingerprint(token) }),
    ],
  );

  const accepted = results.filter((r) => r.status === "accepted").length;
  const rejected = results.filter((r) => r.status === "rejected").length;

  const response = NextResponse.json(
    { accepted, rejected, results },
    { status: 201 },
  );
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}
