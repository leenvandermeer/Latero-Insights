-- LADR-069 / WP-102: Data Product Registry v3 — extra metadata velden
-- Voegt SLA-definitie, contract-versie en deprecatie-timestamp toe aan meta.data_products.

ALTER TABLE meta.data_products
  ADD COLUMN IF NOT EXISTS sla           JSONB,        -- { freshness_minutes: int, quality_threshold: float }
  ADD COLUMN IF NOT EXISTS contract_ver  TEXT,
  ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMPTZ;

COMMENT ON COLUMN meta.data_products.sla           IS 'SLA-definitie: { freshness_minutes, quality_threshold }';
COMMENT ON COLUMN meta.data_products.contract_ver  IS 'Semantische versie van het data-contract, bijv. "1.2.0"';
COMMENT ON COLUMN meta.data_products.deprecated_at IS 'Tijdstip waarop het product als deprecated is gemarkeerd; NULL = actief';
