-- LADR-065: Natural dataset identity — WP-NDI-001 (LINS-021 compliance)
-- Datum: 2026-05-06
--
-- Probleem: meta.datasets.dataset_id = "{entity_name}::{layer}" is een gefabriceerde waarde
-- (LADR-058 workaround). De `::` separator bestaat niet in het bronsysteem en schendt LINS-021.
--
-- Oplossing:
--   - dataset_id = bare entity name ("cbs_arbeid" i.p.v. "cbs_arbeid::bronze")
--   - Uniekheid via PRIMARY KEY (installation_id, dataset_id, layer)
--   - source_layer / target_layer toegevoegd aan lineage_edges, lineage_columns, run_io
--   - Self-loop CHECK constraint op lineage_edges (vervangt applicatie-level guard)
--   - fqn, group_id, dataset_name kolommen verwijderd (waren redundant met dataset_id)
--
-- Volgorde: Phase 1 (extend) → Phase 2 (constraints + PK change) → Phase 3 (strip + verify) → Phase 5 (cleanup)
-- Phase 4 = code-deploy (meta-ingest.ts, databricks-sync.ts) — buiten dit script.

-- ===========================================================================
-- Phase 1: Layer-kolommen toevoegen aan FK-tabellen; backfill vanuit meta.datasets
-- ===========================================================================

-- meta.lineage_edges: source_layer / target_layer
ALTER TABLE meta.lineage_edges
  ADD COLUMN IF NOT EXISTS source_layer TEXT,
  ADD COLUMN IF NOT EXISTS target_layer TEXT;

UPDATE meta.lineage_edges e
SET
  source_layer = src.layer,
  target_layer = tgt.layer
FROM meta.datasets src, meta.datasets tgt
WHERE src.installation_id = e.installation_id
  AND src.dataset_id      = e.source_dataset_id
  AND tgt.installation_id = e.installation_id
  AND tgt.dataset_id      = e.target_dataset_id
  AND (e.source_layer IS NULL OR e.target_layer IS NULL);

-- meta.lineage_columns: source_layer / target_layer
ALTER TABLE meta.lineage_columns
  ADD COLUMN IF NOT EXISTS source_layer TEXT,
  ADD COLUMN IF NOT EXISTS target_layer TEXT;

UPDATE meta.lineage_columns c
SET
  source_layer = src.layer,
  target_layer = tgt.layer
FROM meta.datasets src, meta.datasets tgt
WHERE src.installation_id = c.installation_id
  AND src.dataset_id      = c.source_dataset_id
  AND tgt.installation_id = c.installation_id
  AND tgt.dataset_id      = c.target_dataset_id
  AND (c.source_layer IS NULL OR c.target_layer IS NULL);

-- meta.run_io: layer (voor de dataset die gelezen/geschreven werd)
ALTER TABLE meta.run_io
  ADD COLUMN IF NOT EXISTS layer TEXT;

UPDATE meta.run_io io
SET layer = d.layer
FROM meta.datasets d
WHERE d.installation_id = io.installation_id
  AND d.dataset_id      = io.dataset_id
  AND io.layer IS NULL;

-- ===========================================================================
-- Phase 2: Constraints aanpassen + PK wijzigen op meta.datasets
-- ===========================================================================

-- 2a. meta.datasets.layer: NOT NULL maken met fallback 'unknown'
ALTER TABLE meta.datasets ALTER COLUMN layer SET DEFAULT 'unknown';
UPDATE meta.datasets SET layer = 'unknown' WHERE layer IS NULL;
ALTER TABLE meta.datasets ALTER COLUMN layer SET NOT NULL;

-- 2b. Check constraint: dataset_layer_check (bekend vocabulaire)
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

-- 2c. PK op meta.datasets uitbreiden naar (installation_id, dataset_id, layer)
--     Er zijn geen FK-constraints die naar meta.datasets verwijzen (soft joins),
--     dus DROP ... CASCADE is veilig.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meta_datasets_pkey'
  ) THEN
    ALTER TABLE meta.datasets DROP CONSTRAINT meta_datasets_pkey CASCADE;
  END IF;
END $$;

ALTER TABLE meta.datasets
  ADD CONSTRAINT meta_datasets_pkey
    PRIMARY KEY (installation_id, dataset_id, layer);

