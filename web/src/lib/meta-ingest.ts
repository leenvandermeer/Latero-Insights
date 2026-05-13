/**
 * meta-ingest.ts — LADR-040: exclusieve schrijflaag naar meta.* schema
 *
 * Elke functie gebruikt een poolclient met expliciete transactie.
 * Publieke event-tabellen zijn verwijderd (LADR-041); dit is het
 * enige schrijfpad voor pipeline-, DQ- en lineage-events.
 */

import type { Pool } from "pg";
import { detectStatisticalDrift, detectSchemaDrift, detectLineageDrift, detectOutputLineageDrift, detectOwnershipDrift, detectContractDrift } from "./change-detection";

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
/** Normaliseert een layer-waarde: lege string of ongeldige waarde → null */
function normalizeLayer(layer: string | null | undefined): string | null {
  const clean = layer?.toLowerCase().trim() || null;
  return PIPELINE_LAYERS.has(clean ?? "") ? clean : null;
}

// ---------------------------------------------------------------------------
// writeMetaPipelineRun
// Writes: meta.datasets (1), meta.jobs (1), meta.runs (1), meta.run_io (1)
// ---------------------------------------------------------------------------

export interface MetaPipelineRunParams {
  installationId: string;
  datasetId: string;
  jobName?: string | null; // LINS-020: native job name van de bron (bijv. Databricks job name)
  sourceSystem: string | null;
  layer?: string | null;
  targetLayer?: string | null; // LADR-058: laag van de output-dataset (voor layer-scoped ID)
  runId: string;
  status: string;
  environment: string;
  timestampUtc: string;
  durationMs: number | null;
}

