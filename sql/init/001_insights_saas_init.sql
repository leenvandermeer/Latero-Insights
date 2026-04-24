-- Latero Insights SaaS bootstrap schema
-- Executed automatically by Postgres image on first container initialization.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS insights_installations (
  installation_id TEXT PRIMARY KEY,
  environment TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL DEFAULT 'pipeline_run',
  timestamp_utc TIMESTAMPTZ NOT NULL,
  event_date DATE GENERATED ALWAYS AS ((timestamp_utc AT TIME ZONE 'UTC')::date) STORED,
  dataset_id TEXT NOT NULL,
  source_system TEXT,
  step TEXT NOT NULL,
  run_id TEXT NOT NULL,
  run_status TEXT NOT NULL,
  duration_ms BIGINT,
  installation_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_quality_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL DEFAULT 'data_quality_check',
  timestamp_utc TIMESTAMPTZ NOT NULL,
  event_date DATE GENERATED ALWAYS AS ((timestamp_utc AT TIME ZONE 'UTC')::date) STORED,
  dataset_id TEXT NOT NULL,
  step TEXT,
  run_id TEXT,
  check_id TEXT NOT NULL,
  check_name TEXT,
  check_status TEXT NOT NULL,
  severity TEXT NOT NULL,
  check_category TEXT,
  policy_version TEXT,
  message TEXT,
  installation_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL DEFAULT 'data_lineage',
  timestamp_utc TIMESTAMPTZ NOT NULL,
  event_date DATE GENERATED ALWAYS AS ((timestamp_utc AT TIME ZONE 'UTC')::date) STORED,
  dataset_id TEXT NOT NULL,
  step TEXT NOT NULL,
  run_id TEXT NOT NULL,
  source_entity TEXT NOT NULL,
  source_type TEXT,
  source_ref TEXT,
  source_attribute TEXT,
  target_entity TEXT NOT NULL,
  target_type TEXT,
  target_ref TEXT,
  target_attribute TEXT,
  hop_kind TEXT NOT NULL DEFAULT 'data_flow',
  source_system TEXT,
  installation_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  schema_version TEXT,
  lineage_evidence TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingest_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,
  installation_id TEXT,
  status_code INTEGER NOT NULL,
  request_body JSONB,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_installation_date
  ON pipeline_runs (installation_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_dataset_date
  ON pipeline_runs (dataset_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_dq_installation_date
  ON data_quality_checks (installation_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_dq_dataset_date
  ON data_quality_checks (dataset_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_lineage_installation_date
  ON data_lineage (installation_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_lineage_dataset_date
  ON data_lineage (dataset_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_lineage_hop_kind
  ON data_lineage (hop_kind);
