import { DatabricksAdapter } from "@/lib/adapters/databricks";
import { getPgPool } from "@/lib/insights-saas-db";

const SYNC_INSTALLATION_ID = "databricks-sync";

export interface SyncResult {
  pipeline_runs: number;
  dq_checks: number;
  lineage: number;
}

function assertDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Date must use YYYY-MM-DD format");
  }
  return value;
}

async function ensureSyncIndexes(): Promise<void> {
  const pool = getPgPool();
  await Promise.all([
    pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_pipeline_runs_sync_key
      ON pipeline_runs (installation_id, run_id, step, event_date)
      WHERE installation_id = 'databricks-sync'
    `),
    pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_dq_checks_sync_key
      ON data_quality_checks (installation_id, check_id, run_id, step, event_date)
      WHERE installation_id = 'databricks-sync'
    `),
    pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_lineage_sync_key
      ON data_lineage (
        installation_id,
        run_id,
        step,
        source_entity,
        target_entity,
        source_attribute,
        target_attribute,
        event_date
      )
      WHERE installation_id = 'databricks-sync'
    `),
  ]);
}

export async function syncFromDatabricks(range: { from: string; to: string }, installationId?: string): Promise<SyncResult> {
  const from = assertDate(range.from);
  const to = assertDate(range.to);

  const adapter = new DatabricksAdapter(installationId);
  const pool = getPgPool();

  await ensureSyncIndexes();

  const [runs, checks, hops] = await Promise.all([
    adapter.getPipelineRuns({ from, to }),
    adapter.getDataQualityChecks({ from, to }),
    adapter.getLineageHops({ from, to }),
  ]);

  // Keep sync scope aligned with requested date range while preserving idempotency.
  await Promise.all([
    pool.query(`DELETE FROM pipeline_runs WHERE installation_id = $1 AND event_date BETWEEN $2 AND $3`, [SYNC_INSTALLATION_ID, from, to]),
    pool.query(`DELETE FROM data_quality_checks WHERE installation_id = $1 AND event_date BETWEEN $2 AND $3`, [SYNC_INSTALLATION_ID, from, to]),
    pool.query(`DELETE FROM data_lineage WHERE installation_id = $1 AND event_date BETWEEN $2 AND $3`, [SYNC_INSTALLATION_ID, from, to]),
  ]);

  for (const run of runs) {
    await pool.query(
      `
        INSERT INTO pipeline_runs (
          event_type, timestamp_utc, dataset_id, source_system, step,
          run_id, run_status, duration_ms, installation_id, environment, payload
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (installation_id, run_id, step, event_date)
        WHERE installation_id = 'databricks-sync'
        DO UPDATE SET
          event_type = EXCLUDED.event_type,
          timestamp_utc = EXCLUDED.timestamp_utc,
          dataset_id = EXCLUDED.dataset_id,
          source_system = EXCLUDED.source_system,
          run_status = EXCLUDED.run_status,
          duration_ms = EXCLUDED.duration_ms,
          environment = EXCLUDED.environment,
          payload = EXCLUDED.payload
      `,
      [
        run.event_type || "pipeline_run",
        run.timestamp_utc,
        run.dataset_id,
        run.source_system || null,
        run.step,
        run.run_id,
        run.run_status,
        run.duration_ms ?? null,
        SYNC_INSTALLATION_ID,
        run.environment || "",
        "{}",
      ],
    );
  }

  for (const check of checks) {
    const step = check.step || "";
    const runId = check.run_id || "";

    await pool.query(
      `
        INSERT INTO data_quality_checks (
          event_type, timestamp_utc, dataset_id, step, run_id,
          check_id, check_name, check_status, severity, check_category,
          policy_version, message, installation_id, environment, payload
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (installation_id, check_id, run_id, step, event_date)
        WHERE installation_id = 'databricks-sync'
        DO UPDATE SET
          event_type = EXCLUDED.event_type,
          timestamp_utc = EXCLUDED.timestamp_utc,
          dataset_id = EXCLUDED.dataset_id,
          check_name = EXCLUDED.check_name,
          check_status = EXCLUDED.check_status,
          severity = EXCLUDED.severity,
          check_category = EXCLUDED.check_category,
          policy_version = EXCLUDED.policy_version,
          message = EXCLUDED.message,
          environment = EXCLUDED.environment,
          payload = EXCLUDED.payload
      `,
      [
        check.event_type || "data_quality_check",
        check.timestamp_utc,
        check.dataset_id,
        step,
        runId,
        check.check_id,
        check.check_id, // check_name defaults to check_id for synced records
        check.check_status,
        "medium", // severity not available in Databricks source; default to medium
        check.check_category ?? null,
        check.policy_version ?? null,
        null,
        SYNC_INSTALLATION_ID,
        "", // environment not always present in DQ checks from Databricks
        "{}",
      ],
    );
  }

  for (const hop of hops) {
    const sourceAttribute = hop.source_attribute ?? "";
    const targetAttribute = hop.target_attribute ?? "";

    await pool.query(
      `
        INSERT INTO data_lineage (
          event_type, timestamp_utc, dataset_id, step, run_id,
          source_entity, source_type, source_ref, source_attribute,
          target_entity, target_type, target_ref, target_attribute,
          hop_kind, source_system, installation_id, environment,
          schema_version, lineage_evidence, payload
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        ON CONFLICT (
          installation_id,
          run_id,
          step,
          source_entity,
          target_entity,
          source_attribute,
          target_attribute,
          event_date
        )
        WHERE installation_id = 'databricks-sync'
        DO UPDATE SET
          event_type = EXCLUDED.event_type,
          timestamp_utc = EXCLUDED.timestamp_utc,
          dataset_id = EXCLUDED.dataset_id,
          source_type = EXCLUDED.source_type,
          source_ref = EXCLUDED.source_ref,
          target_type = EXCLUDED.target_type,
          target_ref = EXCLUDED.target_ref,
          hop_kind = EXCLUDED.hop_kind,
          source_system = EXCLUDED.source_system,
          environment = EXCLUDED.environment,
          schema_version = EXCLUDED.schema_version,
          lineage_evidence = EXCLUDED.lineage_evidence,
          payload = EXCLUDED.payload
      `,
      [
        hop.event_type || "data_lineage",
        hop.timestamp_utc,
        hop.dataset_id,
        hop.step,
        hop.run_id,
        hop.source_entity,
        hop.source_type || null,
        hop.source_ref || null,
        sourceAttribute,
        hop.target_entity,
        hop.target_type || null,
        hop.target_ref || null,
        targetAttribute,
        hop.hop_kind || "data_flow",
        hop.source_system ?? null,
        SYNC_INSTALLATION_ID,
        hop.environment || "",
        hop.schema_version ?? null,
        hop.lineage_evidence ?? null,
        "{}",
      ],
    );
  }

  return {
    pipeline_runs: runs.length,
    dq_checks: checks.length,
    lineage: hops.length,
  };
}
