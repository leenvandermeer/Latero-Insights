-- 055 — SCD2 validity window voor meta.lineage_edges (LADR-080)
--
-- Voegt valid_from / valid_to toe zodat de lineage graph bevraagd kan worden
-- op elk willekeurig tijdstip via ?as_of= (tijdreizen).
--
-- Datamodel:
--   - Elke edge heeft maximaal één open versie (valid_to IS NULL).
--   - Wanneer een hop verdwijnt (detectLineageDrift), wordt valid_to gezet.
--   - Wanneer een hop terugkomt, wordt een nieuwe rij ingevoegd (nieuw valid_from).
--
-- Point-in-time query:
--   WHERE valid_from <= :as_of
--     AND (valid_to IS NULL OR valid_to > :as_of)
--
-- Schrijfpad (meta-ingest.ts):
--   UPDATE active edge → als geen rij bijgewerkt → INSERT nieuwe versie.
--   De oude ON CONFLICT upsert vervalt; de partial unique index handhaaft
--   de invariant dat er nooit twee open versies voor dezelfde hop bestaan.

-- 1. Voeg valid_from / valid_to toe (idempotent)
ALTER TABLE meta.lineage_edges
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valid_to   TIMESTAMPTZ;

-- 2. Backfill valid_from voor bestaande rijen op basis van first_observed_at
UPDATE meta.lineage_edges
  SET valid_from = first_observed_at
  WHERE valid_from IS NULL;

-- 3. NOT NULL + default voor nieuwe rijen zonder bekende valid_from
ALTER TABLE meta.lineage_edges
  ALTER COLUMN valid_from SET NOT NULL,
  ALTER COLUMN valid_from SET DEFAULT now();

-- 4. Drop de bestaande named unique constraint (overschrijft de hop per versie)
ALTER TABLE meta.lineage_edges
  DROP CONSTRAINT IF EXISTS meta_lineage_edges_unique_hop;

-- 5. Partial unique index: maximaal één open versie per hop (valid_to IS NULL)
--    Hiermee kan de schrijflaag een UPDATE-then-INSERT patroon gebruiken
--    zonder ON CONFLICT duplicaten te riskeren.
CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_lineage_edges_active_hop
  ON meta.lineage_edges (installation_id, source_dataset_id, source_layer, target_dataset_id, target_layer)
  WHERE valid_to IS NULL;

-- 6. Versie-uniekheid: zelfde hop mag niet twee keer hetzelfde valid_from hebben
CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_lineage_edges_version
  ON meta.lineage_edges (installation_id, source_dataset_id, source_layer, target_dataset_id, target_layer, valid_from);

-- 7. Index voor point-in-time queries via ?as_of=
CREATE INDEX IF NOT EXISTS idx_meta_lineage_edges_temporal
  ON meta.lineage_edges (installation_id, valid_from, valid_to);
