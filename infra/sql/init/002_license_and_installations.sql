-- WP-5.1 / WP-5.6 — License validation fields and adapter version tracking
-- Safe to run multiple times (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- Friendly label for installations (used in admin UI)
ALTER TABLE insights_installations
  ADD COLUMN IF NOT EXISTS label TEXT;

-- Tier (was 'subscription_tier' in early schema — correct column name is 'tier')
ALTER TABLE insights_installations
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'pro';

-- contact_email for tenant operator contact
ALTER TABLE insights_installations
  ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- License expiry for 403 response (LLIC-002)
ALTER TABLE insights_installations
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;

-- Tracks adapter_version per license validation call (LLIC-003)
CREATE TABLE IF NOT EXISTS adapter_version_log (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id TEXT      NOT NULL,
  adapter_package TEXT      NOT NULL,
  adapter_version TEXT      NOT NULL,
  validated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adapter_version_installation
  ON adapter_version_log (installation_id, validated_at DESC);
