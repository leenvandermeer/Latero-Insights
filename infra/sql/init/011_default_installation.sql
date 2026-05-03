-- Migration 011: default_installation_id per user (LADR-038)
-- Allows users to set a preferred installation that is auto-selected on login.

ALTER TABLE insights_users
  ADD COLUMN IF NOT EXISTS default_installation_id TEXT
  REFERENCES insights_installations(installation_id) ON DELETE SET NULL;
