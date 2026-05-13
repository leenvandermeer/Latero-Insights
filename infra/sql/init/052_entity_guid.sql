-- LADR-079: Stable Entity GUID for URL-Safe Identification
-- Date: 2026-05-13
--
-- Problem: Lineage URLs use ?entity_fqn=cbsenergie which is:
--   1. Not unique (entity can exist across multiple layers)
--   2. Enables fuzzy matching (LINS-021 violation)
--   3. Not stable (breaks on entity rename)
--
-- Solution: Add entity_guid UUID to meta.datasets as a stable, globally unique identifier.
--
-- After this migration:
--   - Every (installation_id, dataset_id, layer) tuple has a unique GUID
--   - URLs use /lineage?guid=<uuid> for exact match semantics
--   - Fuzzy matching is removed from resolveInitialAnchor()
--   - LINS-021 compliant: GUID is a direct database field

-- ===========================================================================
-- Phase 1: Add entity_guid column with automatic UUID generation
-- ===========================================================================

ALTER TABLE meta.datasets
  ADD COLUMN IF NOT EXISTS entity_guid UUID DEFAULT gen_random_uuid() NOT NULL;

-- ===========================================================================
-- Phase 2: Create unique index for fast lookup by GUID
-- ===========================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_datasets_guid
  ON meta.datasets (entity_guid);

-- ===========================================================================
-- Phase 3: Verify no null GUIDs exist (defensive check)
-- ===========================================================================

DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM meta.datasets
  WHERE entity_guid IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'Migration 052 failed: % rows in meta.datasets have NULL entity_guid', null_count;
  END IF;

  RAISE NOTICE '052: entity_guid column added, % existing rows received GUIDs',
    (SELECT COUNT(*) FROM meta.datasets);
END $$;
