/**
 * POST /api/v1/events — OpenLineage RunEvent ingest endpoint
 * WP-V2-007 / LADR-062
 *
 * Accepts:
 *   - Single RunEvent object
 *   - Array of RunEvent objects (batch)
 *
 * Processes:
 *   - run lifecycle → meta.runs
 *   - inputs/outputs → meta.run_io + meta.lineage_edges
 *   - SchemaFacet → meta.datasets (dataset_facets)
 *   - DataQualityAssertionsFacet → meta.quality_results
 *   - ColumnLineageFacet → meta.lineage_columns
 *   - ParentRunFacet → meta.runs.parent_run_id
 *   - Remaining facets → run_facets / dataset_facets JSONB
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getPgPool, verifyInstallationToken, getBearerToken } from "@/lib/insights-saas-db";
import type { Pool } from "pg";

// ── Namespace → layer mapping ──────────────────────────────────────────────

const KNOWN_LAYERS = new Set(["landing", "raw", "bronze", "silver", "gold"]);

/**
 * Extract bare entity name and layer from an OL namespace/name pair.
 * Namespace: e.g. "databricks://workspace/meta/bronze"
 * Name:      e.g. "cbs_arbeid" or "workspace.bronze.cbs_arbeid"
 */
function parseOLDataset(namespace: string, name: string): { entityName: string; layer: string | null } {
  // Try to extract layer from namespace path segments
  const nsSegments = namespace.toLowerCase().split(/[/.]/).filter(Boolean);
  let layer: string | null = null;
  for (const seg of [...nsSegments].reverse()) {
    if (KNOWN_LAYERS.has(seg)) { layer = seg; break; }
  }

  // Try to extract layer from name (catalog.layer.table or layer.table)
  const nameParts = name.split(".").filter(Boolean);
  const tableName = nameParts.at(-1) ?? name;
  if (!layer) {
    const penultimate = nameParts.at(-2)?.toLowerCase();
    if (penultimate && KNOWN_LAYERS.has(penultimate)) layer = penultimate;
  }

  // Bare entity name: last part, strip known layer prefix/suffix
  const entityName = tableName
    .replace(new RegExp(`^(${[...KNOWN_LAYERS].join("|")})_`, "i"), "")
    .replace(new RegExp(`_(${[...KNOWN_LAYERS].join("|")})$`, "i"), "");

  return { entityName: entityName || tableName, layer };
}

function layerScopedId(entityName: string, layer: string | null): string {
  return layer && KNOWN_LAYERS.has(layer) ? `${entityName}::${layer}` : `${entityName}::unknown`;
}

function normalizeEventStatus(eventType: string): string {
  switch (eventType.toUpperCase()) {
    case "COMPLETE": return "SUCCESS";
    case "FAIL": return "FAILED";
    case "ABORT": return "FAILED";
    case "START":
    case "RUNNING": return "RUNNING";
    default: return "UNKNOWN";
  }
}

// ── OL event processor ────────────────────────────────────────────────────

