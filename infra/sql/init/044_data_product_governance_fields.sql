-- 044: Governance fields voor BCBS 239 compliance conditions
-- Voegt classification, data_steward en retention_days toe aan meta.data_products.
-- Idempotent via ADD COLUMN IF NOT EXISTS.

ALTER TABLE meta.data_products
  ADD COLUMN IF NOT EXISTS classification TEXT
    CHECK (classification IN ('public','internal','confidential','restricted'));

ALTER TABLE meta.data_products
  ADD COLUMN IF NOT EXISTS data_steward TEXT;

ALTER TABLE meta.data_products
  ADD COLUMN IF NOT EXISTS retention_days INTEGER
    CHECK (retention_days > 0);
