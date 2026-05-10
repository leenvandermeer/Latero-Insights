-- Migration 038: voeg tier, contact_email en last_synced_at toe aan insights_installations
-- Kolommen die door de app verwacht worden maar ontbraken in de initiële schema.
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS).

ALTER TABLE insights_installations
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'pro';

ALTER TABLE insights_installations
  ADD COLUMN IF NOT EXISTS contact_email TEXT;

ALTER TABLE insights_installations
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