async function processOLEvent(
  event: Record<string, unknown>,
  installationId: string,
  pool: Pool
): Promise<void> {
  const eventType = String(event.eventType ?? "OTHER");
  const eventTime = String(event.eventTime ?? new Date().toISOString());
  const run = event.run as Record<string, unknown> | undefined;
  const job = event.job as Record<string, unknown> | undefined;
  const inputs = (event.inputs as Array<Record<string, unknown>>) ?? [];
  const outputs = (event.outputs as Array<Record<string, unknown>>) ?? [];

  if (!run?.runId || !job?.name) return;

  const runId = String(run.runId);
  const jobNamespace = String(job.namespace ?? "");
  const jobName = String(job.name ?? "");
  const runFacets = (run.facets as Record<string, unknown>) ?? {};
  const jobFacets = (job.facets as Record<string, unknown>) ?? {};

  const status = normalizeEventStatus(eventType);
  const isTerminal = ["COMPLETE", "FAIL", "ABORT"].includes(eventType.toUpperCase());
  const endedAt = isTerminal ? eventTime : null;
  const eventDate = eventTime.slice(0, 10);

  // Extract parent run from ParentRunFacet
  const parentFacet = runFacets["parent"] as Record<string, unknown> | undefined;
  const parentRunId = parentFacet?.run
    ? String((parentFacet.run as Record<string, unknown>).runId ?? "")
    : null;

  // Determine dataset context from job name / outputs
  const primaryOutput = outputs[0];
  const { entityName: jobEntity, layer: jobLayer } = primaryOutput
    ? parseOLDataset(String(primaryOutput.namespace ?? ""), String(primaryOutput.name ?? ""))
    : parseOLDataset(jobNamespace, jobName);

  const scopedDatasetId = layerScopedId(jobEntity, jobLayer);

  // 1. Upsert dataset
  await pool.query(
    `INSERT INTO meta.datasets (dataset_id, installation_id, fqn, namespace, object_name,
       platform, entity_type, layer, group_id)
     VALUES ($1, $2, $3, $4, $5, 'UNKNOWN', 'TABLE', $6, $3)
     ON CONFLICT (installation_id, dataset_id) DO UPDATE
       SET last_seen_at = now(),
           dataset_facets = COALESCE(meta.datasets.dataset_facets, '{}') || $7`,
    [scopedDatasetId, installationId, jobEntity, jobNamespace, jobEntity, jobLayer,
      JSON.stringify(jobFacets)]
  );

  // 2. Upsert entity (V2)
  await pool.query(
    `INSERT INTO meta.entities (entity_id, installation_id, display_name)
     VALUES ($1, $2, $1)
     ON CONFLICT (installation_id, entity_id) DO NOTHING`,
    [jobEntity, installationId]
  );

  // 3. Upsert job
  const fullJobName = `${jobNamespace}/${jobName}`.replace(/^\//, "");
  const jobResult = await pool.query(
    `INSERT INTO meta.jobs (installation_id, job_name, job_type, dataset_id)
     VALUES ($1, $2, 'OPENLINEAGE', $3)
     ON CONFLICT (installation_id, job_name) DO UPDATE
       SET dataset_id = COALESCE(EXCLUDED.dataset_id, meta.jobs.dataset_id)
     RETURNING job_id`,
    [installationId, fullJobName.slice(0, 200), jobEntity]
  );
  const jobId = jobResult.rows[0]?.job_id as string;
  if (!jobId) return;

  // 4. Upsert run
  const updateResult = await pool.query(
    `UPDATE meta.runs
     SET status = $1, ended_at = $2, run_facets = $3
     WHERE installation_id = $4 AND external_run_id = $5
     RETURNING run_id`,
    [status, endedAt, JSON.stringify(runFacets), installationId, runId]
  );

  let runUuid: string;
  if ((updateResult.rowCount ?? 0) > 0) {
    runUuid = updateResult.rows[0].run_id;
  } else {
    const insertResult = await pool.query(
      `INSERT INTO meta.runs (job_id, installation_id, external_run_id, step,
         status, environment, started_at, ended_at, parent_run_id, run_facets)
       VALUES ($1, $2, $3, $4, $5, 'openlineage', $6, $7, $8, $9)
       RETURNING run_id`,
      [jobId, installationId, runId, jobName.slice(0, 100), status,
        eventTime, endedAt, parentRunId || null, JSON.stringify(runFacets)]
    );
    runUuid = insertResult.rows[0].run_id;
  }

  // 5. Process inputs and outputs → run_io + lineage_edges
  const allDatasets: Array<Record<string, unknown> & { role: "INPUT" | "OUTPUT" }> = [
    ...inputs.map((d) => ({ ...d, role: "INPUT" as const })),
    ...outputs.map((d) => ({ ...d, role: "OUTPUT" as const })),
  ];

  for (const ds of allDatasets) {
    const { entityName, layer } = parseOLDataset(
      String(ds.namespace ?? ""), String(ds.name ?? "")
    );
    const dsId = layerScopedId(entityName, layer);
    const dsFacets = (ds.facets as Record<string, unknown>) ?? {};

    await pool.query(
      `INSERT INTO meta.datasets (dataset_id, installation_id, fqn, namespace, object_name,
         platform, entity_type, layer, group_id, dataset_facets)
       VALUES ($1, $2, $3, $4, $3, 'UNKNOWN', 'TABLE', $5, $3, $6)
       ON CONFLICT (installation_id, dataset_id) DO UPDATE
         SET last_seen_at = now(),
             dataset_facets = COALESCE(meta.datasets.dataset_facets, '{}') || $6`,
      [dsId, installationId, entityName, String(ds.namespace ?? ""), layer,
        JSON.stringify(dsFacets)]
    );

    await pool.query(
      `INSERT INTO meta.run_io (run_id, installation_id, dataset_id, role, observed_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (run_id, dataset_id, role) DO NOTHING`,
      [runUuid, installationId, dsId, ds.role, eventTime]
    );

    // Process ColumnLineageFacet
    const colFacet = dsFacets["columnLineage"] as Record<string, unknown> | undefined;
    if (colFacet?.fields) {
      const fields = colFacet.fields as Record<string, unknown>;
      for (const [targetCol, fieldDef] of Object.entries(fields)) {
        const fd = fieldDef as Record<string, unknown>;
        const inputFields = (fd.inputFields as Array<Record<string, unknown>>) ?? [];
        for (const inp of inputFields) {
          const { entityName: srcEntity, layer: srcLayer } = parseOLDataset(
            String(inp.namespace ?? ""), String(inp.name ?? "")
          );
          const srcId = layerScopedId(srcEntity, srcLayer);
          const srcCol = String(inp.field ?? "");
          const transform = (fd.transformationType as string)?.toUpperCase() ?? "UNKNOWN";
          const tr = ["DIRECT", "INDIRECT", "UNKNOWN"].includes(transform) ? transform : "UNKNOWN";

          if (srcCol) {
            await pool.query(
              `INSERT INTO meta.lineage_columns
                 (installation_id, source_dataset_id, source_column,
                  target_dataset_id, target_column, transformation_type,
                  first_observed_at, last_observed_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
               ON CONFLICT (installation_id, source_dataset_id, source_column,
                            target_dataset_id, target_column)
               DO UPDATE SET last_observed_at = $7,
                             transformation_type = EXCLUDED.transformation_type`,
              [installationId, srcId, srcCol, dsId, targetCol, tr, eventTime]
            );
          }
        }
      }
    }

    // Process DataQualityAssertionsFacet (input datasets may carry DQ assertions)
    const dqFacet = dsFacets["dataQualityAssertions"] as Record<string, unknown> | undefined;
    if (dqFacet?.assertions) {
      const assertions = dqFacet.assertions as Array<Record<string, unknown>>;
      for (const assertion of assertions) {
        const checkId = String(assertion.assertion ?? "dq_check");
        const passed = assertion.success === true;
        const checkStatus = passed ? "SUCCESS" : "FAILED";

        await pool.query(
          `INSERT INTO meta.quality_rules (installation_id, check_id, check_name, check_category)
           VALUES ($1, $2, $2, 'accuracy')
           ON CONFLICT (installation_id, check_id) DO NOTHING`,
          [installationId, checkId]
        );

        await pool.query(
          `INSERT INTO meta.quality_results
             (installation_id, check_id, run_id, status, result_date, executed_at)
           VALUES ($1, $2, $3, $4, $5::date, $5)
           ON CONFLICT DO NOTHING`,
          [installationId, checkId, runUuid, checkStatus, eventTime]
        );
      }
    }
  }

  // 6. Build lineage_edges from inputs → outputs
  for (const inp of inputs) {
    const { entityName: srcEntity, layer: srcLayer } = parseOLDataset(
      String(inp.namespace ?? ""), String(inp.name ?? "")
    );
    const srcId = layerScopedId(srcEntity, srcLayer);

    for (const out of outputs) {
      const { entityName: tgtEntity, layer: tgtLayer } = parseOLDataset(
        String(out.namespace ?? ""), String(out.name ?? "")
      );
      const tgtId = layerScopedId(tgtEntity, tgtLayer);
      if (srcId === tgtId) continue;

      await pool.query(
        `INSERT INTO meta.lineage_edges
           (installation_id, source_dataset_id, target_dataset_id,
            first_observed_at, last_observed_at, last_observed_run, observation_count)
         VALUES ($1, $2, $3, $4, $4, $5, 1)
         ON CONFLICT (installation_id, source_dataset_id, target_dataset_id)
         DO UPDATE SET
           last_observed_at  = $4,
           last_observed_run = $5,
           observation_count = meta.lineage_edges.observation_count + 1`,
        [installationId, srcId, tgtId, eventTime, runUuid]
      );
    }
  }
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(clientIp);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  // Auth: Bearer token + installation_id from first event
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });

  // Read body first so we can get installation_id
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const events: Array<Record<string, unknown>> = Array.isArray(body) ? body : [body as Record<string, unknown>];

  if (events.length === 0) {
    return NextResponse.json({ accepted: 0, errors: [] });
  }
  if (events.length > 1000) {
    return NextResponse.json({ error: "Batch too large (max 1000 events)" }, { status: 413 });
  }

  // All events must belong to the same installation (first event is authoritative)
  const firstEvent = events[0] as Record<string, unknown>;
  const installationId = String(firstEvent?.producer ?? firstEvent?.installation_id ?? "").trim() || null;
  if (!installationId) {
    return NextResponse.json({ error: "installation_id or producer required in first event" }, { status: 400 });
  }

  const pool = getPgPool();
  const authorized = await verifyInstallationToken(installationId, token);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let accepted = 0;
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (!event || typeof event !== "object") {
      errors.push({ index: i, error: "Not an object" });
      continue;
    }
    if (!event.eventType || !event.run || !event.job) {
      errors.push({ index: i, error: "Missing required fields: eventType, run, job" });
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await processOLEvent(event, installationId, pool);
      await client.query("COMMIT");
      accepted++;
    } catch (err) {
      await client.query("ROLLBACK");
      errors.push({ index: i, error: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      client.release();
    }
  }

  const httpStatus = errors.length > 0 && accepted === 0 ? 422 : 200;
  return NextResponse.json({ accepted, errors }, { status: httpStatus });
}
