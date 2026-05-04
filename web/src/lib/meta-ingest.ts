/**
 * meta-ingest.ts — LADR-040, fase 1: parallel schrijven naar meta.* schema
 *
 * Elke functie gebruikt een poolclient met expliciete transactie.
 * De aanroeper vangt fouten op en logt ze — ze propageren NIET terug
 * naar de adapter (backward compatible parallel write).
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

// ---------------------------------------------------------------------------
// writeMetaPipelineRun
// Writes: meta.datasets (1), meta.jobs (1), meta.runs (1), meta.run_io (1)
// ---------------------------------------------------------------------------

export interface MetaPipelineRunParams {
  installationId: string;
  datasetId: string;
  sourceSystem: string | null;
  runId: string; // external_run_id (text)
  step: string;
  status: string; // SUCCESS | FAILED | WARNING | RUNNING
  environment: string;
  timestampUtc: string; // ISO-8601
  durationMs: number | null;
}

export async function writeMetaPipelineRun(
  pool: Pool,
  params: MetaPipelineRunParams,
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
          dataset_id, installation_id, fqn, namespace, object_name,
          platform, entity_type, source_system
        ) VALUES ($1, $2, $1, $3, $4, 'UNKNOWN', 'TABLE', $5)
        ON CONFLICT (installation_id, dataset_id) DO UPDATE
          SET last_seen_at  = now(),
              source_system = COALESCE(EXCLUDED.source_system, meta.datasets.source_system)
      `,
      [params.datasetId, params.installationId, namespace, objectName, params.sourceSystem],
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

    // 4. Upsert run_io (OUTPUT for the target dataset)
    await client.query(
      `
        INSERT INTO meta.run_io (run_id, installation_id, dataset_id, role, observed_at)
        VALUES ($1, $2, $3, 'OUTPUT', $4)
        ON CONFLICT (run_id, dataset_id, role) DO NOTHING
      `,
      [runUuid, params.installationId, params.datasetId, params.timestampUtc],
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
        params.checkCategory,
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

    // 1. Upsert source dataset
    const sourcePlatform = normalizePlatform(params.sourceType);
    const sourceObjectName = extractObjectName(params.sourceEntity);
    const sourceNamespace = extractNamespace(params.sourceEntity);
    await client.query(
      `
        INSERT INTO meta.datasets (
          dataset_id, installation_id, fqn, namespace, object_name,
          platform, entity_type, source_system
        ) VALUES ($1, $2, $1, $3, $4, $5, 'TABLE', $6)
        ON CONFLICT (installation_id, dataset_id) DO UPDATE
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
      ],
    );

    // 2. Upsert target dataset
    const targetPlatform = normalizePlatform(params.targetType);
    const targetObjectName = extractObjectName(params.targetEntity);
    const targetNamespace = extractNamespace(params.targetEntity);
    await client.query(
      `
        INSERT INTO meta.datasets (
          dataset_id, installation_id, fqn, namespace, object_name,
          platform, entity_type, source_system
        ) VALUES ($1, $2, $1, $3, $4, $5, 'TABLE', $6)
        ON CONFLICT (installation_id, dataset_id) DO UPDATE
          SET last_seen_at  = now(),
              source_system = COALESCE(EXCLUDED.source_system, meta.datasets.source_system)
      `,
      [
        params.targetEntity,
        params.installationId,
        targetNamespace,
        targetObjectName,
        targetPlatform,
        params.sourceSystem,
      ],
    );

    // 3. Upsert lineage edge
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
        params.sourceEntity,
        params.targetEntity,
        metaRunId,
        params.timestampUtc,
      ],
    );

    // 4. Upsert column-level lineage (only when both attributes are present)
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
          params.sourceEntity,
          params.sourceAttribute,
          params.targetEntity,
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
