-- migration: 058_runs_dbx_task_fields
-- Adds Databricks multi-task job observability fields to meta.runs.
--
-- dbx_job_run_id  — parent job run ID shared across all tasks in a run
-- dbx_task_run_id — individual task run ID within the multi-task job
-- task_key        — Databricks task key name (e.g. "bronze_to_silver_dbt")
--
-- These fields are optional (NULL for non-Databricks sources) and populated
-- by the Databricks sync adapter from workspace.meta.runs.

ALTER TABLE meta.runs
  ADD COLUMN IF NOT EXISTS dbx_job_run_id  TEXT,
  ADD COLUMN IF NOT EXISTS dbx_task_run_id TEXT,
  ADD COLUMN IF NOT EXISTS task_key        TEXT;

INSERT INTO schema_migrations (version, description)
VALUES (58, 'runs_dbx_task_fields')
ON CONFLICT DO NOTHING;
