-- LADR-076 / WP-303: Evidence Ledger — append-only bewijs-trail per data product

CREATE TABLE IF NOT EXISTS meta.evidence_records (
  id              BIGSERIAL   PRIMARY KEY,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  product_id      TEXT        NOT NULL,
  event_type      TEXT        NOT NULL,
  -- quality_check | transformation | source_snapshot | approval | exception | incident_resolved
  run_id          TEXT,
  payload         JSONB       NOT NULL,
  hash            TEXT        NOT NULL,  -- SHA-256 van payload
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_records_product
  ON meta.evidence_records (installation_id, product_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_records_event_type
  ON meta.evidence_records (installation_id, product_id, event_type, recorded_at DESC);

-- Blokkeer UPDATE en DELETE — evidence is append-only
CREATE OR REPLACE RULE no_update_evidence
  AS ON UPDATE TO meta.evidence_records DO INSTEAD NOTHING;

CREATE OR REPLACE RULE no_delete_evidence
  AS ON DELETE TO meta.evidence_records DO INSTEAD NOTHING;
