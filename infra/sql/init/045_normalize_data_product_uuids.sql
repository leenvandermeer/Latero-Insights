-- 045_normalize_data_product_uuids.sql
-- Normalize legacy name-based data_product_ids to proper UUIDs.
-- All existing products seeded with display_name as PK are migrated to UUID.
-- All FK and soft-reference columns are updated in the same transaction.

DO $$
BEGIN

  -- Build mapping: (installation_id, old_id) -> new UUID
  -- Only for records whose data_product_id is not already a UUID
  CREATE TEMP TABLE _product_id_map AS
    SELECT
      installation_id,
      data_product_id AS old_id,
      gen_random_uuid()::text AS new_id
    FROM meta.data_products
    WHERE data_product_id NOT SIMILAR TO
      '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

  IF NOT EXISTS (SELECT 1 FROM _product_id_map) THEN
    RAISE NOTICE '045: no legacy product IDs found, skipping.';
    DROP TABLE _product_id_map;
    RETURN;
  END IF;

  RAISE NOTICE '045: migrating % legacy product IDs to UUIDs.',
    (SELECT COUNT(*) FROM _product_id_map);

  -- Drop the FK that enforces entities -> data_products referential integrity.
  -- We will restore it after updating both sides.
  ALTER TABLE meta.entities
    DROP CONSTRAINT IF EXISTS meta_entities_data_product_fk;

  -- entities (hard FK reference)
  UPDATE meta.entities e
    SET data_product_id = m.new_id
    FROM _product_id_map m
    WHERE e.installation_id = m.installation_id
      AND e.data_product_id = m.old_id;

  -- alerts (soft reference)
  UPDATE meta.alerts
    SET product_id = m.new_id
    FROM _product_id_map m
    WHERE meta.alerts.installation_id = m.installation_id
      AND meta.alerts.product_id = m.old_id;

  -- contract_requests (soft reference)
  UPDATE meta.contract_requests
    SET product_id = m.new_id
    FROM _product_id_map m
    WHERE meta.contract_requests.installation_id = m.installation_id
      AND meta.contract_requests.product_id = m.old_id;

  -- evidence_records (soft reference)
  UPDATE meta.evidence_records
    SET product_id = m.new_id
    FROM _product_id_map m
    WHERE meta.evidence_records.installation_id = m.installation_id
      AND meta.evidence_records.product_id = m.old_id;

  -- incidents (soft reference)
  UPDATE meta.incidents
    SET product_id = m.new_id
    FROM _product_id_map m
    WHERE meta.incidents.installation_id = m.installation_id
      AND meta.incidents.product_id = m.old_id;

  -- policy_exceptions (soft reference)
  UPDATE meta.policy_exceptions
    SET product_id = m.new_id
    FROM _product_id_map m
    WHERE meta.policy_exceptions.product_id = m.old_id;

  -- policy_verdicts (soft reference)
  UPDATE meta.policy_verdicts
    SET product_id = m.new_id
    FROM _product_id_map m
    WHERE meta.policy_verdicts.product_id = m.old_id;

  -- product_consumers (soft reference)
  UPDATE meta.product_consumers
    SET product_id = m.new_id
    FROM _product_id_map m
    WHERE meta.product_consumers.installation_id = m.installation_id
      AND meta.product_consumers.product_id = m.old_id;

  -- product_cost_records (soft reference)
  UPDATE meta.product_cost_records
    SET product_id = m.new_id
    FROM _product_id_map m
    WHERE meta.product_cost_records.installation_id = m.installation_id
      AND meta.product_cost_records.product_id = m.old_id;

  -- product_output_links (soft reference)
  UPDATE meta.product_output_links
    SET product_id = m.new_id
    FROM _product_id_map m
    WHERE meta.product_output_links.installation_id = m.installation_id
      AND meta.product_output_links.product_id = m.old_id;

  -- product_usage_events (soft reference)
  UPDATE meta.product_usage_events
    SET product_id = m.new_id
    FROM _product_id_map m
    WHERE meta.product_usage_events.installation_id = m.installation_id
      AND meta.product_usage_events.product_id = m.old_id;

  -- trust_score_snapshots (soft reference)
  UPDATE meta.trust_score_snapshots
    SET product_id = m.new_id
    FROM _product_id_map m
    WHERE meta.trust_score_snapshots.installation_id = m.installation_id
      AND meta.trust_score_snapshots.product_id = m.old_id;

  -- Update the primary key itself (last, after all referencing columns are updated)
  UPDATE meta.data_products dp
    SET data_product_id = m.new_id
    FROM _product_id_map m
    WHERE dp.installation_id = m.installation_id
      AND dp.data_product_id = m.old_id;

  -- Restore the FK constraint
  ALTER TABLE meta.entities
    ADD CONSTRAINT meta_entities_data_product_fk
    FOREIGN KEY (installation_id, data_product_id)
    REFERENCES meta.data_products(installation_id, data_product_id)
    ON DELETE SET NULL;

  DROP TABLE _product_id_map;

  RAISE NOTICE '045: migration complete — all legacy product IDs are now UUIDs.';

END $$;
