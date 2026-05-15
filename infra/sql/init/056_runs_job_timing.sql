-- 056_runs_job_timing
-- Adds Databricks job run timing and trigger metadata to meta.runs.
-- Fields are sourced from the Databricks Jobs API (jobs.get_run) via the MDCF adapter.

ALTER TABLE meta.runs
  ADD COLUMN IF NOT EXISTS attempt_number    INT,
  ADD COLUMN IF NOT EXISTS queue_duration_ms BIGINT,
  ADD COLUMN IF NOT EXISTS setup_duration_ms BIGINT,
  ADD COLUMN IF NOT EXISTS trigger           TEXT,
  ADD COLUMN IF NOT EXISTS run_page_url      TEXT;