export async function writeMetaPipelineRun(
  pool: Pool,
  params: MetaPipelineRunParams,
): Promise<void> {
  const isTerminal = params.status !== "RUNNING";
  let capturedJobId: string | null = null;
  let capturedRunUuid: string | null = null;
  let capturedObjectName: string | null = null;
  let capturedPrevObjectName: string | null = null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Entity name = dataset_id as-is from the source — no fabrication.
    const entityName = params.datasetId;
    const layer = normalizeLayer(params.targetLayer ?? params.layer ?? null);

    // Only silver/gold layers represent business entities in medallion architecture.
    // Landing/raw/bronze are physical datasets — no entity record for those.
    const ENTITY_LAYERS = new Set(["silver", "gold"]);
    const isEntityLayer = ENTITY_LAYERS.has(layer ?? "");
    const isContextNode = params.sourceSystem !== null && params.datasetId === params.sourceSystem;
    if (isEntityLayer || isContextNode) {
      await client.query(
        `
          INSERT INTO meta.entities (entity_id, installation_id, entity_name, display_name, source_system, is_context_node)
          VALUES ($1, $2, $1, $1, $3, $4)
          ON CONFLICT (installation_id, entity_id) DO UPDATE
            SET entity_name     = COALESCE(meta.entities.entity_name, EXCLUDED.entity_name),
                source_system   = COALESCE(EXCLUDED.source_system, meta.entities.source_system),
                is_context_node = meta.entities.is_context_node OR EXCLUDED.is_context_node
        `,
        [entityName, params.installationId, params.sourceSystem, isContextNode],
      );
    }

    // 1. Upsert dataset — LINS-021: bare entity name as dataset_id, layer as separate column
    const objectName = extractObjectName(params.datasetId);
    const namespace = extractNamespace(params.datasetId);

    // Read current object_name before upsert so schema drift can compare before/after.
    const prevDatasetRes = await client.query(
      `SELECT object_name FROM meta.datasets WHERE installation_id = $1 AND dataset_id = $2 AND layer = $3`,
      [params.installationId, entityName, layer ?? 'unknown'],
    );
    const prevObjectName: string | null = (prevDatasetRes.rows[0]?.object_name as string | undefined) ?? null;
    capturedPrevObjectName = prevObjectName;
    capturedObjectName = objectName;

    await client.query(
      `
        INSERT INTO meta.datasets (
          dataset_id, installation_id, namespace, object_name,
          platform, entity_type, source_system, layer, entity_id
        ) VALUES ($1, $2, $3, $4, 'UNKNOWN', 'TABLE', $5, $6, $1)
        ON CONFLICT (installation_id, dataset_id, layer) DO UPDATE
          SET last_seen_at  = now(),
              object_name   = EXCLUDED.object_name,
              entity_id     = COALESCE(meta.datasets.entity_id, EXCLUDED.entity_id),
              source_system = COALESCE(EXCLUDED.source_system, meta.datasets.source_system)
      `,
      [entityName, params.installationId, namespace, objectName, params.sourceSystem, layer ?? 'unknown'],
    );

    // Capture schema snapshot for audit trail (LADR-077 Phase 2b)
    // Only for terminal runs to reduce storage; snapshot tied to run completion
    if (isTerminal) {
      await client.query(
        `INSERT INTO meta.dataset_snapshots
         (dataset_id, installation_id, layer, object_name, platform, captured_by)
         VALUES ($1, $2, $3, $4, $5, 'run_completion')`,
        [entityName, params.installationId, layer ?? 'unknown', objectName, 'UNKNOWN'],
      );
    }

    // 2. Upsert job — gebruik native job_name indien aanwezig (LINS-020), anders dataset_id
    const jobName = params.jobName?.trim() || params.datasetId;
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
    capturedJobId = jobId;

    // 3. Upsert run (UPDATE then INSERT to avoid ON CONFLICT on generated column)
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
          AND run_date        = $6
        RETURNING run_id
      `,
      [
        params.status,
        endedAt,
        params.durationMs,
        params.installationId,
        params.runId,
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
            job_id, installation_id, external_run_id,
            status, environment, started_at, ended_at, duration_ms
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT DO NOTHING
          RETURNING run_id
        `,
        [
          jobId,
          params.installationId,
          params.runId,
          params.status,
          params.environment,
          params.timestampUtc,
          endedAt,
          params.durationMs,
        ],
      );
      runUuid = insertResult.rows[0].run_id as string;
    }
    capturedRunUuid = runUuid;

    // 4. Upsert run_io (OUTPUT for the target dataset)
    await client.query(
      `
        INSERT INTO meta.run_io (run_id, installation_id, dataset_id, layer, role, observed_at)
        VALUES ($1, $2, $3, $4, 'OUTPUT', $5)
        ON CONFLICT (run_id, dataset_id, layer, role) DO NOTHING
      `,
      [runUuid, params.installationId, entityName, layer ?? 'unknown', params.timestampUtc],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Fire-and-forget: drift detection after terminal runs.
  // Runs asynchronously so it never blocks or errors the ingest path.
  if (isTerminal) {
    void detectStatisticalDrift(params.datasetId, params.installationId).catch(() => {});

    if (capturedPrevObjectName !== null && capturedObjectName !== capturedPrevObjectName) {
      void detectSchemaDrift(
        params.datasetId,
        params.installationId,
        { object_name: capturedPrevObjectName },
        { object_name: capturedObjectName },
      ).catch(() => {});
    }

    if (capturedJobId && capturedRunUuid) {
      void detectLineageDrift(capturedJobId, capturedRunUuid, params.installationId).catch(() => {});
      void detectOutputLineageDrift(capturedJobId, capturedRunUuid, params.installationId).catch(() => {});
    }
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

    // 1. Upsert dataset (DQ checks may not carry a layer — use 'unknown')
    const objectName = extractObjectName(params.datasetId);
    const namespace = extractNamespace(params.datasetId);
    await client.query(
      `
        INSERT INTO meta.datasets (
          dataset_id, installation_id, namespace, object_name, platform, entity_type, layer
        ) VALUES ($1, $2, $3, $4, 'UNKNOWN', 'TABLE', 'unknown')
        ON CONFLICT (installation_id, dataset_id, layer) DO UPDATE
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

    // 1. Upsert source dataset — LINS-021: bare entity name, layer as separate column
    const sourcePlatform = normalizePlatform(params.sourceType);
    const sourceObjectName = extractObjectName(params.sourceEntity);
    const sourceNamespace = extractNamespace(params.sourceEntity);
    const sourceLayer = normalizeLayer(params.sourceLayer ?? null) ?? 'unknown';
    await client.query(
      `
        INSERT INTO meta.datasets (
          dataset_id, installation_id, namespace, object_name,
          platform, entity_type, source_system, layer
        ) VALUES ($1, $2, $3, $4, $5, 'TABLE', $6, $7)
        ON CONFLICT (installation_id, dataset_id, layer) DO UPDATE
          SET last_seen_at  = now(),
              source_system = COALESCE(EXCLUDED.source_system, meta.datasets.source_system)
      `,
      [
        params.sourceEntity,
        params.installationId,
        sourceNamespace,
        sourceObjectName,
        sourcePlatform,
        params.sourceSystem,
        sourceLayer,
      ],
    );

    // 2. Upsert target dataset — LINS-021: bare entity name, layer as separate column
    const targetPlatform = normalizePlatform(params.targetType);
    const targetObjectName = extractObjectName(params.targetEntity);
    const targetNamespace = extractNamespace(params.targetEntity);
    const targetLayer = normalizeLayer(params.targetLayer ?? null) ?? 'unknown';
    await client.query(
      `
        INSERT INTO meta.datasets (
          dataset_id, installation_id, namespace, object_name,
          platform, entity_type, source_system, layer
        ) VALUES ($1, $2, $3, $4, $5, 'TABLE', NULL, $6)
        ON CONFLICT (installation_id, dataset_id, layer) DO UPDATE
          SET last_seen_at = now()
      `,
      [
        params.targetEntity,
        params.installationId,
        targetNamespace,
        targetObjectName,
        targetPlatform,
        targetLayer,
      ],
    );

    // 3. Upsert lineage edge — LADR-064: source_kind / target_kind op basis van layer
    const sourceKind = ["silver", "gold"].includes(sourceLayer) ? "entity" : "dataset";
    const targetKind = ["silver", "gold"].includes(targetLayer) ? "entity" : "dataset";
    await client.query(
      `
        INSERT INTO meta.lineage_edges (
          installation_id, source_dataset_id, source_layer, target_dataset_id, target_layer,
          first_observed_run, last_observed_run,
          first_observed_at, last_observed_at, observation_count,
          source_kind, target_kind
        ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $7, 1, $8, $9)
        ON CONFLICT (installation_id, source_dataset_id, source_layer, target_dataset_id, target_layer) DO UPDATE
          SET last_observed_run  = EXCLUDED.last_observed_run,
              last_observed_at   = EXCLUDED.last_observed_at,
              observation_count  = meta.lineage_edges.observation_count + 1,
              source_kind        = EXCLUDED.source_kind,
              target_kind        = EXCLUDED.target_kind
      `,
      [
        params.installationId,
        params.sourceEntity,
        sourceLayer,
        params.targetEntity,
        targetLayer,
        metaRunId,
        params.timestampUtc,
        sourceKind,
        targetKind,
      ],
    );

    // 3a. LADR-064: Vul meta.entities voor alle silver/gold targets (entity-nodes)
    if (targetKind === "entity") {
      const targetEntityName = extractObjectName(params.targetEntity);
      await client.query(
        `
          INSERT INTO meta.entities (entity_id, installation_id, entity_name, display_name, source_system)
          VALUES ($1, $2, $3, $3, $4)
          ON CONFLICT (installation_id, entity_id) DO UPDATE
            SET entity_name  = COALESCE(meta.entities.entity_name, EXCLUDED.entity_name),
                display_name = COALESCE(meta.entities.display_name, EXCLUDED.display_name),
                updated_at   = now()
        `,
        [targetEntityName, params.installationId, targetEntityName, params.sourceSystem],
      );
      // Zet entity_id op de target dataset-rij
      await client.query(
        `
          UPDATE meta.datasets
          SET entity_id = $1
          WHERE installation_id = $2
            AND dataset_id = $3
            AND layer = $4
            AND entity_id IS DISTINCT FROM $1
        `,
        [targetEntityName, params.installationId, params.targetEntity, targetLayer],
      );
      // Vul entity_sources alleen voor dataset→entity hops
      if (sourceKind === "dataset") {
        await client.query(
          `
            INSERT INTO meta.entity_sources (
              installation_id, entity_id, source_dataset_id, source_layer,
              first_observed_at, last_observed_at
            ) VALUES ($1, $2, $3, $4, $5, $5)
            ON CONFLICT (installation_id, entity_id, source_dataset_id) DO UPDATE
              SET last_observed_at = EXCLUDED.last_observed_at
          `,
          [
            params.installationId,
            targetEntityName,
            params.sourceEntity,
            sourceLayer,
            params.timestampUtc,
          ],
        );
      }
    }

    // 4. Upsert run_io voor INPUT en OUTPUT
    if (metaRunId) {
      await client.query(
        `
          INSERT INTO meta.run_io (run_id, installation_id, dataset_id, layer, role, observed_at)
          VALUES ($1, $2, $3, $4, 'INPUT', $5)
          ON CONFLICT (run_id, dataset_id, layer, role) DO NOTHING
        `,
        [metaRunId, params.installationId, params.sourceEntity, sourceLayer, params.timestampUtc],
      );
      await client.query(
        `
          INSERT INTO meta.run_io (run_id, installation_id, dataset_id, layer, role, observed_at)
          VALUES ($1, $2, $3, $4, 'OUTPUT', $5)
          ON CONFLICT (run_id, dataset_id, layer, role) DO NOTHING
        `,
        [metaRunId, params.installationId, params.targetEntity, targetLayer, params.timestampUtc],
      );
    }

    // 5. Upsert column-level lineage
    if (params.sourceAttribute && params.targetAttribute) {
      await client.query(
        `
          INSERT INTO meta.lineage_columns (
            installation_id,
            source_dataset_id, source_layer, source_column,
            target_dataset_id, target_layer, target_column,
            first_observed_at, last_observed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
          ON CONFLICT (installation_id, source_dataset_id, source_layer, source_column,
                       target_dataset_id, target_layer, target_column)
          DO UPDATE SET last_observed_at = EXCLUDED.last_observed_at
        `,
        [
          params.installationId,
          params.sourceEntity,
          sourceLayer,
          params.sourceAttribute,
          params.targetEntity,
          targetLayer,
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
  const sourceLayerNorm = normalizeLayer(params.sourceLayer) ?? 'unknown';
  const targetLayerNorm = normalizeLayer(params.targetLayer) ?? 'unknown';

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
          source_dataset_id, source_layer, source_column,
          target_dataset_id, target_layer, target_column,
          transformation_type,
          first_observed_at, last_observed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
        ON CONFLICT (installation_id, source_dataset_id, source_layer, source_column,
                     target_dataset_id, target_layer, target_column)
        DO UPDATE SET
          last_observed_at    = now(),
          transformation_type = COALESCE(EXCLUDED.transformation_type, meta.lineage_columns.transformation_type)
      `,
      [
        params.installationId,
        sourceEntityName,
        sourceLayerNorm,
        params.sourceColumn,
        targetEntityName,
        targetLayerNorm,
        params.targetColumn,
        transformationType,
      ],
    );
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// writeMetaDataProduct
// Upserts a data product record — called via the data_product ingest event.
// Allows Latero runtimes to register/update governance fields without UI.
// ---------------------------------------------------------------------------

export interface MetaDataProductParams {
  installationId: string;
  /** External identifier provided by the caller (Databricks, API event, etc.).
   *  Latero assigns its own internal UUID (data_product_id). The externalId is
   *  stored in the external_id column and used for upsert lookup only.
   *  Never used as the primary key. */
  externalId: string;
  displayName: string;
  description?: string | null;
  owner?: string | null;
  dataSteward?: string | null;
  domain?: string | null;
  classification?: string | null;
  retentionDays?: number | null;
  slaTier?: string | null;
  contractVer?: string | null;
  tags?: Record<string, unknown> | null;
}

const ALLOWED_CLASSIFICATIONS = new Set(["public", "internal", "confidential", "restricted"]);
const ALLOWED_SLA_TIERS = new Set(["bronze", "silver", "gold"]);

export async function writeMetaDataProduct(
  pool: Pool,
  params: MetaDataProductParams,
): Promise<void> {
  const classification = params.classification?.toLowerCase().trim() ?? null;
  const slaTier = params.slaTier?.toLowerCase().trim() ?? null;

  if (classification !== null && !ALLOWED_CLASSIFICATIONS.has(classification)) {
    throw new Error(`classification must be one of: ${[...ALLOWED_CLASSIFICATIONS].join(", ")}`);
  }
  if (slaTier !== null && !ALLOWED_SLA_TIERS.has(slaTier)) {
    throw new Error(`sla_tier must be one of: ${[...ALLOWED_SLA_TIERS].join(", ")}`);
  }

  const client = await pool.connect();
  let capturedDataProductId: string | null = null;
  let capturedPrevOwner: string | null = null;
  let capturedPrevSlaTier: string | null = null;
  let capturedPrevContractVer: string | null = null;

  try {
    // Query previous state before upsert for drift detection (LADR-077 Phase 2a)
    const prevStateRes = await client.query(
      `SELECT data_product_id, owner, sla_tier, contract_ver FROM meta.data_products
       WHERE installation_id = $1 AND external_id = $2 AND valid_to IS NULL
       LIMIT 1`,
      [params.installationId, params.externalId],
    );

    if (prevStateRes.rows.length > 0) {
      capturedDataProductId = prevStateRes.rows[0].data_product_id as string;
      capturedPrevOwner = (prevStateRes.rows[0].owner as string | null) ?? null;
      capturedPrevSlaTier = (prevStateRes.rows[0].sla_tier as string | null) ?? null;
      capturedPrevContractVer = (prevStateRes.rows[0].contract_ver as string | null) ?? null;
    }

    // Upsert by external_id: Latero assigns the internal UUID on first encounter.
    // If a record with this external_id already exists, update metadata only.
    const upsertRes = await client.query(
      `INSERT INTO meta.data_products (
         installation_id, data_product_id, external_id, display_name, description,
         owner, data_steward, domain, classification,
         retention_days, sla_tier, contract_ver, tags,
         valid_from, updated_at
       ) VALUES ($1, gen_random_uuid(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())
       ON CONFLICT (installation_id, external_id) WHERE external_id IS NOT NULL AND valid_to IS NULL DO UPDATE SET
         display_name    = COALESCE(EXCLUDED.display_name,    meta.data_products.display_name),
         description     = COALESCE(EXCLUDED.description,     meta.data_products.description),
         owner           = COALESCE(EXCLUDED.owner,           meta.data_products.owner),
         data_steward    = COALESCE(EXCLUDED.data_steward,    meta.data_products.data_steward),
         domain          = COALESCE(EXCLUDED.domain,          meta.data_products.domain),
         classification  = COALESCE(EXCLUDED.classification,  meta.data_products.classification),
         retention_days  = COALESCE(EXCLUDED.retention_days,  meta.data_products.retention_days),
         sla_tier        = COALESCE(EXCLUDED.sla_tier,        meta.data_products.sla_tier),
         contract_ver    = COALESCE(EXCLUDED.contract_ver,    meta.data_products.contract_ver),
         tags            = CASE
                             WHEN EXCLUDED.tags IS NOT NULL
                             THEN meta.data_products.tags || EXCLUDED.tags
                             ELSE meta.data_products.tags
                           END,
         updated_at      = now()`,
      [
        params.installationId,
        params.externalId,
        params.displayName,
        params.description ?? null,
        params.owner ?? null,
        params.dataSteward ?? null,
        params.domain ?? null,
        classification,
        params.retentionDays ?? null,
        slaTier,
        params.contractVer ?? null,
        params.tags ? JSON.stringify(params.tags) : null,
      ],
    );

    // Capture product ID if this is a new record (INSERT path)
    if (!capturedDataProductId && upsertRes.rowCount === 1) {
      const newProductRes = await client.query(
        `SELECT data_product_id FROM meta.data_products
         WHERE installation_id = $1 AND external_id = $2 AND valid_to IS NULL
         LIMIT 1`,
        [params.installationId, params.externalId],
      );
      capturedDataProductId = (newProductRes.rows[0]?.data_product_id as string | undefined) ?? null;
    }
  } finally {
    client.release();
  }

  // Fire-and-forget drift detection (LADR-077 Phase 2a)
  // Triggers after ingest completes, non-blocking
  if (capturedDataProductId) {
    if (capturedPrevOwner !== params.owner) {
      void detectOwnershipDrift(
        capturedDataProductId,
        params.installationId,
        capturedPrevOwner,
        params.owner ?? null,
      ).catch(() => {});
    }

    if (capturedPrevSlaTier !== slaTier || capturedPrevContractVer !== params.contractVer) {
      void detectContractDrift(
        capturedDataProductId,
        params.installationId,
        { sla: capturedPrevSlaTier, contract_ver: capturedPrevContractVer },
        { sla: slaTier, contract_ver: params.contractVer },
      ).catch(() => {});
    }
  }
}
