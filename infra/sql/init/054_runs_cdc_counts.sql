-- 054 — CDC row counts voor meta.runs (LADR-080)
--
-- Voegt vier optionele tellerkolommen toe aan meta.runs zodat pipeline runs
-- hun Change Data Capture statistieken kunnen rapporteren via de API push route
-- en via de Databricks sync-route (DESCRIBE HISTORY operationMetrics).
--
-- Alle kolommen zijn nullable: NULL betekent "niet gerapporteerd door de bron",
-- niet "nul rijen". Dit onderscheid is belangrijk voor monitoring en auditing.
--
-- API push: pipeline_run event accepteert rows_inserted / rows_updated /
--           rows_deleted / rows_total als optionele velden.
-- Databricks sync: DESCRIBE HISTORY levert numTargetRowsInserted etc. per
--                  table version; sync-route mapt die op deze kolommen.

ALTER TABLE meta.runs
  ADD COLUMN IF NOT EXISTS rows_inserted BIGINT,
  ADD COLUMN IF NOT EXISTS rows_updated  BIGINT,
  ADD COLUMN IF NOT EXISTS rows_deleted  BIGINT,
  ADD COLUMN IF NOT EXISTS rows_total    BIGINT;

COMMENT ON COLUMN meta.runs.rows_inserted IS
  'Rijen toegevoegd in deze run (CDC). NULL = niet gerapporteerd.';
COMMENT ON COLUMN meta.runs.rows_updated IS
  'Rijen gewijzigd in deze run (CDC). NULL = niet gerapporteerd.';
COMMENT ON COLUMN meta.runs.rows_deleted IS
  'Rijen verwijderd in deze run (CDC). NULL = niet gerapporteerd.';
COMMENT ON COLUMN meta.runs.rows_total IS
  'Totaal rijen in de output-dataset na deze run. NULL = niet gerapporteerd.';
