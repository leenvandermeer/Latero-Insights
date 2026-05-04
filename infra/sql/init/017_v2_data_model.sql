-- LADR-060: V2 data model — data_products, entities, entity_id FK, JSONB facets
-- Datum: 2026-05-04
-- Afhankelijk van: 016_layer_scoped_dataset_ids.sql

-- ---------------------------------------------------------------------------
-- 1. meta.data_products
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.data_products (
  data_product_id TEXT        NOT NULL,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  display_name    TEXT        NOT NULL,
  description     TEXT,
  owner           TEXT,
  domain          TEXT,
  tags            JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (installation_id, data_product_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_data_products_installation
  ON meta.data_products (installation_id);

-- ---------------------------------------------------------------------------
-- 2. meta.entities
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.entities (
  entity_id       TEXT        NOT NULL,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  data_product_id TEXT,
  display_name    TEXT,
  description     TEXT,
  source_system   TEXT,
  owner           TEXT,
  tags            JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (installation_id, entity_id),
  CONSTRAINT meta_entities_data_product_fk
    FOREIGN KEY (installation_id, data_product_id)
    REFERENCES meta.data_products (installation_id, data_product_id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_meta_entities_installation
  ON meta.entities (installation_id);
CREATE INDEX IF NOT EXISTS idx_meta_entities_data_product
  ON meta.entities (installation_id, data_product_id);

-- ---------------------------------------------------------------------------
-- 3. meta.datasets: entity_id FK kolom
-- ---------------------------------------------------------------------------
ALTER TABLE meta.datasets
  ADD COLUMN IF NOT EXISTS entity_id TEXT;

-- Soft FK (geen REFERENCES om bootstrap te vereenvoudigen — entity kan later toegevoegd worden)
CREATE INDEX IF NOT EXISTS idx_meta_datasets_entity
  ON meta.datasets (installation_id, entity_id);

-- ---------------------------------------------------------------------------
-- 4. meta.runs: run_facets JSONB
-- ---------------------------------------------------------------------------
ALTER TABLE meta.runs
  ADD COLUMN IF NOT EXISTS run_facets JSONB;

-- ---------------------------------------------------------------------------
-- 5. meta.datasets: dataset_facets JSONB
-- ---------------------------------------------------------------------------
ALTER TABLE meta.datasets
  ADD COLUMN IF NOT EXISTS dataset_facets JSONB;

-- ---------------------------------------------------------------------------
-- 6. Bootstrap: vul meta.entities vanuit bestaande meta.datasets (group_id = entity)
--    group_id is gevuld door 016-migratie: bare entiteitnaam (bijv. "cbs_arbeid")
-- ---------------------------------------------------------------------------
INSERT INTO meta.entities (entity_id, installation_id, display_name, source_system)
SELECT DISTINCT
  d.group_id            AS entity_id,
  d.installation_id,
  d.group_id            AS display_name,
  d.source_system
FROM meta.datasets d
WHERE d.group_id IS NOT NULL
ON CONFLICT (installation_id, entity_id) DO UPDATE
  SET display_name  = COALESCE(EXCLUDED.display_name, meta.entities.display_name),
      source_system = COALESCE(EXCLUDED.source_system, meta.entities.source_system),
      updated_at    = now();

-- ---------------------------------------------------------------------------
-- 7. Bootstrap: vul meta.data_products vanuit group_id
--    Eén data product per unieke group_id per installatie
-- ---------------------------------------------------------------------------
INSERT INTO meta.data_products (data_product_id, installation_id, display_name)
SELECT DISTINCT
  d.group_id            AS data_product_id,
  d.installation_id,
  d.group_id            AS display_name
FROM meta.datasets d
WHERE d.group_id IS NOT NULL
ON CONFLICT (installation_id, data_product_id) DO UPDATE
  SET display_name = COALESCE(EXCLUDED.display_name, meta.data_products.display_name),
      updated_at   = now();

-- ---------------------------------------------------------------------------
-- 8. Bootstrap: koppel entities aan data_products (zelfde group_id)
-- ---------------------------------------------------------------------------
UPDATE meta.entities e
SET data_product_id = e.entity_id
WHERE e.data_product_id IS NULL
  AND EXISTS (
    SELECT 1 FROM meta.data_products dp
    WHERE dp.installation_id = e.installation_id
      AND dp.data_product_id = e.entity_id
  );

-- ---------------------------------------------------------------------------
-- 9. Bootstrap: koppel datasets aan entities via group_id
-- ---------------------------------------------------------------------------
UPDATE meta.datasets d
SET entity_id = d.group_id
WHERE d.entity_id IS NULL
  AND d.group_id IS NOT NULL;