-- 2d. meta.run_io: UNIQUE uitbreiden met layer zodat (run, entity, layer, role) uniek is
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'meta_run_io_run_id_dataset_id_role_key'
  ) THEN
    ALTER TABLE meta.run_io DROP CONSTRAINT meta_run_io_run_id_dataset_id_role_key;
  END IF;
  -- Alternatieve constraint-naam als de automatisch gegenereerde naam anders is
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'meta.run_io'::regclass
      AND contype = 'u' AND conname LIKE '%dataset%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE meta.run_io DROP CONSTRAINT ' || conname
      FROM pg_constraint
      WHERE conrelid = 'meta.run_io'::regclass AND contype = 'u' AND conname LIKE '%dataset%'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE meta.run_io
  ADD CONSTRAINT meta_run_io_unique_run_entity_layer_role
    UNIQUE (run_id, dataset_id, layer, role);

-- 2e. meta.lineage_edges: UNIQUE uitbreiden met layer-info
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'meta.lineage_edges'::regclass
      AND contype = 'u'
      AND conname NOT LIKE '%self_loop%'
  LOOP
    EXECUTE 'ALTER TABLE meta.lineage_edges DROP CONSTRAINT ' || r.conname;
  END LOOP;
END $$;

ALTER TABLE meta.lineage_edges
  ADD CONSTRAINT meta_lineage_edges_unique_hop
    UNIQUE (installation_id, source_dataset_id, source_layer, target_dataset_id, target_layer);

-- Self-loop CHECK constraint (vervangt applicatie-level guard uit LADR-058 D2)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lineage_no_self_loop'
  ) THEN
    ALTER TABLE meta.lineage_edges
      ADD CONSTRAINT lineage_no_self_loop
        CHECK (
          source_dataset_id <> target_dataset_id
          OR source_layer IS DISTINCT FROM target_layer
        );
  END IF;
END $$;

-- 2f. meta.lineage_columns: UNIQUE uitbreiden met layer-info
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'meta.lineage_columns'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE 'ALTER TABLE meta.lineage_columns DROP CONSTRAINT ' || r.conname;
  END LOOP;
END $$;

ALTER TABLE meta.lineage_columns
  ADD CONSTRAINT meta_lineage_columns_unique_hop
    UNIQUE (installation_id, source_dataset_id, source_layer, source_column,
            target_dataset_id, target_layer, target_column);

-- ===========================================================================
-- Phase 3: Strip '::layer' suffix uit alle dataset_id waarden (single transaction)
-- ===========================================================================

DO $$
DECLARE
  datasets_remaining  INTEGER;
  edges_remaining     INTEGER;
BEGIN
  -- meta.datasets
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

  -- Verify: geen composiete waarden mogen overblijven
  SELECT COUNT(*) INTO datasets_remaining FROM meta.datasets WHERE dataset_id LIKE '%::%';
  SELECT COUNT(*) INTO edges_remaining
    FROM meta.lineage_edges
    WHERE source_dataset_id LIKE '%::%' OR target_dataset_id LIKE '%::%';

  ASSERT datasets_remaining = 0,
    FORMAT('meta.datasets: %s rijen bevatten nog een "::" composite waarde', datasets_remaining);
  ASSERT edges_remaining = 0,
    FORMAT('meta.lineage_edges: %s rijen bevatten nog een "::" composite waarde', edges_remaining);

  RAISE NOTICE 'Phase 3 voltooid — alle dataset_id waarden zijn nu bare entity names';
END $$;

-- ===========================================================================
-- Phase 5: Redundante kolommen verwijderen
-- ===========================================================================

-- dataset_name was GENERATED ALWAYS AS (split_part(dataset_id, '::', 1)) STORED
-- Na strip is dataset_name === dataset_id → overbodig
ALTER TABLE meta.datasets DROP COLUMN IF EXISTS dataset_name;

-- fqn was de bare entity name vóór LADR-058 → nu identiek aan dataset_id
ALTER TABLE meta.datasets DROP COLUMN IF EXISTS fqn;

-- group_id was de bare entity name gekopieerd vanuit fqn → nu identiek aan dataset_id
ALTER TABLE meta.datasets DROP COLUMN IF EXISTS group_id;

-- Index op fqn (uit 013) verwijderd via kolom-drop; nieuw index op dataset_id is de PK
-- Extra index voor zoekopdrachten op entity_id (was op fqn in 013)
CREATE INDEX IF NOT EXISTS idx_meta_datasets_installation_id
  ON meta.datasets (installation_id, dataset_id);
