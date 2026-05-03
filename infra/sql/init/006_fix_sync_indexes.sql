-- Replace partial unique indexes (WHERE installation_id = 'databricks-sync') with
-- regular unique indexes so synced rows can use any installation_id, not just the
-- legacy 'databricks-sync' fallback. The ON CONFLICT clauses in databricks-sync.ts
-- no longer carry a WHERE predicate and require a full unique index to match on.

DROP INDEX IF EXISTS uq_pipeline_runs_sync_key;
DROP INDEX IF EXISTS uq_dq_checks_sync_key;
DROP INDEX IF EXISTS uq_lineage_sync_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pipeline_runs_sync_key
  ON pipeline_runs (installation_id, run_id, step, event_date);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dq_checks_sync_key
  ON data_quality_checks (installation_id, check_id, run_id, step, event_date);

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
  );
