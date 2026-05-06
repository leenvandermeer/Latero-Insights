-- LADR-064: Dataset vs Entity split — structurele scheiding van fysieke datasets
-- (landing/raw/bronze) en business-entiteiten (silver/gold).
--
-- Wijzigingen:
--   1. meta.datasets.dataset_name  — generated column: bare naam zonder layer
--   2. meta.entities.entity_name   — expliciete NOT NULL leesbare naam
--   3. meta.entity_sources         — bridge-tabel: welke datasets voeden welke entiteiten
--   4. meta.lineage_edges          — source_kind / target_kind type-onderscheid
--
-- Datum: 2026-05-06

-- ---------------------------------------------------------------------------
-- 1. meta.datasets: dataset_name als generated column
--    Bare naam zonder layer: "cbs_arbeid::bronze" → "cbs_arbeid"
-- ---------------------------------------------------------------------------
ALTER TABLE meta.datasets
  ADD COLUMN IF NOT EXISTS dataset_name TEXT
    GENERATED ALWAYS AS (split_part(dataset_id, '::', 1)) STORED;

CREATE INDEX IF NOT EXISTS idx_meta_datasets_name
  ON meta.datasets (installation_id, dataset_name);

-- ---------------------------------------------------------------------------
-- 2. meta.entities: entity_name als expliciete leesbare naam
--    Vult vanuit display_name of entity_id als fallback.
-- ---------------------------------------------------------------------------
ALTER TABLE meta.entities
  ADD COLUMN IF NOT EXISTS entity_name TEXT;

UPDATE meta.entities
  SET entity_name = COALESCE(display_name, entity_id)
  WHERE entity_name IS NULL;

ALTER TABLE meta.entities
  ALTER COLUMN entity_name SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. meta.entity_sources — bridge-tabel voor 1-to-many relaties
--    Een silver/gold entiteit kan worden gevoed door meerdere bronze/silver datasets.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.entity_sources (
  id                UUID        NOT NULL DEFAULT gen_random_uuid(),
  installation_id   TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  entity_id         TEXT        NOT NULL,
  source_dataset_id TEXT        NOT NULL,
  source_layer      TEXT        NOT NULL,
  first_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_observed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (installation_id, entity_id, source_dataset_id),
  CONSTRAINT meta_entity_sources_entity_fk
    FOREIGN KEY (installation_id, entity_id)
    REFERENCES meta.entities (installation_id, entity_id)
    ON DELETE CASCADE,
  CONSTRAINT meta_entity_sources_source_layer_check
    CHECK (source_layer IN ('bronze', 'silver'))
);

CREATE INDEX IF NOT EXISTS idx_meta_entity_sources_entity
  ON meta.entity_sources (installation_id, entity_id);

CREATE INDEX IF NOT EXISTS idx_meta_entity_sources_dataset
  ON meta.entity_sources (installation_id, source_dataset_id);

-- Bootstrap: zorg dat alle silver/gold datasets een entity_id hebben
UPDATE meta.datasets d
  SET entity_id = split_part(d.dataset_id, '::', 1)
  WHERE d.layer IN ('silver', 'gold')
    AND d.entity_id IS NULL;

-- Maak ontbrekende entity records aan voor silver/gold datasets zonder entity entry
INSERT INTO meta.entities (entity_id, installation_id, entity_name, display_name, source_system)
SELECT DISTINCT
  d.entity_id,
  d.installation_id,
  d.entity_id   AS entity_name,
  d.entity_id   AS display_name,
  d.source_system
FROM meta.datasets d
WHERE d.layer IN ('silver', 'gold')
  AND d.entity_id IS NOT NULL
ON CONFLICT (installation_id, entity_id) DO UPDATE
  SET entity_name  = COALESCE(meta.entities.entity_name, EXCLUDED.entity_name),
      display_name = COALESCE(meta.entities.display_name, EXCLUDED.display_name),
      updated_at   = now();

-- Bootstrap: vul entity_sources vanuit bestaande lineage_edges
-- Bronze→silver edges: source = bronze dataset, target = silver entity
INSERT INTO meta.entity_sources (installation_id, entity_id, source_dataset_id, source_layer)
SELECT DISTINCT
  e.installation_id,
  tgt.entity_id                                    AS entity_id,
  e.source_dataset_id                              AS source_dataset_id,
  src.layer                                        AS source_layer
FROM meta.lineage_edges e
JOIN meta.datasets src
  ON src.installation_id = e.installation_id
 AND src.dataset_id      = e.source_dataset_id
 AND src.layer           = 'bronze'
JOIN meta.datasets tgt_ds
  ON tgt_ds.installation_id = e.installation_id
 AND tgt_ds.dataset_id      = e.target_dataset_id
 AND tgt_ds.layer           IN ('silver', 'gold')
JOIN meta.entities tgt
  ON tgt.installation_id = e.installation_id
 AND tgt.entity_id       = tgt_ds.entity_id
WHERE tgt_ds.entity_id IS NOT NULL
ON CONFLICT (installation_id, entity_id, source_dataset_id) DO UPDATE
  SET last_observed_at = now();

-- ---------------------------------------------------------------------------
-- 4. meta.lineage_edges: source_kind / target_kind type-onderscheid
--    dataset = landing/raw/bronze fysiek object
--    entity  = silver/gold business-entiteit
-- ---------------------------------------------------------------------------
ALTER TABLE meta.lineage_edges
  ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'dataset',
  ADD COLUMN IF NOT EXISTS target_kind TEXT NOT NULL DEFAULT 'dataset';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meta_lineage_edges_source_kind_check'
  ) THEN
    ALTER TABLE meta.lineage_edges
      ADD CONSTRAINT meta_lineage_edges_source_kind_check
        CHECK (source_kind IN ('dataset', 'entity'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meta_lineage_edges_target_kind_check'
  ) THEN
    ALTER TABLE meta.lineage_edges
      ADD CONSTRAINT meta_lineage_edges_target_kind_check
        CHECK (target_kind IN ('dataset', 'entity'));
  END IF;
END $$;

-- Backfill: zet correcte kind op basis van layer van source/target dataset
UPDATE meta.lineage_edges e
SET
  source_kind = CASE
    WHEN src.layer IN ('silver', 'gold') THEN 'entity'
    ELSE 'dataset'
  END,
  target_kind = CASE
    WHEN tgt.layer IN ('silver', 'gold') THEN 'entity'
    ELSE 'dataset'
  END
FROM meta.datasets src, meta.datasets tgt
WHERE src.installation_id = e.installation_id
  AND src.dataset_id      = e.source_dataset_id
  AND tgt.installation_id = e.installation_id
  AND tgt.dataset_id      = e.target_dataset_id;
