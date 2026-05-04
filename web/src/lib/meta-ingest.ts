/**
 * meta-ingest.ts — LADR-040: exclusieve schrijflaag naar meta.* schema
 *
 * Elke functie gebruikt een poolclient met expliciete transactie.
 * Publieke event-tabellen zijn verwijderd (LADR-041); dit is het
 * enige schrijfpad voor pipeline-, DQ- en lineage-events.
 */

import type { Pool } from "pg";

// ---------------------------------------------------------------------------
// Intern: helpers
// ---------------------------------------------------------------------------

function extractObjectName(entityId: string): string {
  const parts = entityId.split(".");
  return parts[parts.length - 1] ?? entityId;
}

function extractNamespace(entityId: string): string {
  const lastDot = entityId.lastIndexOf(".");
  return lastDot > 0 ? entityId.slice(0, lastDot) : "";
}

function normalizePlatform(sourceType: string | null | undefined): string {
  const t = (sourceType ?? "").trim().toUpperCase();
  const allowed = ["ICEBERG", "DELTA", "HIVE", "JDBC", "FILE", "TOPIC"];
  return allowed.includes(t) ? t : "UNKNOWN";
}

const PIPELINE_LAYERS = new Set(["landing", "raw", "bronze", "silver", "gold"]);

/**
 * Leidt de logische pipeline-laag af uit een FQN in het formaat
 * "catalog.layer.table" (bijv. "workspace.bronze.fact_sales" → "bronze").
 * Retourneert null als het voorlaatste segment geen bekende laag is.
 */
function extractLayerFromFqn(fqn: string): string | null {
  const parts = fqn.split(".").filter(Boolean);
  const penultimate = parts.at(-2)?.toLowerCase() ?? "";
  return PIPELINE_LAYERS.has(penultimate) ? penultimate : null;
}

/**
 * LADR-058: Layer-scoped dataset identity.
 * dataset_id in meta.datasets = "{entityName}::{layer}" (bijv. "cbs_arbeid::bronze").
 * Dit maakt iedere (entity_name, layer) combinatie uniek en voorkomt zelf-refererende edges.
 * "unknown" wordt gebruikt als de laag niet bepaald kan worden.
 */
function layerScopedId(entityName: string, layer: string | null | undefined): string {
  const clean = layer?.toLowerCase().trim() ?? null;
  return PIPELINE_LAYERS.has(clean ?? "") ? `${entityName}::${clean}` : `${entityName}::unknown`;
}

// ---------------------------------------------------------------------------
// writeMetaPipelineRun
// Writes: meta.datasets (1), meta.jobs (1), meta.runs (1), meta.run_io (1)
// ---------------------------------------------------------------------------

export interface MetaPipelineRunParams {
  installationId: string;
  datasetId: string;
  sourceSystem: string | null;
  layer?: string | null;
  targetLayer?: string | null; // LADR-058: laag van de output-dataset (voor layer-scoped ID)
  runId: string;
  step: string;
  status: string;
  environment: string;
  timestampUtc: string;
  durationMs: number | null;
}

