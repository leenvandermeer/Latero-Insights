-- LADR-072 / WP-104: Trust Score Snapshots — data model

CREATE TABLE IF NOT EXISTS meta.trust_score_snapshots (
  id              BIGSERIAL   PRIMARY KEY,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  product_id      TEXT        NOT NULL,
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  score           SMALLINT    NOT NULL CHECK (score BETWEEN 0 AND 100),
  factors         JSONB       NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trust_snapshots_product
  ON meta.trust_score_snapshots (installation_id, product_id, calculated_at DESC);
