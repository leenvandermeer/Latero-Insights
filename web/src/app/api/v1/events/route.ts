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
 *   - ParentRunFacet → meta.runs.source_parent_run_id
 *   - Remaining facets → run_facets / dataset_facets JSONB
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getPgPool, verifyInstallationToken, getBearerToken } from "@/lib/insights-saas-db";
import type { Pool, PoolClient } from "pg";

// ── Namespace → layer mapping ──────────────────────────────────────────────

const KNOWN_LAYERS = new Set(["landing", "raw", "bronze", "silver", "gold"]);

/**
 * Extract entity name and layer from an OL namespace/name pair.
 * Namespace: e.g. "databricks://workspace/meta/bronze"
 * Name:      e.g. "cbs_arbeid" or "workspace.bronze.cbs_arbeid"
 *
 * Entity name is taken as-is from the last part of the name — no prefix stripping (LINS-021).
 * Layer is derived only from the namespace path or FQN structure, never from the entity name itself.
 */
function parseOLDataset(namespace: string, name: string): { entityName: string; layer: string | null } {
  // Try to extract layer from namespace path segments
  const nsSegments = namespace.toLowerCase().split(/[/.]/).filter(Boolean);
  let layer: string | null = null;
  for (const seg of [...nsSegments].reverse()) {
    if (KNOWN_LAYERS.has(seg)) { layer = seg; break; }
  }

  // Try to extract layer from FQN structure (catalog.layer.table or layer.table)
  const nameParts = name.split(".").filter(Boolean);
  const tableName = nameParts.at(-1) ?? name;
  if (!layer) {
    const penultimate = nameParts.at(-2)?.toLowerCase();
    if (penultimate && KNOWN_LAYERS.has(penultimate)) layer = penultimate;
  }

  // Entity name = last part of the name, as-is. No stripping (LINS-021).
  return { entityName: tableName || name, layer };
}

/**
 * Returns the bare entity name as dataset_id (LINS-021 / WP-NDI-001).
 * Layer is stored in its own column; composite IDs are no longer used.
 */
function bareDatasetId(entityName: string): string {
  return entityName;
}

