-- Migration 050: Dataset schema snapshot history table
-- Purpose: Enable audit trail of schema changes for drift detection

CREATE TABLE IF NOT EXISTS meta.dataset_snapshots (
  snapshot_id BIGSERIAL PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  installation_id TEXT NOT NULL,
  layer TEXT NOT NULL DEFAULT 'unknown',
  object_name TEXT,
  platform TEXT,
  column_count INT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_by TEXT NOT NULL DEFAULT 'run_completion',
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_entity
  ON meta.dataset_snapshots (installation_id, dataset_id, layer, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_source
  ON meta.dataset_snapshots (installation_id, dataset_id, layer, captured_by, captured_at DESC);
