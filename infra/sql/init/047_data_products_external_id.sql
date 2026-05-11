-- 047_data_products_external_id.sql
--
-- Adds an external_id column to meta.data_products.
-- Design principle: Latero owns the internal UUID (data_product_id).
-- External systems (Databricks, API callers) reference a product via external_id.
-- The ingest layer upserts by (installation_id, external_id) and assigns/reuses
-- the internal UUID — callers never dictate the PK.
--
-- external_id is nullable: UI-created products have no external identity.
-- external_id is unique per installation (partial unique index, NULLs excluded).

ALTER TABLE meta.data_products
  ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Unique per installation, ignoring NULLs (Postgres partial index)
CREATE UNIQUE INDEX IF NOT EXISTS data_products_external_id_uniq
  ON meta.data_products (installation_id, external_id)
  WHERE external_id IS NOT NULL AND valid_to IS NULL;

-- Backfill: seed products whose display_name matches original name-based ID format
-- (snake_case, no spaces). These came from bootstrap data where display_name = old PK.
-- Safe heuristic: if display_name has no spaces and contains an underscore,
-- it was originally a code identifier, not a human-readable name.
DO $$
BEGIN
  UPDATE meta.data_products
  SET external_id = display_name
  WHERE external_id IS NULL
    AND valid_to IS NULL
    AND display_name NOT LIKE '% %'
    AND display_name LIKE '%\_%' ESCAPE '\';

  RAISE NOTICE '047: external_id column added to meta.data_products.';
  RAISE NOTICE '047: % record(s) backfilled with display_name as external_id.',
    (SELECT COUNT(*) FROM meta.data_products WHERE external_id IS NOT NULL AND valid_to IS NULL);
END $$;
