-- 043: Bootstrap data products vanuit orphan entities
-- group_id (016) is verwijderd door 022, waardoor 017 step 7 niet meer werkt op
-- fresh installaties. Entities aangemaakt via pipeline runs krijgen daardoor nooit
-- een data product. Dit script maakt products voor entities zonder matching product.
-- Idempotent: ON CONFLICT DO NOTHING.

INSERT INTO meta.data_products (data_product_id, installation_id, display_name, valid_from)
SELECT DISTINCT
  e.entity_id,
  e.installation_id,
  COALESCE(e.display_name, e.entity_id),
  e.created_at
FROM meta.entities e
WHERE NOT EXISTS (
  SELECT 1 FROM meta.data_products dp
  WHERE dp.installation_id = e.installation_id
    AND dp.data_product_id = e.entity_id
)
  AND e.valid_to IS NULL
ON CONFLICT DO NOTHING;

-- Koppel de entities aan hun nieuwe product
UPDATE meta.entities e
SET data_product_id = e.entity_id,
    updated_at      = now()
WHERE e.data_product_id IS NULL
  AND EXISTS (
    SELECT 1 FROM meta.data_products dp
    WHERE dp.installation_id = e.installation_id
      AND dp.data_product_id = e.entity_id
  );
