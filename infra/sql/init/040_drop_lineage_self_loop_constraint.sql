-- Verwijder de lineage_no_self_loop constraint van meta.lineage_edges.
-- De constraint blokkeerde sync wanneer source en target dezelfde dataset_id hebben
-- maar layer-informatie ontbreekt (beide 'unknown'). Dit is een valide observatie
-- vanuit Databricks wanneer layer-metadata niet ingesteld is in de brondata.
-- Self-loop filtering vindt plaats op API/display niveau indien gewenst.

ALTER TABLE meta.lineage_edges
  DROP CONSTRAINT IF EXISTS lineage_no_self_loop;
