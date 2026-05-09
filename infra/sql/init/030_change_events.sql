-- LADR-074 / WP-203: Change Intelligence — change event log

CREATE TABLE IF NOT EXISTS meta.change_events (
  id              BIGSERIAL   PRIMARY KEY,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  change_type     TEXT        NOT NULL,
  -- schema_drift | contract_drift | ownership_drift | statistical_drift | lineage_drift
  severity        TEXT        NOT NULL
                              CHECK (severity IN ('informational','significant','breaking')),
  entity_type     TEXT        CHECK (entity_type IN ('product','entity','dataset')),
  entity_id       TEXT,
  diff            JSONB       NOT NULL,  -- { before, after, affected_fields }
  risk_assessment JSONB,                 -- { level, affected_outputs, recommended_action }
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_change_events_entity
  ON meta.change_events (installation_id, entity_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_change_events_type
  ON meta.change_events (installation_id, change_type, severity, detected_at DESC);
