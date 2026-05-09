-- LADR-073 / WP-205: Demand-Side Visibility — consumer-registratie en usage tracking

CREATE TABLE IF NOT EXISTS meta.product_consumers (
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  product_id      TEXT        NOT NULL,
  consumer_id     TEXT        NOT NULL,
  consumer_type   TEXT        NOT NULL
                              CHECK (consumer_type IN ('team','system','person')),
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (installation_id, product_id, consumer_id)
);

CREATE INDEX IF NOT EXISTS idx_product_consumers_product
  ON meta.product_consumers (installation_id, product_id);

-- ---------------------------------------------------------------------------
-- Usage events — append-only, geen deletes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.product_usage_events (
  id              BIGSERIAL   PRIMARY KEY,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  product_id      TEXT        NOT NULL,
  consumer_id     TEXT,
  accessed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_usage_events_product
  ON meta.product_usage_events (installation_id, product_id, accessed_at DESC);

-- ---------------------------------------------------------------------------
-- Contract-aanvragen
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.contract_requests (
  id              BIGSERIAL   PRIMARY KEY,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  product_id      TEXT        NOT NULL,
  consumer_id     TEXT        NOT NULL,
  requirements    JSONB       NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','approved','declined')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     TEXT
);

CREATE INDEX IF NOT EXISTS idx_contract_requests_product
  ON meta.contract_requests (installation_id, product_id, status);
