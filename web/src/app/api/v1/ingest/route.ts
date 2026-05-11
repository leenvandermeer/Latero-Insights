// Unified ingest endpoint for latero-core adapter events.
// Accepts a JSON array of events dispatched by event_type.
// WP-5.6 — Validates schema_version; rejects MAJOR >= 2 with 422.
// Writes to meta.* via writeMetaPipelineRun / writeMetaDqCheck / writeMetaLineage.
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
import {
  writeMetaPipelineRun,
  writeMetaDqCheck,
  writeMetaLineage,
  writeMetaDataProduct,
} from "@/lib/meta-ingest";

interface AdapterEvent {
  event_type: string;
  schema_version?: string;
  installation_id?: string;
  [key: string]: unknown;
}

async function ingestPipelineRun(event: AdapterEvent, pool: ReturnType<typeof getPgPool>) {
  validateSchemaVersion(event.schema_version);
  const installationId = requireString(event.installation_id, "installation_id");
  const datasetId      = requireString(event.dataset_id,      "dataset_id");
  const runId          = requireString(event.run_id,          "run_id");
  const status         = normalizeStatus(event.status);
  const environment    = requireString(event.environment,     "environment");

  const finishedAt = event.finished_at ? new Date(String(event.finished_at)) : new Date();
  const startedAt  = event.started_at  ? new Date(String(event.started_at))  : finishedAt;
  const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());

  await writeMetaPipelineRun(pool, {
    installationId,
    datasetId,
    jobName:     optionalString(event.job_name),
    sourceSystem: optionalString(event.source_system),
    layer:        optionalString(event.source_layer),
    targetLayer:  optionalString(event.target_layer),
    runId,
    status,
    environment,
    timestampUtc: finishedAt.toISOString(),
    durationMs,
  });
}

async function ingestDqCheck(event: AdapterEvent, pool: ReturnType<typeof getPgPool>) {
  validateSchemaVersion(event.schema_version);
  const installationId = requireString(event.installation_id, "installation_id");
  const datasetId      = requireString(event.dataset_id,      "dataset_id");
  const checkId        = requireString(event.check_id,        "check_id");
  const checkStatus    = normalizeStatus(event.check_status ?? event.status);
  const environment    = requireString(event.environment,     "environment");

  const severity = String(event.severity ?? "medium").trim().toLowerCase();
  if (!["high", "medium", "low"].includes(severity)) {
    throw new Error("severity must be one of: high, medium, low");
  }

  await writeMetaDqCheck(pool, {
    installationId,
    datasetId,
    checkId,
    checkName:     String(event.check_name ?? checkId),
    checkStatus,
    severity,
    checkCategory: optionalString(event.check_category),
    policyVersion: optionalString(event.policy_version),
    message:       null,
    externalRunId: optionalString(event.run_id),
    timestampUtc:  new Date().toISOString(),
  });

  // Suppress unused variable warning — environment is validated above.
  void environment;
}

async function ingestLineage(event: AdapterEvent, pool: ReturnType<typeof getPgPool>) {
  validateSchemaVersion(event.schema_version);
  const installationId = requireString(event.installation_id, "installation_id");
  const runId          = requireString(event.run_id,          "run_id");
  requireString(event.environment, "environment");

  const sourceRef = String(event.source_ref  ?? event.source_entity ?? "").trim();
  const targetRef = String(event.target_ref  ?? event.target_entity ?? "").trim();
  if (!sourceRef) throw new Error("source_ref is required");
  if (!targetRef) throw new Error("target_ref is required");

  const hopKind = String(event.hop_kind ?? "data_flow").trim().toLowerCase();
  if (!["data_flow", "context"].includes(hopKind)) {
    throw new Error("hop_kind must be one of: data_flow, context");
  }

  if (hopKind === "data_flow") {
    await writeMetaLineage(pool, {
      installationId,
      externalRunId:   runId,
      sourceEntity:    String(event.source_entity ?? sourceRef),
      targetEntity:    String(event.target_entity ?? targetRef),
      sourceType:      optionalString(event.source_type),
      targetType:      optionalString(event.target_type),
      sourceAttribute: optionalString(event.source_attribute),
      targetAttribute: optionalString(event.target_attribute),
      sourceSystem:    optionalString(event.source_system),
      sourceLayer:     optionalString(event.source_layer),
      targetLayer:     optionalString(event.target_layer),
      timestampUtc:    new Date().toISOString(),
    });
  }
}

async function ingestDataProduct(event: AdapterEvent, pool: ReturnType<typeof getPgPool>) {
  validateSchemaVersion(event.schema_version);
  const installationId = requireString(event.installation_id, "installation_id");
  const dataProductId  = requireString(event.data_product_id, "data_product_id");
  const displayName    = requireString(event.display_name,    "display_name");

  const tags = event.tags && typeof event.tags === "object" && !Array.isArray(event.tags)
    ? (event.tags as Record<string, unknown>)
    : null;

  const retentionDays = event.retention_days !== undefined && event.retention_days !== null
    ? Number(event.retention_days)
    : null;

  await writeMetaDataProduct(pool, {
    installationId,
    dataProductId,
    displayName,
    description:    optionalString(event.description),
    owner:          optionalString(event.owner),
    dataS_steward:  optionalString(event.data_steward),
    domain:         optionalString(event.domain),
    classification: optionalString(event.classification),
    retentionDays:  retentionDays !== null && !isNaN(retentionDays) ? retentionDays : null,
    slaTier:        optionalString(event.sla_tier),
    contractVer:    optionalString(event.contract_ver),
    tags,
  });
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
      validateSchemaVersion(event.schema_version);
      if (eventType === "pipeline_run") {
        await ingestPipelineRun(event, pool);
      } else if (eventType === "data_quality_check") {
        await ingestDqCheck(event, pool);
      } else if (eventType === "lineage") {
        await ingestLineage(event, pool);
      } else if (eventType === "data_product") {
        await ingestDataProduct(event, pool);
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
