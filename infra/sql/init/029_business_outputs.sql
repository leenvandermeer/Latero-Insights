-- LADR-070 / WP-201: Business Impact Graph — data model
-- Business outputs en koppeling naar data producten.

CREATE TABLE IF NOT EXISTS meta.business_outputs (
  id              TEXT        NOT NULL,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  name            TEXT        NOT NULL,
  output_type     TEXT        NOT NULL
                              CHECK (output_type IN ('kpi','dashboard','process','report','risk')),
  owner_team      TEXT,
  criticality     TEXT        NOT NULL DEFAULT 'medium'
                              CHECK (criticality IN ('low','medium','high','critical')),
  description     TEXT,
  PRIMARY KEY (installation_id, id)
);

CREATE INDEX IF NOT EXISTS idx_business_outputs_installation
  ON meta.business_outputs (installation_id, output_type);

-- ---------------------------------------------------------------------------
-- Koppelingen: data product → business output
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.product_output_links (
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  product_id      TEXT        NOT NULL,
  output_id       TEXT        NOT NULL,
  description     TEXT,
  PRIMARY KEY (installation_id, product_id, output_id),
  FOREIGN KEY (installation_id, output_id)
    REFERENCES meta.business_outputs (installation_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_output_links_product
  ON meta.product_output_links (installation_id, product_id);

CREATE INDEX IF NOT EXISTS idx_product_output_links_output
  ON meta.product_output_links (installation_id, output_id);
