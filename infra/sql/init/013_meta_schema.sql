-- LADR-040: meta.* schema — gestructureerd operationeel datamodel
-- Exclusief schrijf- en leesschema na afronding van de migratie (LADR-041).
-- public.pipeline_runs, public.data_quality_checks, public.data_lineage zijn verwijderd.

CREATE SCHEMA IF NOT EXISTS meta;

-- ---------------------------------------------------------------------------
-- meta.datasets — Catalog van bekende data-assets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.datasets (
  dataset_id        TEXT        NOT NULL,
  installation_id   TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  fqn               TEXT        NOT NULL,
  namespace         TEXT        NOT NULL,
  object_name       TEXT        NOT NULL,
  platform          TEXT        NOT NULL DEFAULT 'UNKNOWN',
  entity_type       TEXT        NOT NULL DEFAULT 'TABLE',
  source_system     TEXT,
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (installation_id, dataset_id),
  CONSTRAINT meta_datasets_platform_check
    CHECK (platform IN ('ICEBERG','DELTA','HIVE','JDBC','FILE','TOPIC','UNKNOWN')),
  CONSTRAINT meta_datasets_entity_type_check
    CHECK (entity_type IN ('TABLE','VIEW','STREAM','FILE','TOPIC'))
);

CREATE INDEX IF NOT EXISTS idx_meta_datasets_fqn
  ON meta.datasets (installation_id, fqn);

-- ---------------------------------------------------------------------------
-- meta.jobs — Pipeline/job definities (stabiel)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.jobs (
  job_id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  job_name        TEXT        NOT NULL,
  job_type        TEXT        NOT NULL DEFAULT 'PIPELINE',
  dataset_id      TEXT,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id),
  UNIQUE (installation_id, job_name),
  CONSTRAINT meta_jobs_type_check
    CHECK (job_type IN ('PIPELINE','SYNC','VALIDATION'))
);

-- ---------------------------------------------------------------------------
-- meta.runs — Uitvoeringsinstanties van jobs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.runs (
  run_id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  job_id          UUID        NOT NULL REFERENCES meta.jobs (job_id),
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  external_run_id TEXT        NOT NULL,
  parent_run_id   UUID        REFERENCES meta.runs (run_id),
  step            TEXT,
  status          TEXT        NOT NULL,
  environment     TEXT        NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ,
  duration_ms     BIGINT,
  run_date        DATE GENERATED ALWAYS AS ((started_at AT TIME ZONE 'UTC')::date) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id),
  UNIQUE (installation_id, external_run_id, step, run_date),
  CONSTRAINT meta_runs_status_check
    CHECK (status IN ('SUCCESS','FAILED','WARNING','RUNNING'))
);

CREATE INDEX IF NOT EXISTS idx_meta_runs_installation_date
  ON meta.runs (installation_id, run_date DESC);

CREATE INDEX IF NOT EXISTS idx_meta_runs_job_date
  ON meta.runs (job_id, run_date DESC);

-- ---------------------------------------------------------------------------
-- meta.run_io — Welke datasets een run leest (INPUT) of schrijft (OUTPUT)
-- Vervangt het event-aspect van public.data_lineage.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.run_io (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  run_id          UUID        NOT NULL REFERENCES meta.runs (run_id),
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  dataset_id      TEXT        NOT NULL,
  role            TEXT        NOT NULL,
  observed_at     TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (run_id, dataset_id, role),
  CONSTRAINT meta_run_io_role_check
    CHECK (role IN ('INPUT','OUTPUT'))
);

CREATE INDEX IF NOT EXISTS idx_meta_run_io_run
  ON meta.run_io (run_id);

CREATE INDEX IF NOT EXISTS idx_meta_run_io_dataset
  ON meta.run_io (installation_id, dataset_id);

