-- 022b: Fix voor de gedeeltelijk uitgevoerde 022-migratie
-- Fasegewijze aanpak die de constraint-blockers correct oplost.
-- Idempotent: veilig om meerdere keren uit te voeren.

-- ---------------------------------------------------------------------------
-- Stap 1: Verwijder de oude layer-check die 'unknown' niet toestaat
-- ---------------------------------------------------------------------------
ALTER TABLE meta.datasets DROP CONSTRAINT IF EXISTS meta_datasets_layer_check;

-- ---------------------------------------------------------------------------
-- Stap 2: Vul NULL-layers met 'unknown' (nu zonder constraint-blokkering)
-- ---------------------------------------------------------------------------
UPDATE meta.datasets SET layer = 'unknown' WHERE layer IS NULL;

-- ---------------------------------------------------------------------------
-- Stap 3: Voeg nieuwe layer-check toe (inclusief 'unknown')
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'meta_datasets_layer_check'
  ) THEN
    ALTER TABLE meta.datasets
      ADD CONSTRAINT meta_datasets_layer_check
        CHECK (layer IN ('landing', 'raw', 'bronze', 'silver', 'gold', 'unknown'));
  END IF;
END $$;

-- Zet NOT NULL (nulls zijn hierboven bijgevuld)
ALTER TABLE meta.datasets ALTER COLUMN layer SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Stap 4: Wissel de PK van (installation_id, dataset_id) naar (installation_id, dataset_id, layer)
--         De juiste naam van de bestaande PK is 'datasets_pkey'
-- ---------------------------------------------------------------------------
ALTER TABLE meta.datasets DROP CONSTRAINT IF EXISTS datasets_pkey;

ALTER TABLE meta.datasets
  ADD CONSTRAINT datasets_pkey
    PRIMARY KEY (installation_id, dataset_id, layer);

-- ---------------------------------------------------------------------------
-- Stap 4b: Verwijder bare rijen zonder entity_id die na strip zouden conflicteren
--          met een composiete rij van hetzelfde (entity_name, layer) paar.
--          De composiete versie heeft betere data (entity_id gevuld) en wint.
-- ---------------------------------------------------------------------------
DELETE FROM meta.datasets bare
USING meta.datasets comp
WHERE bare.installation_id = comp.installation_id
  AND bare.dataset_id = split_part(comp.dataset_id, '::', 1)
  AND bare.layer = comp.layer
  AND bare.dataset_id NOT LIKE '%::%'
  AND comp.dataset_id LIKE '%::%'
  AND bare.entity_id IS NULL;

-- ---------------------------------------------------------------------------
-- Stap 5: Strip '::<layer>' suffix uit alle dataset_id waarden (één transactie)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  datasets_remaining  INTEGER;
  edges_remaining     INTEGER;
BEGIN
  -- meta.datasets (nu safe: PK is (installation_id, dataset_id, layer))
  UPDATE meta.datasets
    SET dataset_id = split_part(dataset_id, '::', 1)
    WHERE dataset_id LIKE '%::%';

  -- meta.jobs
  UPDATE meta.jobs
    SET dataset_id = split_part(dataset_id, '::', 1)
    WHERE dataset_id LIKE '%::%';

  -- meta.run_io
  UPDATE meta.run_io
    SET dataset_id = split_part(dataset_id, '::', 1)
    WHERE dataset_id LIKE '%::%';

  -- meta.lineage_edges
  UPDATE meta.lineage_edges
    SET source_dataset_id = split_part(source_dataset_id, '::', 1),
        target_dataset_id = split_part(target_dataset_id, '::', 1)
    WHERE source_dataset_id LIKE '%::%'
       OR target_dataset_id LIKE '%::%';

  -- meta.lineage_columns
  UPDATE meta.lineage_columns
    SET source_dataset_id = split_part(source_dataset_id, '::', 1),
        target_dataset_id = split_part(target_dataset_id, '::', 1)
    WHERE source_dataset_id LIKE '%::%'
       OR target_dataset_id LIKE '%::%';

  -- meta.quality_rules
  UPDATE meta.quality_rules
    SET dataset_id = split_part(dataset_id, '::', 1)
    WHERE dataset_id LIKE '%::%';

  -- meta.entity_sources
  UPDATE meta.entity_sources
    SET source_dataset_id = split_part(source_dataset_id, '::', 1)
    WHERE source_dataset_id LIKE '%::%';

  -- Verificatie
  SELECT COUNT(*) INTO datasets_remaining FROM meta.datasets WHERE dataset_id LIKE '%::%';
  SELECT COUNT(*) INTO edges_remaining
    FROM meta.lineage_edges
    WHERE source_dataset_id LIKE '%::%' OR target_dataset_id LIKE '%::%';

  ASSERT datasets_remaining = 0,
    FORMAT('meta.datasets: %s rijen bevatten nog een "::" waarde', datasets_remaining);
  ASSERT edges_remaining = 0,
    FORMAT('meta.lineage_edges: %s rijen bevatten nog een "::" waarde', edges_remaining);

  RAISE NOTICE 'Stap 5 voltooid — alle dataset_id waarden zijn nu bare entity names';
END $$;
