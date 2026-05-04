-- LADR-xxx: OpenLineage-alignment van het meta.* schema
--
-- Drie wijzigingen:
--
-- 1. meta.datasets: voeg 'layer' toe als logische pipelinelaag (landing/raw/bronze/silver/gold).
--    'platform' blijft behouden voor het fysieke opslagformaat (ICEBERG/DELTA/…) dat in een
--    OpenLineage-namespace-URI terechtkomt. Layer is een applicatie-concept bovenop OL.
--
-- 2. meta.jobs: voeg 'job_namespace' toe voor OL-jobidentiteit ({namespace, name}).
--    Default 'latero' is backward-compatible; runtimes kunnen een eigen namespace sturen.
--
-- 3. meta.lineage_columns: align transformation_type met OpenLineage ColumnLineageFacet:
--    - type:    DIRECT | INDIRECT | UNKNOWN   (was: IDENTITY/AGGREGATION/… — OL-subtypes)
--    - subtype: IDENTITY | AGGREGATION | FILTER | MASKING | RENAME | DERIVED | null
--    Bestaande rijen krijgen type=UNKNOWN; downstream schrijfpad vult type/subtype bij.

-- ---------------------------------------------------------------------------
-- 1. meta.datasets — logische pipeline-laag
-- ---------------------------------------------------------------------------
ALTER TABLE meta.datasets
  ADD COLUMN IF NOT EXISTS layer TEXT;

ALTER TABLE meta.datasets
  DROP CONSTRAINT IF EXISTS meta_datasets_layer_check;

ALTER TABLE meta.datasets
  ADD CONSTRAINT meta_datasets_layer_check
    CHECK (layer IS NULL OR layer IN ('landing', 'raw', 'bronze', 'silver', 'gold'));

-- Backfill: leid layer af uit FQN voor bestaande rijen zonder waarde.
-- Formaat "catalog.layer.table" — het voorlaatste segment is de laag.
UPDATE meta.datasets
SET layer = lower(
  (string_to_array(fqn, '.'))[array_length(string_to_array(fqn, '.'), 1) - 1]
)
WHERE layer IS NULL
  AND array_length(string_to_array(fqn, '.'), 1) >= 3
  AND lower(
    (string_to_array(fqn, '.'))[array_length(string_to_array(fqn, '.'), 1) - 1]
  ) IN ('landing', 'raw', 'bronze', 'silver', 'gold');

-- ---------------------------------------------------------------------------
-- 2. meta.jobs — job namespace (OpenLineage job identity = {namespace, name})
-- ---------------------------------------------------------------------------
ALTER TABLE meta.jobs
  ADD COLUMN IF NOT EXISTS job_namespace TEXT NOT NULL DEFAULT 'latero';

-- ---------------------------------------------------------------------------
-- 3. meta.lineage_columns — transformation_type align met OL ColumnLineageFacet
-- ---------------------------------------------------------------------------

-- Voeg transformation_subtype toe (OL subtype: IDENTITY, AGGREGATION, …)
ALTER TABLE meta.lineage_columns
  ADD COLUMN IF NOT EXISTS transformation_subtype TEXT;

-- Migreer bestaande waarden naar het nieuwe type/subtype-model:
--   oude waarde (was subtype)  → nieuwe type   / nieuwe subtype
--   IDENTITY                   → DIRECT         / IDENTITY
--   RENAME                     → DIRECT         / RENAME
--   AGGREGATION                → INDIRECT       / AGGREGATION
--   DERIVED                    → INDIRECT       / DERIVED
--   FILTER                     → INDIRECT       / FILTER
--   UNKNOWN                    → UNKNOWN        / null
UPDATE meta.lineage_columns
SET transformation_subtype = transformation_type,
    transformation_type = CASE transformation_type
      WHEN 'IDENTITY'    THEN 'DIRECT'
      WHEN 'RENAME'      THEN 'DIRECT'
      WHEN 'AGGREGATION' THEN 'INDIRECT'
      WHEN 'DERIVED'     THEN 'INDIRECT'
      WHEN 'FILTER'      THEN 'INDIRECT'
      ELSE 'UNKNOWN'
    END
WHERE transformation_type IS NOT NULL
  AND transformation_type NOT IN ('DIRECT', 'INDIRECT', 'UNKNOWN');

-- Vervang constraint door OL-vocabulaire
ALTER TABLE meta.lineage_columns
  DROP CONSTRAINT IF EXISTS meta_lineage_columns_transform_check;

ALTER TABLE meta.lineage_columns
  ADD CONSTRAINT meta_lineage_columns_transform_check
    CHECK (transformation_type IS NULL OR transformation_type IN (
      'DIRECT', 'INDIRECT', 'UNKNOWN'
    ));

ALTER TABLE meta.lineage_columns
  DROP CONSTRAINT IF EXISTS meta_lineage_columns_subtype_check;

ALTER TABLE meta.lineage_columns
  ADD CONSTRAINT meta_lineage_columns_subtype_check
    CHECK (transformation_subtype IS NULL OR transformation_subtype IN (
      'IDENTITY', 'AGGREGATION', 'FILTER', 'MASKING', 'RENAME', 'DERIVED'
    ));
