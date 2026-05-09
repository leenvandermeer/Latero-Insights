-- LADR-077 / WP-305: Cost & ROI Attribution per data product

CREATE TABLE IF NOT EXISTS meta.product_cost_records (
  id              BIGSERIAL     PRIMARY KEY,
  installation_id TEXT          NOT NULL REFERENCES insights_installations (installation_id),
  product_id      TEXT          NOT NULL,
  period_start    DATE          NOT NULL,
  period_end      DATE          NOT NULL,
  cost_usd        NUMERIC(12,4) NOT NULL,
  cost_breakdown  JSONB,
  -- { "compute": 0.0, "storage": 0.0, "query": 0.0, "other": 0.0 }
  source          TEXT          NOT NULL DEFAULT 'manual',
  -- 'databricks' | 'manual' | 'estimated'
  recorded_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT chk_cost_period CHECK (period_end > period_start),
  CONSTRAINT chk_cost_usd CHECK (cost_usd >= 0),
  CONSTRAINT chk_cost_source CHECK (source IN ('databricks', 'manual', 'estimated'))
);

CREATE INDEX IF NOT EXISTS idx_product_cost_records_product
  ON meta.product_cost_records (installation_id, product_id, period_start DESC);
