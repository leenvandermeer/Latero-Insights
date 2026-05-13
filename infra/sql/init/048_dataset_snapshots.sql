-- Migration 048: Dataset schema snapshot history table
-- Purpose: Enable audit trail of schema changes for drift detection
-- LADR-077 Phase 2b: Schema snapshot history for historical comparison

-- Create snapshot table: captures dataset state at meaningful points (e.g., after run completion)
CREATE TABLE IF NOT EXISTS meta.dataset_snapshots (
  snapshot_id BIGSERIAL PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  installation_id TEXT NOT NULL,
  layer TEXT NOT NULL DEFAULT 'unknown',
  object_name TEXT,
  platform TEXT,
  column_count INT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_by TEXT NOT NULL DEFAULT 'run_completion',  -- run_completion | dq_check | api
  payload JSONB,  -- Optional: extended schema metadata (columns, types, etc.)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for typical query: "get all snapshots for a dataset ordered by time"
CREATE INDEX IF NOT EXISTS idx_snapshots_entity
  ON meta.dataset_snapshots (installation_id, dataset_id, layer, captured_at DESC);

-- Index for filtering by captured_by (to find snapshots from specific source)
CREATE INDEX IF NOT EXISTS idx_snapshots_source
  ON meta.dataset_snapshots (installation_id, dataset_id, layer, captured_by, captured_at DESC);

-- Index for retention policy queries (cleanup old snapshots)
CREATE INDEX IF NOT EXISTS idx_snapshots_age
  ON meta.dataset_snapshots (captured_at DESC)
  WHERE captured_at < now() - INTERVAL '90 days';

-- Add check constraint to validate captured_by is one of known sources
ALTER TABLE meta.dataset_snapshots ADD CONSTRAINT check_captured_by
  CHECK (captured_by IN ('run_completion', 'dq_check', 'api'))
  NOT VALID;

-- View: Latest snapshot per dataset (for quick access to current schema state)
CREATE OR REPLACE VIEW meta.dataset_latest_snapshots AS
SELECT DISTINCT ON (installation_id, dataset_id, layer)
  snapshot_id,
  dataset_id,
  installation_id,
  layer,
  object_name,
  platform,
  column_count,
  captured_at,
  captured_by,
  payload
FROM meta.dataset_snapshots
ORDER BY installation_id, dataset_id, layer, captured_at DESC;

-- View: Schema history per dataset for audit trail
CREATE OR REPLACE VIEW meta.dataset_schema_history AS
SELECT
  installation_id,
  dataset_id,
  layer,
  snapshot_id,
  object_name,
  column_count,
  platform,
  captured_at,
  captured_by,
  -- Compare with previous snapshot to detect changes
  LAG(object_name) OVER (
    PARTITION BY installation_id, dataset_id, layer
    ORDER BY captured_at
  ) AS prev_object_name,
  LAG(column_count) OVER (
    PARTITION BY installation_id, dataset_id, layer
    ORDER BY captured_at
  ) AS prev_column_count,
  -- Flag if schema changed since last snapshot
  CASE
    WHEN LAG(object_name) OVER (
      PARTITION BY installation_id, dataset_id, layer
      ORDER BY captured_at
    ) IS DISTINCT FROM object_name
    THEN true
    ELSE false
  END AS schema_changed
FROM meta.dataset_snapshots
ORDER BY installation_id, dataset_id, layer, captured_at DESC;
