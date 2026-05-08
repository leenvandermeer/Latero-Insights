-- 023_drop_runs_step.sql
-- Remove step column from meta.runs.
-- The step field was used as a pipeline phase label (e.g. landing_to_raw).
-- It is no longer written by any ingest path and is superseded by the
-- layer column on meta.datasets which carries the same information
-- in a normalized, queryable form.
--
-- The old UNIQUE constraint included step; replace it with one that does not.

ALTER TABLE meta.runs DROP CONSTRAINT IF EXISTS meta_runs_installation_id_external_run_id_step_run_date_key;

ALTER TABLE meta.runs DROP COLUMN IF EXISTS step;

ALTER TABLE meta.runs
  ADD CONSTRAINT meta_runs_installation_id_external_run_id_run_date_key
  UNIQUE (installation_id, external_run_id, run_date);