function resolvedLayer(layer: string | null): string {
  return layer && KNOWN_LAYERS.has(layer) ? layer : "unknown";
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
  pool: PoolClient
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

  const jobDatasetId = bareDatasetId(jobEntity);
  const jobLayerResolved = resolvedLayer(jobLayer);

  // 1. Upsert entity (V2)
  // Context nodes: job namespace IS the entity itself (e.g. "latero" processing "latero")
  const jobIsContextNode = jobEntity === jobNamespace.replace(/^[a-z]+:\/\//, "").split("/")[0];
  await pool.query(
    `INSERT INTO meta.entities (entity_id, installation_id, display_name, is_context_node)
     VALUES ($1, $2, $1, $3)
     ON CONFLICT (installation_id, entity_id) DO UPDATE
       SET is_context_node = meta.entities.is_context_node OR EXCLUDED.is_context_node`,
    [jobEntity, installationId, jobIsContextNode]
  );

  // 2. Upsert dataset (WP-NDI-001: dataset_id = bare entity name, layer = separate column)
  await pool.query(
    `INSERT INTO meta.datasets (dataset_id, installation_id, namespace, object_name,
       platform, entity_type, layer, entity_id)
     VALUES ($1, $2, $3, $4, 'UNKNOWN', 'TABLE', $5, $1)
     ON CONFLICT (installation_id, dataset_id, layer) DO UPDATE
       SET last_seen_at = now(),
           entity_id = COALESCE(meta.datasets.entity_id, EXCLUDED.entity_id),
           dataset_facets = COALESCE(meta.datasets.dataset_facets, '{}') || $6`,
    [jobDatasetId, installationId, jobNamespace, jobEntity, jobLayerResolved,
      JSON.stringify(jobFacets)]
  );

  // 3. Upsert job (dataset_id = bare entity name, not composite)
  const fullJobName = `${jobNamespace}/${jobName}`.replace(/^\//, "");
  const jobResult = await pool.query(
    `INSERT INTO meta.jobs (installation_id, job_name, job_type, dataset_id)
     VALUES ($1, $2, 'PIPELINE', $3)
     ON CONFLICT (installation_id, job_name) DO UPDATE
       SET dataset_id = COALESCE(EXCLUDED.dataset_id, meta.jobs.dataset_id)
     RETURNING job_id`,
    [installationId, fullJobName.slice(0, 200), jobDatasetId]
  );
  const jobId = jobResult.rows[0]?.job_id as string;
  if (!jobId) return;

  // 4. Upsert run
  const updateResult = await pool.query(
    `UPDATE meta.runs
     SET status = $1, ended_at = $2, run_facets = $3
     WHERE installation_id = $4 AND external_run_id = $5 AND task_name = $6
     RETURNING run_id`,
    [status, endedAt, JSON.stringify(runFacets), installationId, runId, jobName]
  );

  let runUuid: string;
  if ((updateResult.rowCount ?? 0) > 0) {
    runUuid = updateResult.rows[0].run_id;
  } else {
    const insertResult = await pool.query(
      `INSERT INTO meta.runs (job_id, installation_id, external_run_id, source_parent_run_id,
         task_name, status, environment, started_at, ended_at, run_facets)
       VALUES ($1, $2, $3, $4, $5, $6, 'openlineage', $7, $8, $9)
       RETURNING run_id`,
      [jobId, installationId, runId, parentRunId || null, jobName.slice(0, 200), status,
        eventTime, endedAt, JSON.stringify(runFacets)]
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
    const dsId = bareDatasetId(entityName);
    const dsLayer = resolvedLayer(layer);
    const dsFacets = (ds.facets as Record<string, unknown>) ?? {};

    // Ensure entity exists before upserting dataset
    const dsIsContextNode = entityName === String(ds.namespace ?? "").replace(/^[a-z]+:\/\//, "").split("/")[0];
    await pool.query(
      `INSERT INTO meta.entities (entity_id, installation_id, display_name, is_context_node)
       VALUES ($1, $2, $1, $3)
       ON CONFLICT (installation_id, entity_id) DO UPDATE
         SET is_context_node = meta.entities.is_context_node OR EXCLUDED.is_context_node`,
      [entityName, installationId, dsIsContextNode]
    );

    // WP-NDI-001: dataset_id = bare entity name, layer = separate column
    await pool.query(
      `INSERT INTO meta.datasets (dataset_id, installation_id, namespace, object_name,
         platform, entity_type, layer, entity_id, dataset_facets)
       VALUES ($1, $2, $3, $4, 'UNKNOWN', 'TABLE', $5, $1, $6)
       ON CONFLICT (installation_id, dataset_id, layer) DO UPDATE
         SET last_seen_at = now(),
             entity_id = COALESCE(meta.datasets.entity_id, EXCLUDED.entity_id),
             dataset_facets = COALESCE(meta.datasets.dataset_facets, '{}') || $6`,
      [dsId, installationId, String(ds.namespace ?? ""), entityName, dsLayer,
        JSON.stringify(dsFacets)]
    );

    await pool.query(
      `INSERT INTO meta.run_io (run_id, installation_id, dataset_id, layer, role, observed_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (run_id, dataset_id, layer, role) DO NOTHING`,
      [runUuid, installationId, dsId, dsLayer, ds.role, eventTime]
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
          const srcId = bareDatasetId(srcEntity);
          const srcLayerResolved = resolvedLayer(srcLayer);
          const srcCol = String(inp.field ?? "");
          const transform = (fd.transformationType as string)?.toUpperCase() ?? "UNKNOWN";
          const tr = ["DIRECT", "INDIRECT", "UNKNOWN"].includes(transform) ? transform : "UNKNOWN";

          if (srcCol) {
            await pool.query(
              `INSERT INTO meta.lineage_columns
                 (installation_id, source_dataset_id, source_layer, source_column,
                  target_dataset_id, target_layer, target_column, transformation_type,
                  first_observed_at, last_observed_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
               ON CONFLICT (installation_id, source_dataset_id, source_layer, source_column,
                            target_dataset_id, target_layer, target_column)
               DO UPDATE SET last_observed_at = $9,
                             transformation_type = EXCLUDED.transformation_type`,
              [installationId, srcId, srcLayerResolved, srcCol, dsId, dsLayer, targetCol, tr, eventTime]
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

  // 6. Build lineage_edges from inputs → outputs (WP-NDI-001: bare IDs + layer columns)
  for (const inp of inputs) {
    const { entityName: srcEntity, layer: srcLayer } = parseOLDataset(
      String(inp.namespace ?? ""), String(inp.name ?? "")
    );
    const srcId = bareDatasetId(srcEntity);
    const srcLayerResolved = resolvedLayer(srcLayer);

    for (const out of outputs) {
      const { entityName: tgtEntity, layer: tgtLayer } = parseOLDataset(
        String(out.namespace ?? ""), String(out.name ?? "")
      );
      const tgtId = bareDatasetId(tgtEntity);
      const tgtLayerResolved = resolvedLayer(tgtLayer);
      // Skip self-loops (same dataset_id AND same layer)
      if (srcId === tgtId && srcLayerResolved === tgtLayerResolved) continue;

      await pool.query(
        `INSERT INTO meta.lineage_edges
           (installation_id, source_dataset_id, source_layer, target_dataset_id, target_layer,
            first_observed_at, last_observed_at, last_observed_run, observation_count)
         VALUES ($1, $2, $3, $4, $5, $6, $6, $7, 1)
         ON CONFLICT (installation_id, source_dataset_id, source_layer, target_dataset_id, target_layer)
         DO UPDATE SET
           last_observed_at  = $6,
           last_observed_run = $7,
           observation_count = meta.lineage_edges.observation_count + 1`,
        [installationId, srcId, srcLayerResolved, tgtId, tgtLayerResolved, eventTime, runUuid]
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
      await processOLEvent(event, installationId, client);
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
