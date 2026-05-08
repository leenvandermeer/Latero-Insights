-- Migration 021: Merge layer-prefixed ghost entities into their canonical counterparts.
--
-- Ghost entities like 'silver_gemeente_arbeid' arise when old framework versions
-- wrote dataset_id with the layer prefix included. After LINS-021 was enforced,
-- correct entities ('gemeente_arbeid') exist alongside ghost ones.
--
-- This migration:
--   1. For each ghost entity (entity_id ~ '^(layer)_'), ensures the correct entity exists.
--   2. Updates meta.jobs.dataset_id ghost → correct.
--   3. Updates meta.datasets.entity_id and fqn ghost → correct (fixes the status JOIN).
--   4. Migrates meta.entity_sources to the correct entity.
--   5. Deletes ghost entities (CASCADE removes entity_sources).

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT installation_id,
           entity_id AS ghost_id,
           regexp_replace(entity_id, '^(silver|gold|bronze|raw|landing)_', '') AS correct_id
    FROM meta.entities
    WHERE entity_id ~ '^(silver|gold|bronze|raw|landing)_'
      AND entity_id != regexp_replace(entity_id, '^(silver|gold|bronze|raw|landing)_', '')
  LOOP
    RAISE NOTICE 'Merging ghost entity % → % (installation: %)',
      r.ghost_id, r.correct_id, r.installation_id;

    -- 1. Ensure correct entity exists
    INSERT INTO meta.entities (entity_id, installation_id, entity_name, display_name, is_context_node)
    VALUES (r.correct_id, r.installation_id, r.correct_id, r.correct_id, false)
    ON CONFLICT (installation_id, entity_id) DO NOTHING;

    -- 2. Migrate entity_sources: move from ghost to correct entity
    INSERT INTO meta.entity_sources (
      installation_id, entity_id, source_dataset_id, source_layer,
      first_observed_at, last_observed_at
    )
    SELECT installation_id, r.correct_id, source_dataset_id, source_layer,
           first_observed_at, last_observed_at
    FROM meta.entity_sources
    WHERE installation_id = r.installation_id
      AND entity_id = r.ghost_id
    ON CONFLICT (installation_id, entity_id, source_dataset_id)
    DO UPDATE SET last_observed_at = GREATEST(
      EXCLUDED.last_observed_at, meta.entity_sources.last_observed_at
    );

    -- 3. Update jobs: ghost dataset_id → correct (fixes status JOIN in entities query)
    UPDATE meta.jobs
    SET dataset_id = r.correct_id
    WHERE installation_id = r.installation_id
      AND dataset_id = r.ghost_id;

    -- 4. Update datasets: entity_id and fqn → correct
    --    fqn is used by entities/route.ts as j2.dataset_id = d.fqn join key.
    UPDATE meta.datasets
    SET entity_id = r.correct_id,
        fqn       = r.correct_id
    WHERE installation_id = r.installation_id
      AND entity_id = r.ghost_id;

    -- 5. Delete ghost entity (CASCADE removes remaining entity_sources rows)
    DELETE FROM meta.entities
    WHERE installation_id = r.installation_id
      AND entity_id = r.ghost_id;

  END LOOP;
END $$;
