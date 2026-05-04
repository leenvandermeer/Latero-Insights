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
-- 3. Trunceer corrupte lineage-data
--    meta.runs en meta.quality_* blijven intact.
--    Volgorde: run_io voor datasets (FK); edges voor datasets.
-- ---------------------------------------------------------------------------
TRUNCATE TABLE meta.run_io;
TRUNCATE TABLE meta.lineage_columns;
TRUNCATE TABLE meta.lineage_edges;
TRUNCATE TABLE meta.datasets;
