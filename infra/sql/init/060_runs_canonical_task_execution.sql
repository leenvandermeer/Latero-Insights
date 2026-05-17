-- 060_runs_canonical_task_execution.sql
-- Breaking change: reduce meta.runs to a minimal generic task-execution model.
-- Databricks-specific timing/context fields are removed from dedicated columns;
-- sources should keep extra context in run_facets and map source task identity
-- to external_run_id + task_name + source_parent_run_id.

ALTER TABLE meta.runs
  DROP CONSTRAINT IF EXISTS meta_runs_installation_id_external_run_id_run_date_key,
  DROP CONSTRAINT IF EXISTS meta_runs_installation_id_external_run_id_step_run_date_key,
  DROP CONSTRAINT IF EXISTS meta_runs_installation_id_external_run_id_task_name_run_date_key;

ALTER TABLE meta.runs
  ADD COLUMN IF NOT EXISTS source_parent_run_id TEXT,
  ADD COLUMN IF NOT EXISTS task_name TEXT;

UPDATE meta.runs
SET task_name = COALESCE(NULLIF(task_name, ''), NULLIF(task_key, ''), NULLIF(external_run_id, ''), 'unknown-task')
WHERE task_name IS NULL OR task_name = '';

ALTER TABLE meta.runs
  ALTER COLUMN task_name SET NOT NULL;

UPDATE meta.runs
SET source_parent_run_id = COALESCE(source_parent_run_id, dbx_job_run_id)
WHERE source_parent_run_id IS NULL;

ALTER TABLE meta.runs
  DROP COLUMN IF EXISTS parent_run_id,
  DROP COLUMN IF EXISTS dbx_job_run_id,
  DROP COLUMN IF EXISTS dbx_task_run_id,
  DROP COLUMN IF EXISTS task_key,
  DROP COLUMN IF EXISTS attempt_number,
  DROP COLUMN IF EXISTS queue_duration_ms,
  DROP COLUMN IF EXISTS setup_duration_ms,
  DROP COLUMN IF EXISTS trigger,
  DROP COLUMN IF EXISTS run_page_url;

ALTER TABLE meta.runs
  ADD CONSTRAINT meta_runs_installation_id_external_run_id_task_name_run_date_key
  UNIQUE (installation_id, external_run_id, task_name, run_date);