export async function writeMetaPipelineRun(
  pool: Pool,
  params: MetaPipelineRunParams,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Upsert dataset (LADR-058: layer-scoped dataset_id)
    const objectName = extractObjectName(params.datasetId);
    const namespace = extractNamespace(params.datasetId);
    // targetLayer heeft prioriteit over step-afleiding — runs schrijven naar de target-laag
    const layer = params.targetLayer ?? params.layer ?? params.step?.toLowerCase() ?? extractLayerFromFqn(params.datasetId);
    const scopedDatasetId = layerScopedId(params.datasetId, layer);
    await client.query(
      `
        INSERT INTO meta.datasets (
          dataset_id, installation_id, fqn, namespace, object_name,
          platform, entity_type, source_system, layer, group_id
        ) VALUES ($1, $2, $3, $4, $5, 'UNKNOWN', 'TABLE', $6, $7, $3)
        ON CONFLICT (installation_id, dataset_id) DO UPDATE
          SET last_seen_at  = now(),
              source_system = COALESCE(EXCLUDED.source_system, meta.datasets.source_system)
      `,
      [scopedDatasetId, params.installationId, params.datasetId, namespace, objectName, params.sourceSystem, layer],
    );

    // 2. Upsert job (job_name = dataset_id:step)
    const jobName = `${params.datasetId}:${params.step}`;
    const jobResult = await client.query(
      `
        INSERT INTO meta.jobs (installation_id, job_name, job_type, dataset_id)
        VALUES ($1, $2, 'PIPELINE', $3)
        ON CONFLICT (installation_id, job_name) DO UPDATE
          SET dataset_id = COALESCE(EXCLUDED.dataset_id, meta.jobs.dataset_id)
        RETURNING job_id
      `,
      [params.installationId, jobName, params.datasetId],
    );
    const jobId = jobResult.rows[0]?.job_id as string | undefined;
    if (!jobId) throw new Error("meta.jobs upsert returned no job_id");

    // 3. Upsert run (UPDATE then INSERT to avoid ON CONFLICT on generated column)
    const isTerminal = params.status !== "RUNNING";
    const endedAt = isTerminal ? params.timestampUtc : null;

    const runDate = new Date(params.timestampUtc).toISOString().slice(0, 10);
    const updateResult = await client.query(
      `
        UPDATE meta.runs
        SET status      = $1,
            ended_at    = $2,
            duration_ms = $3
        WHERE installation_id = $4
          AND external_run_id = $5
          AND step            = $6
          AND run_date        = $7
        RETURNING run_id
      `,
      [
        params.status,
        endedAt,
        params.durationMs,
        params.installationId,
        params.runId,
        params.step,
        runDate,
      ],
    );

    let runUuid: string;
    if ((updateResult.rowCount ?? 0) > 0) {
      runUuid = updateResult.rows[0].run_id as string;
    } else {
      const insertResult = await client.query(
        `
          INSERT INTO meta.runs (
            job_id, installation_id, external_run_id, step,
            status, environment, started_at, ended_at, duration_ms
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING run_id
        `,
        [
          jobId,
          params.installationId,
          params.runId,
          params.step,
          params.status,
          params.environment,
          params.timestampUtc,
          endedAt,
          params.durationMs,
        ],
      );
      runUuid = insertResult.rows[0].run_id as string;
    }

    // 4. Upsert run_io (OUTPUT for the target dataset — layer-scoped ID)
    await client.query(
      `
        INSERT INTO meta.run_io (run_id, installation_id, dataset_id, role, observed_at)
        VALUES ($1, $2, $3, 'OUTPUT', $4)
        ON CONFLICT (run_id, dataset_id, role) DO NOTHING
      `,
      [runUuid, params.installationId, scopedDatasetId, params.timestampUtc],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

const ALLOWED_CHECK_CATEGORIES = new Set([
  "schema", "accuracy", "completeness", "freshness", "uniqueness", "custom",
]);

/**
 * Normaliseert check_category naar het beperkte vocabulaire van meta.quality_rules.
 * Onbekende waarden worden teruggebracht naar 'custom' zodat de CHECK-constraint
 * nooit faalt en de informatie zo goed mogelijk bewaard blijft.
 */
function normalizeCheckCategory(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (ALLOWED_CHECK_CATEGORIES.has(lower)) return lower;
  // Bekende MDCF/OL-patronen mappen naar het dichtstbijzijnde vocabulaire
  if (lower.includes("schema") || lower.includes("struct")) return "schema";
  if (lower.includes("null") || lower.includes("complete")) return "completeness";
  if (lower.includes("unique") || lower.includes("duplicate")) return "uniqueness";
  if (lower.includes("fresh") || lower.includes("lag") || lower.includes("delay")) return "freshness";
  if (lower.includes("accura") || lower.includes("valid") || lower.includes("referential") || lower.includes("range")) return "accuracy";
  return "custom";
}

// ---------------------------------------------------------------------------
// writeMetaDqCheck
// Writes: meta.datasets (1), meta.quality_rules (1), meta.quality_results (1)
// ---------------------------------------------------------------------------

export interface MetaDqCheckParams {
  installationId: string;
  datasetId: string;
  checkId: string;
  checkName: string;
  checkStatus: string; // SUCCESS | FAILED | WARNING
  severity: string; // high | medium | low (route normalises to lower)
  checkCategory: string | null;
  policyVersion: string | null;
  message: string | null;
  externalRunId: string | null;
  timestampUtc: string;
}

export async function writeMetaDqCheck(
  pool: Pool,
  params: MetaDqCheckParams,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Upsert dataset
    const objectName = extractObjectName(params.datasetId);
    const namespace = extractNamespace(params.datasetId);
    await client.query(
      `
        INSERT INTO meta.datasets (
          dataset_id, installation_id, fqn, namespace, object_name, platform, entity_type
        ) VALUES ($1, $2, $1, $3, $4, 'UNKNOWN', 'TABLE')
        ON CONFLICT (installation_id, dataset_id) DO UPDATE
          SET last_seen_at = now()
      `,
      [params.datasetId, params.installationId, namespace, objectName],
    );

    // 2. Upsert quality rule (definition is stable; update on change)
    await client.query(
      `
        INSERT INTO meta.quality_rules (
          check_id, installation_id, check_name, check_category,
          severity, policy_version, dataset_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (installation_id, check_id) DO UPDATE
          SET check_name     = COALESCE(EXCLUDED.check_name,     meta.quality_rules.check_name),
              check_category = COALESCE(EXCLUDED.check_category, meta.quality_rules.check_category),
              severity       = EXCLUDED.severity,
              policy_version = COALESCE(EXCLUDED.policy_version, meta.quality_rules.policy_version),
              dataset_id     = COALESCE(EXCLUDED.dataset_id,     meta.quality_rules.dataset_id),
              updated_at     = now()
      `,
      [
        params.checkId,
        params.installationId,
        params.checkName,
        normalizeCheckCategory(params.checkCategory),
        params.severity.toUpperCase(),
        params.policyVersion,
        params.datasetId,
      ],
    );

    // 3. Resolve meta.runs UUID (optional — DQ check may arrive without a linked run)
    let metaRunId: string | null = null;
    if (params.externalRunId) {
      const runRes = await client.query(
        `
          SELECT run_id
          FROM meta.runs
          WHERE installation_id = $1
            AND external_run_id = $2
          ORDER BY started_at DESC
          LIMIT 1
        `,
        [params.installationId, params.externalRunId],
      );
      metaRunId = (runRes.rows[0]?.run_id as string | undefined) ?? null;
    }

    // 4. Insert quality result
    // UNIQUE (installation_id, check_id, run_id, result_date): nullable run_id means
    // NULLs are treated as distinct by Postgres → no ON CONFLICT needed for unlinked results.
    await client.query(
      `
        INSERT INTO meta.quality_results (
          check_id, installation_id, run_id, status, message, executed_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
      `,
      [
        params.checkId,
        params.installationId,
        metaRunId,
        params.checkStatus,
        params.message,
        params.timestampUtc,
      ],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// writeMetaLineage
// Writes: meta.datasets (source + target), meta.lineage_edges (1),
//         meta.lineage_columns (0 or 1 if column-level attributes present)
// ---------------------------------------------------------------------------

export interface MetaLineageParams {
  installationId: string;
  externalRunId: string;
  sourceEntity: string; // input_entity
  targetEntity: string; // output_entity
  sourceType: string | null;
  targetType: string | null;
  sourceAttribute: string | null;
  targetAttribute: string | null;
  sourceSystem: string | null;
  sourceLayer?: string | null; // logische pipelinelaag bron (OpenLineage: namespace)
  targetLayer?: string | null; // logische pipelinelaag doel
  timestampUtc: string;
}

export async function writeMetaLineage(
  pool: Pool,
  params: MetaLineageParams,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Resolve meta.runs UUID (best-effort; may not exist yet)
    const runRes = await client.query(
      `
        SELECT run_id
        FROM meta.runs
        WHERE installation_id = $1
          AND external_run_id = $2
        ORDER BY started_at DESC
        LIMIT 1
      `,
      [params.installationId, params.externalRunId],
    );
    const metaRunId: string | null =
      (runRes.rows[0]?.run_id as string | undefined) ?? null;

    // 1. Upsert source dataset (LADR-058: layer-scoped dataset_id)
    const sourcePlatform = normalizePlatform(params.sourceType);
    const sourceObjectName = extractObjectName(params.sourceEntity);
    const sourceNamespace = extractNamespace(params.sourceEntity);
    const sourceLayer = params.sourceLayer ?? extractLayerFromFqn(params.sourceEntity);
    const sourceScopedId = layerScopedId(params.sourceEntity, sourceLayer);
    await client.query(
      `
        INSERT INTO meta.datasets (
          dataset_id, installation_id, fqn, namespace, object_name,
          platform, entity_type, source_system, layer, group_id
        ) VALUES ($1, $2, $3, $4, $5, $6, 'TABLE', $7, $8, $3)
        ON CONFLICT (installation_id, dataset_id) DO UPDATE
          SET last_seen_at  = now(),
              source_system = COALESCE(EXCLUDED.source_system, meta.datasets.source_system)
      `,
      [
        sourceScopedId,
        params.installationId,
        params.sourceEntity,
        sourceNamespace,
        sourceObjectName,
        sourcePlatform,
        params.sourceSystem,
        sourceLayer,
      ],
    );

    // 2. Upsert target dataset (LADR-058: layer-scoped dataset_id)
    const targetPlatform = normalizePlatform(params.targetType);
    const targetObjectName = extractObjectName(params.targetEntity);
    const targetNamespace = extractNamespace(params.targetEntity);
    const targetLayer = params.targetLayer ?? extractLayerFromFqn(params.targetEntity);
    const targetScopedId = layerScopedId(params.targetEntity, targetLayer);
    await client.query(
      `
        INSERT INTO meta.datasets (
          dataset_id, installation_id, fqn, namespace, object_name,
          platform, entity_type, source_system, layer, group_id
        ) VALUES ($1, $2, $3, $4, $5, $6, 'TABLE', NULL, $7, $3)
        ON CONFLICT (installation_id, dataset_id) DO UPDATE
          SET last_seen_at = now()
      `,
      [
        targetScopedId,
        params.installationId,
        params.targetEntity,
        targetNamespace,
        targetObjectName,
        targetPlatform,
        targetLayer,
      ],
    );

    // 3. Upsert lineage edge (layer-scoped source en target)
    await client.query(
      `
        INSERT INTO meta.lineage_edges (
          installation_id, source_dataset_id, target_dataset_id,
          first_observed_run, last_observed_run,
          first_observed_at, last_observed_at, observation_count
        ) VALUES ($1, $2, $3, $4, $4, $5, $5, 1)
        ON CONFLICT (installation_id, source_dataset_id, target_dataset_id) DO UPDATE
          SET last_observed_run  = EXCLUDED.last_observed_run,
              last_observed_at   = EXCLUDED.last_observed_at,
              observation_count  = meta.lineage_edges.observation_count + 1
      `,
      [
        params.installationId,
        sourceScopedId,
        targetScopedId,
        metaRunId,
        params.timestampUtc,
      ],
    );

    // 4. Upsert run_io voor INPUT (bron) en OUTPUT (doel) zodat status-rollup werkt
    //    ook voor datasets die alleen via lineage binnenkomen en niet via pipeline-runs.
    if (metaRunId) {
      await client.query(
        `
          INSERT INTO meta.run_io (run_id, installation_id, dataset_id, role, observed_at)
          VALUES ($1, $2, $3, 'INPUT',  $4)
          ON CONFLICT (run_id, dataset_id, role) DO NOTHING
        `,
        [metaRunId, params.installationId, sourceScopedId, params.timestampUtc],
      );
      await client.query(
        `
          INSERT INTO meta.run_io (run_id, installation_id, dataset_id, role, observed_at)
          VALUES ($1, $2, $3, 'OUTPUT', $4)
          ON CONFLICT (run_id, dataset_id, role) DO NOTHING
        `,
        [metaRunId, params.installationId, targetScopedId, params.timestampUtc],
      );
    }

    // 5. Upsert column-level lineage (only when both attributes are present)
    if (params.sourceAttribute && params.targetAttribute) {
      await client.query(
        `
          INSERT INTO meta.lineage_columns (
            installation_id,
            source_dataset_id, source_column,
            target_dataset_id, target_column,
            first_observed_at, last_observed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $6)
          ON CONFLICT (installation_id, source_dataset_id, source_column, target_dataset_id, target_column)
          DO UPDATE SET last_observed_at = EXCLUDED.last_observed_at
        `,
        [
          params.installationId,
          sourceScopedId,
          params.sourceAttribute,
          targetScopedId,
          params.targetAttribute,
          params.timestampUtc,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// writeMetaColumnLineage — LADR-058
// Synchroniseert kolom-niveau lineage van lineage_attributes_current (Databricks)
// naar meta.lineage_columns (Postgres). Gebruikt layer-scoped dataset IDs.
// ---------------------------------------------------------------------------

export interface MetaColumnLineageParams {
  installationId: string;
  sourceName: string;   // Databricks FQN, bijv. "dev-free.cbsenergie.cbsenergie"
  sourceColumn: string;
  targetName: string;   // Databricks FQN, bijv. "dev-free.cbsenergie.silver_energielabel"
  targetColumn: string;
  sourceLayer: string | null;
  targetLayer: string | null;
  transformationType: string | null; // OpenLineage: "DIRECT" | "INDIRECT" | "UNKNOWN"
}

const OL_TRANSFORM_TYPES = new Set(["DIRECT", "INDIRECT", "UNKNOWN"]);

export async function writeMetaColumnLineage(
  pool: Pool,
  params: MetaColumnLineageParams,
): Promise<void> {
  if (!params.sourceColumn || !params.targetColumn) return;

  // Extraheer korte entiteitnaam uit Databricks FQN (laatste segment)
  const sourceEntityName = extractObjectName(params.sourceName);
  const targetEntityName = extractObjectName(params.targetName);
  const sourceScopedId = layerScopedId(sourceEntityName, params.sourceLayer);
  const targetScopedId = layerScopedId(targetEntityName, params.targetLayer);

  // Normaliseer naar OL-vocabulaire
  const transformationType = OL_TRANSFORM_TYPES.has(params.transformationType ?? "")
    ? params.transformationType
    : null;

  const client = await pool.connect();
  try {
    await client.query(
      `
        INSERT INTO meta.lineage_columns (
          installation_id,
          source_dataset_id, source_column,
          target_dataset_id, target_column,
          transformation_type,
          first_observed_at, last_observed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, now(), now())
        ON CONFLICT (installation_id, source_dataset_id, source_column, target_dataset_id, target_column)
        DO UPDATE SET
          last_observed_at   = now(),
          transformation_type = COALESCE(EXCLUDED.transformation_type, meta.lineage_columns.transformation_type)
      `,
      [
        params.installationId,
        sourceScopedId,
        params.sourceColumn,
        targetScopedId,
        params.targetColumn,
        transformationType,
      ],
    );
  } finally {
    client.release();
  }
}
