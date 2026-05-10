-- =============================================================================
-- 041_schema_gaps.sql — Idempotente sync voor bestaande installaties
-- =============================================================================
-- Achtergrond:
--   docker-compose monteert alleen schema.sql als init-script. De afzonderlijke
--   init-bestanden 020, 039 en 040 zijn nooit automatisch toegepast op bestaande
--   databases (inclusief productie). Dit script consolideert alle structurele
--   ontbrekende onderdelen in één idempotente migratie.
--
-- Veilig om meerdere keren uit te voeren (IF NOT EXISTS / IF EXISTS guards).
--
-- Uitvoeren op productie:
--   psql "$DATABASE_URL" -f infra/sql/init/041_schema_gaps.sql
--
-- Volgorde:
--   1. meta.datasets       — dataset_name generated column
--   2. meta.entities       — entity_name NOT NULL (was nullable)
--   3. meta.lineage_edges  — source_kind / target_kind, drop self-loop constraint
--   4. meta.data_products  — sla_tier
--   5. meta.entity_sources — id UUID primary key, source_layer NOT NULL + CHECK
--   6. Backfill-stappen    — data consistent maken na schema-wijzigingen
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. meta.datasets: dataset_name als generated column
--    Bare naam zonder layer-prefix: "cbs_arbeid::bronze" → "cbs_arbeid"
-- ---------------------------------------------------------------------------
ALTER TABLE meta.datasets
  ADD COLUMN IF NOT EXISTS dataset_name TEXT
    GENERATED ALWAYS AS (split_part(dataset_id, '::', 1)) STORED;

CREATE INDEX IF NOT EXISTS idx_meta_datasets_name
  ON meta.datasets (installation_id, dataset_name);

-- ---------------------------------------------------------------------------
-- 2. meta.entities: entity_name vullen en NOT NULL zetten
--    Veilig: UPDATE vóór de constraint, dan pas ALTER COLUMN.
-- ---------------------------------------------------------------------------
ALTER TABLE meta.entities
  ADD COLUMN IF NOT EXISTS entity_name TEXT;

UPDATE meta.entities
  SET entity_name = COALESCE(display_name, entity_id)
  WHERE entity_name IS NULL;

ALTER TABLE meta.entities
  ALTER COLUMN entity_name SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. meta.lineage_edges: source_kind / target_kind + verwijder self-loop guard
--    De constraint blokkeerde sync van Databricks-data met layer='unknown'.
--    Self-loop filtering vindt plaats op display/API-niveau.
-- ---------------------------------------------------------------------------
ALTER TABLE meta.lineage_edges
  DROP CONSTRAINT IF EXISTS lineage_no_self_loop;

ALTER TABLE meta.lineage_edges
  ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'dataset';
ALTER TABLE meta.lineage_edges
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

-- Backfill kind op basis van de layer van de bijbehorende dataset-rij
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

-- ---------------------------------------------------------------------------
-- 4. meta.data_products: sla_tier kolom
--    Was overal in de code aanwezig, maar nooit naar het schema gepromoot.
-- ---------------------------------------------------------------------------
ALTER TABLE meta.data_products
  ADD COLUMN IF NOT EXISTS sla_tier TEXT
    CHECK (sla_tier IN ('bronze', 'silver', 'gold'));

-- ---------------------------------------------------------------------------
-- 5. meta.entity_sources: source_layer NOT NULL + CHECK + id UUID PK
--    Bestaande tabel heeft composite PK; nieuwe structuur heeft UUID PK.
--    Alleen de constraint en NOT NULL worden hier toegepast; de UUID-kolom
--    wordt overgeslagen als de tabel al bestaat met de composite PK om
--    data-verlies te voorkomen. De UNIQUE constraint is in beide varianten
--    aanwezig en volstaat voor ON CONFLICT in meta-ingest.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Voeg source_layer NOT NULL toe als de kolom nullable is
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'meta'
      AND table_name   = 'entity_sources'
      AND column_name  = 'source_layer'
      AND is_nullable  = 'YES'
  ) THEN
    -- Vul eventuele NULLs op met 'bronze' als veilige default
    UPDATE meta.entity_sources SET source_layer = 'bronze' WHERE source_layer IS NULL;
    ALTER TABLE meta.entity_sources ALTER COLUMN source_layer SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meta_entity_sources_source_layer_check'
  ) THEN
    ALTER TABLE meta.entity_sources
      ADD CONSTRAINT meta_entity_sources_source_layer_check
        CHECK (source_layer IN ('bronze', 'silver'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_meta_entity_sources_entity
  ON meta.entity_sources (installation_id, entity_id);

CREATE INDEX IF NOT EXISTS idx_meta_entity_sources_dataset
  ON meta.entity_sources (installation_id, source_dataset_id);

-- ---------------------------------------------------------------------------
-- 6. Bootstrap entity_sources vanuit bestaande lineage_edges
--    Vult de bridge-tabel voor installaties die al lineage-data hadden
--    voordat dit script werd ingevoerd.
-- ---------------------------------------------------------------------------
INSERT INTO meta.entity_sources (installation_id, entity_id, source_dataset_id, source_layer,
                                  first_observed_at, last_observed_at)
SELECT DISTINCT
  e.installation_id,
  tgt.entity_id                  AS entity_id,
  e.source_dataset_id            AS source_dataset_id,
  src.layer                      AS source_layer,
  now()                          AS first_observed_at,
  now()                          AS last_observed_at
FROM meta.lineage_edges e
JOIN meta.datasets src
  ON src.installation_id = e.installation_id
 AND src.dataset_id      = e.source_dataset_id
 AND src.layer           IN ('bronze', 'silver')
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