-- ---------------------------------------------------------------------------
-- meta.quality_rules — Check-definities (stabiel, niet per run opgeslagen)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.quality_rules (
  check_id        TEXT        NOT NULL,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  check_name      TEXT,
  check_category  TEXT,
  severity        TEXT        NOT NULL DEFAULT 'MEDIUM',
  check_mode      TEXT,
  policy_version  TEXT,
  dataset_id      TEXT,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (installation_id, check_id),
  CONSTRAINT meta_quality_rules_severity_check
    CHECK (severity IN ('HIGH','MEDIUM','LOW')),
  CONSTRAINT meta_quality_rules_category_check
    CHECK (check_category IS NULL OR check_category IN (
      'schema','accuracy','completeness','freshness','uniqueness','custom'
    ))
);

-- ---------------------------------------------------------------------------
-- meta.quality_results — Check-resultaten per run
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.quality_results (
  result_id       UUID        NOT NULL DEFAULT gen_random_uuid(),
  check_id        TEXT        NOT NULL,
  installation_id TEXT        NOT NULL,
  run_id          UUID        REFERENCES meta.runs (run_id),
  status          TEXT        NOT NULL,
  result_value    NUMERIC,
  threshold_value NUMERIC,
  message         TEXT,
  check_result    TEXT,
  executed_at     TIMESTAMPTZ NOT NULL,
  result_date     DATE GENERATED ALWAYS AS ((executed_at AT TIME ZONE 'UTC')::date) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (result_id),
  FOREIGN KEY (installation_id, check_id) REFERENCES meta.quality_rules (installation_id, check_id),
  UNIQUE (installation_id, check_id, run_id, result_date),
  CONSTRAINT meta_quality_results_status_check
    CHECK (status IN ('SUCCESS','FAILED','WARNING'))
);

CREATE INDEX IF NOT EXISTS idx_meta_quality_results_installation_date
  ON meta.quality_results (installation_id, result_date DESC);

CREATE INDEX IF NOT EXISTS idx_meta_quality_results_check_date
  ON meta.quality_results (installation_id, check_id, result_date DESC);

-- ---------------------------------------------------------------------------
-- meta.lineage_edges — Tabel-niveau lineage graph (upsert-model)
-- Directe query vervangt de 5-staps CTE in getLineageEntitiesFromSaaS.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.lineage_edges (
  edge_id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  installation_id       TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  source_dataset_id     TEXT        NOT NULL,
  target_dataset_id     TEXT        NOT NULL,
  first_observed_run    UUID        REFERENCES meta.runs (run_id),
  last_observed_run     UUID        REFERENCES meta.runs (run_id),
  first_observed_at     TIMESTAMPTZ NOT NULL,
  last_observed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  observation_count     INTEGER     NOT NULL DEFAULT 1,
  PRIMARY KEY (edge_id),
  UNIQUE (installation_id, source_dataset_id, target_dataset_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_lineage_edges_source
  ON meta.lineage_edges (installation_id, source_dataset_id);

CREATE INDEX IF NOT EXISTS idx_meta_lineage_edges_target
  ON meta.lineage_edges (installation_id, target_dataset_id);

-- ---------------------------------------------------------------------------
-- meta.lineage_columns — Kolom-niveau lineage (gescheiden van tabel-lineage)
-- Vervangt impliciet gedrag via nullable source_attribute/target_attribute
-- in public.data_lineage.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.lineage_columns (
  column_edge_id        UUID        NOT NULL DEFAULT gen_random_uuid(),
  installation_id       TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  source_dataset_id     TEXT        NOT NULL,
  source_column         TEXT        NOT NULL,
  target_dataset_id     TEXT        NOT NULL,
  target_column         TEXT        NOT NULL,
  transformation_type   TEXT,
  first_observed_at     TIMESTAMPTZ NOT NULL,
  last_observed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (column_edge_id),
  UNIQUE (installation_id, source_dataset_id, source_column, target_dataset_id, target_column),
  CONSTRAINT meta_lineage_columns_transform_check
    CHECK (transformation_type IS NULL OR transformation_type IN (
      'IDENTITY','AGGREGATION','DERIVED','FILTER','RENAME','UNKNOWN'
    ))
);

CREATE INDEX IF NOT EXISTS idx_meta_lineage_columns_source
  ON meta.lineage_columns (installation_id, source_dataset_id, source_column);

CREATE INDEX IF NOT EXISTS idx_meta_lineage_columns_target
  ON meta.lineage_columns (installation_id, target_dataset_id, target_column);
