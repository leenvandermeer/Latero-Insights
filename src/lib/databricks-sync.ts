import { DatabricksAdapter } from "@/lib/adapters/databricks";
import { getPgPool } from "@/lib/insights-saas-db";

const SYNC_INSTALLATION_ID = "databricks-sync";

export interface SyncResult {
  pipeline_runs: number;
  dq_checks: number;
  lineage: number;
}

export async function syncFromDatabricks(range: { from: string; to: string }): Promise<SyncResult> {
  const adapter = new DatabricksAdapter();
  const pool = getPgPool();

  const [runs, checks, hops] = await Promise.all([
    adapter.getPipelineRuns(range),
    adapter.getDataQualityChecks(range),
    adapter.getLineageHops(range),
  ]);

  // Delete existing synced records in the date range before re-inserting
  await Promise.all([
    pool.query(
      `DELETE FROM pipeline_runs WHERE installation_id = $1 AND event_date BETWEEN $2 AND $3`,
      [SYNC_INSTALLATION_ID, range.from, range.to],
    ),
    pool.query(
      `DELETE FROM data_quality_checks WHERE installation_id = $1 AND event_date BETWEEN $2 AND $3`,
      [SYNC_INSTALLATION_ID, range.from, range.to],
    ),
    pool.query(
      `DELETE FROM data_lineage WHERE installation_id = $1 AND event_date BETWEEN $2 AND $3`,
      [SYNC_INSTALLATION_ID, range.from, range.to],
    ),
  ]);

  // Insert pipeline_runs
  for (const run of runs) {
    await pool.query(
      `
        INSERT INTO pipeline_runs (
          event_type, timestamp_utc, dataset_id, source_system, step,
          run_id, run_status, duration_ms, installation_id, environment, payload
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
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

  // Insert data_quality_checks
  for (const check of checks) {
    await pool.query(
      `
        INSERT INTO data_quality_checks (
          event_type, timestamp_utc, dataset_id, step, run_id,
          check_id, check_name, check_status, severity, check_category,
          policy_version, message, installation_id, environment, payload
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      `,
      [
        check.event_type || "data_quality_check",
        check.timestamp_utc,
        check.dataset_id,
        check.step || null,
        check.run_id || null,
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

  // Insert data_lineage
  for (const hop of hops) {
    await pool.query(
      `
        INSERT INTO data_lineage (
          event_type, timestamp_utc, dataset_id, step, run_id,
          source_entity, source_type, source_ref, source_attribute,
          target_entity, target_type, target_ref, target_attribute,
          hop_kind, source_system, installation_id, environment,
          schema_version, lineage_evidence, payload
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
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
        hop.source_attribute ?? null,
        hop.target_entity,
        hop.target_type || null,
        hop.target_ref || null,
        hop.target_attribute ?? null,
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
