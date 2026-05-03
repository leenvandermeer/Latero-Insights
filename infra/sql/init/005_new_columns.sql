-- Add columns introduced by the Databricks meta.* schema snake_case update.
ALTER TABLE pipeline_runs
  ADD COLUMN IF NOT EXISTS job_name TEXT,
  ADD COLUMN IF NOT EXISTS parent_run_id TEXT;

ALTER TABLE data_quality_checks
  ADD COLUMN IF NOT EXISTS check_mode TEXT,
  ADD COLUMN IF NOT EXISTS check_result TEXT,
  ADD COLUMN IF NOT EXISTS parent_run_id TEXT;
