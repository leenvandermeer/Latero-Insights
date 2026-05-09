-- LADR-069 / WP-101: Temporeel Metadata Fundament
-- Voegt valid_from / valid_to toe aan kern-entiteiten zodat historische
-- snapshots kunnen worden bewaard. Updates worden inserts; oude rijen
-- krijgen valid_to = now(). Huidige rijen hebben valid_to IS NULL.

-- ---------------------------------------------------------------------------
-- meta.data_products
-- ---------------------------------------------------------------------------
ALTER TABLE meta.data_products
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS valid_to   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_data_products_temporal
  ON meta.data_products (installation_id, valid_from, valid_to);

-- ---------------------------------------------------------------------------
-- meta.entities
-- ---------------------------------------------------------------------------
ALTER TABLE meta.entities
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS valid_to   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_entities_temporal
  ON meta.entities (installation_id, valid_from, valid_to);

-- ---------------------------------------------------------------------------
-- meta.datasets
-- ---------------------------------------------------------------------------
ALTER TABLE meta.datasets
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS valid_to   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_datasets_temporal
  ON meta.datasets (installation_id, valid_from, valid_to);
