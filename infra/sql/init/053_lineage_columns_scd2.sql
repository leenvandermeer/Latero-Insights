-- ===========================================================================
-- 053 — SCD2 validity window voor meta.lineage_columns (LADR-014)
--
-- Voegt valid_from / valid_to toe aan meta.lineage_columns zodat Latero Control
-- alle versies uit de Databricks meta.lineage_attribute tabel kan opslaan.
-- De unique constraint wordt uitgebreid met valid_from zodat meerdere versies
-- van dezelfde kolom-mapping naast elkaar kunnen bestaan.
--
-- Point-in-time query pattern:
--   WHERE valid_from <= :as_of AND (valid_to IS NULL OR valid_to > :as_of)
-- ===========================================================================

-- 1. Voeg valid_from / valid_to toe (idempotent)
ALTER TABLE meta.lineage_columns
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valid_to   TIMESTAMPTZ;

-- 2. Backfill valid_from voor bestaande rijen
UPDATE meta.lineage_columns
  SET valid_from = first_observed_at
  WHERE valid_from IS NULL;

-- 3. NOT NULL + default voor nieuwe rijen zonder bekende valid_from (pre-SCD2 data)
ALTER TABLE meta.lineage_columns
  ALTER COLUMN valid_from SET NOT NULL,
  ALTER COLUMN valid_from SET DEFAULT TIMESTAMPTZ '1970-01-01';

-- 4. Drop de bestaande unique constraint (zonder valid_from)
ALTER TABLE meta.lineage_columns
  DROP CONSTRAINT IF EXISTS meta_lineage_columns_unique_hop;

-- 5. Nieuwe unique constraint inclusief valid_from
ALTER TABLE meta.lineage_columns
  ADD CONSTRAINT meta_lineage_columns_unique_hop
    UNIQUE (installation_id, source_dataset_id, source_layer, source_column,
            target_dataset_id, target_layer, target_column, valid_from);

-- 6. Index voor point-in-time queries via as_of
CREATE INDEX IF NOT EXISTS idx_meta_lineage_columns_validity
  ON meta.lineage_columns (installation_id, valid_from, valid_to);
