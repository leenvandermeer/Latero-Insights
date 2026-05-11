-- 046_normalize_policy_uuids.sql
-- Normalizes legacy name-based IDs in meta.policy_packs and meta.policies to proper UUIDs.
-- Pattern: surrogate UUID owned by Latero, external identity separate from PK.
-- Matches the approach of migration 045 (data_products).

DO $$
DECLARE
  v_pack_count  int;
  v_policy_count int;
BEGIN

  -- ── Step 1: Normalize meta.policy_packs.id ──────────────────────────────

  CREATE TEMP TABLE _pack_id_map AS
    SELECT installation_id, id AS old_id, gen_random_uuid()::text AS new_id
    FROM meta.policy_packs
    WHERE id NOT SIMILAR TO
      '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

  SELECT COUNT(*) INTO v_pack_count FROM _pack_id_map;

  IF v_pack_count > 0 THEN
    -- Drop FK: policies → policy_packs (ON DELETE SET NULL — safe to drop/restore)
    ALTER TABLE meta.policies
      DROP CONSTRAINT IF EXISTS meta_policies_pack_fk;

    -- Cascade pack_id references in policies
    UPDATE meta.policies p
      SET pack_id = m.new_id
      FROM _pack_id_map m
      WHERE p.installation_id = m.installation_id
        AND p.pack_id = m.old_id;

    -- Update the PK itself
    UPDATE meta.policy_packs pp
      SET id = m.new_id
      FROM _pack_id_map m
      WHERE pp.installation_id = m.installation_id
        AND pp.id = m.old_id;

    -- Restore FK
    ALTER TABLE meta.policies
      ADD CONSTRAINT meta_policies_pack_fk
      FOREIGN KEY (installation_id, pack_id)
      REFERENCES meta.policy_packs(installation_id, id)
      ON DELETE SET NULL;

    RAISE NOTICE '046: % policy_pack ID(s) normalized to UUID.', v_pack_count;
  ELSE
    RAISE NOTICE '046: no legacy policy_pack IDs found, skipping Step 1.';
  END IF;

  DROP TABLE _pack_id_map;

  -- ── Step 2: Normalize meta.policies.id ──────────────────────────────────

  CREATE TEMP TABLE _policy_id_map AS
    SELECT installation_id, id AS old_id, gen_random_uuid()::text AS new_id
    FROM meta.policies
    WHERE id NOT SIMILAR TO
      '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

  SELECT COUNT(*) INTO v_policy_count FROM _policy_id_map;

  IF v_policy_count > 0 THEN
    -- Drop FKs: policy_verdicts and policy_exceptions → policies (both CASCADE)
    ALTER TABLE meta.policy_verdicts
      DROP CONSTRAINT IF EXISTS meta_policy_verdicts_policy_fk;
    ALTER TABLE meta.policy_exceptions
      DROP CONSTRAINT IF EXISTS meta_policy_exceptions_policy_fk;

    -- Cascade policy_id references
    UPDATE meta.policy_verdicts pv
      SET policy_id = m.new_id
      FROM _policy_id_map m
      WHERE pv.installation_id = m.installation_id
        AND pv.policy_id = m.old_id;

    UPDATE meta.policy_exceptions pe
      SET policy_id = m.new_id
      FROM _policy_id_map m
      WHERE pe.installation_id = m.installation_id
        AND pe.policy_id = m.old_id;

    -- Update the PK itself
    UPDATE meta.policies p
      SET id = m.new_id
      FROM _policy_id_map m
      WHERE p.installation_id = m.installation_id
        AND p.id = m.old_id;

    -- Restore FKs with original semantics
    ALTER TABLE meta.policy_verdicts
      ADD CONSTRAINT meta_policy_verdicts_policy_fk
      FOREIGN KEY (installation_id, policy_id)
      REFERENCES meta.policies(installation_id, id)
      ON DELETE CASCADE;

    ALTER TABLE meta.policy_exceptions
      ADD CONSTRAINT meta_policy_exceptions_policy_fk
      FOREIGN KEY (installation_id, policy_id)
      REFERENCES meta.policies(installation_id, id)
      ON DELETE CASCADE;

    RAISE NOTICE '046: % policy ID(s) normalized to UUID.', v_policy_count;
  ELSE
    RAISE NOTICE '046: no legacy policy IDs found, skipping Step 2.';
  END IF;

  DROP TABLE _policy_id_map;

  RAISE NOTICE '046: migration complete.';

END $$;
