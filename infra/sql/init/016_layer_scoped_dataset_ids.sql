-- LADR-058: Layer-scoped entity identity voor meta.* lineage model
-- Datum: 2026-05-04
--
-- Probleem: meta.datasets.dataset_id = bare entity name (zonder layer),
-- waardoor landing/raw/bronze/silver versies van dezelfde entiteit samenvoegen
-- tot één rij. Dit veroorzaakt zelf-refererende edges en verlies van layer-info.
--
-- Oplossing:
--   - Nieuw kolom meta.datasets.group_id (= entiteitnaam, gedeeld over layers)
--   - Bestaande corrupte lineage-data trunceren (datasets, edges, columns, run_io)
--   - meta.lineage_columns.transformation_type constraint naar OpenLineage vocab
--   - Na migratie: full re-sync vereist via POST /api/sync/databricks

-- ---------------------------------------------------------------------------
-- 1. meta.datasets: voeg group_id toe
--    group_id = bare entiteitnaam (bijv. "cbs_arbeid"), gedeeld over alle lagen.
--    dataset_id wordt na re-sync: "{entity_name}::{layer}" (bijv. "cbs_arbeid::bronze")
-- ---------------------------------------------------------------------------
ALTER TABLE meta.datasets
  ADD COLUMN IF NOT EXISTS group_id TEXT;

-- Back-fill voor eventueel aanwezige data: group_id = alles voor "::" in dataset_id,
-- of dataset_id zelf als het geen "::" bevat.
UPDATE meta.datasets
  SET group_id = CASE
    WHEN dataset_id LIKE '%::%' THEN split_part(dataset_id, '::', 1)
    ELSE dataset_id
  END
  WHERE group_id IS NULL;

-- ---------------------------------------------------------------------------
-- 2. meta.lineage_columns: update transformation_type constraint naar OL-vocab
--    OpenLineage ColumnLineageFacet: DIRECT | INDIRECT | UNKNOWN
-- ---------------------------------------------------------------------------
ALTER TABLE meta.lineage_columns
  DROP CONSTRAINT IF EXISTS meta_lineage_columns_transform_check;

ALTER TABLE meta.lineage_columns
  ADD COLUMN IF NOT EXISTS transformation_subtype TEXT;

-- Migreer bestaande OL-incompatibele waarden naar OL-types (idempotent)
UPDATE meta.lineage_columns
  SET transformation_type = CASE transformation_type
    WHEN 'IDENTITY'    THEN 'DIRECT'
    WHEN 'RENAME'      THEN 'DIRECT'
    WHEN 'AGGREGATION' THEN 'INDIRECT'
    WHEN 'DERIVED'     THEN 'INDIRECT'
    WHEN 'FILTER'      THEN 'INDIRECT'
    ELSE 'UNKNOWN'
  END
  WHERE transformation_type IS NOT NULL
    AND transformation_type NOT IN ('DIRECT', 'INDIRECT', 'UNKNOWN');

ALTER TABLE meta.lineage_columns
  ADD CONSTRAINT meta_lineage_columns_transform_check
  CHECK (transformation_type IS NULL OR transformation_type IN (
    'DIRECT', 'INDIRECT', 'UNKNOWN'
  ));

-- ---------------------------------------------------------------------------
-- 3. Trunceer corrupte lineage-data — EENMALIG, alleen als group_id nog niet
--    bestaat (detectie: kolom werd door stap 1 hierboven aangemaakt).
--    Na de eerste succesvolle migratie bestaat group_id altijd → guard voorkomt
--    dat TRUNCATE bij iedere deploy opnieuw loopt.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- group_id bestaat altijd na de eerste migratie-run.
  -- Als de kolom al bestond vóór deze sessie, is de truncate al eerder uitgevoerd.
  -- We gebruiken een sentinel-kolom: als group_id DEFAULT NULL heeft (aangemaakt
  -- door ons ALTER), is het een eerste run; anders overslaan.
  -- Simpelere guard: controleer of run_io leeg is als proxy — maar dat is niet
  -- betrouwbaar. Gebruik in plaats daarvan een schema_migrations-achtige tabel.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'meta'
      AND table_name = '_migration_flags'
  ) THEN
    CREATE TABLE meta._migration_flags (flag TEXT PRIMARY KEY);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM meta._migration_flags WHERE flag = '016_truncate_done') THEN
    TRUNCATE TABLE meta.run_io;
    TRUNCATE TABLE meta.lineage_columns;
    TRUNCATE TABLE meta.lineage_edges;
    TRUNCATE TABLE meta.datasets;
    INSERT INTO meta._migration_flags VALUES ('016_truncate_done');
    RAISE NOTICE '016: lineage-tabellen eenmalig getrunceerd (LADR-058)';
  ELSE
    RAISE NOTICE '016: truncate al eerder uitgevoerd — overgeslagen';
  END IF;
END $$;
