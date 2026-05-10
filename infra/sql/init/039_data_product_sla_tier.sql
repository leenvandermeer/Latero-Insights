-- LADR: voegt ontbrekende sla_tier kolom toe aan meta.data_products
-- De kolom was overal in de codebase aanwezig maar nooit gemigrated.
-- sla_tier is de tier-classificatie (bronze/silver/gold), los van de sla JSONB
-- die SLA-parameters (freshness_minutes, quality_threshold) bevat.

ALTER TABLE meta.data_products
  ADD COLUMN IF NOT EXISTS sla_tier TEXT CHECK (sla_tier IN ('bronze', 'silver', 'gold'));

COMMENT ON COLUMN meta.data_products.sla_tier IS 'SLA-tier classificatie: bronze, silver of gold';
