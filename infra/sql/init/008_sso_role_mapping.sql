-- WP5: SSO role mapping per installatie
-- Voegt role_mapping JSONB toe aan installation_sso_config.
-- Formaat: { "GroupName": "member", "AdminGroup": "admin" }
-- Admin-escalatie via SSO-claims is uitsluitend op de installation-rol van toepassing,
-- nooit op insights_users.is_admin (platform-admin).
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

ALTER TABLE installation_sso_config
  ADD COLUMN IF NOT EXISTS role_mapping JSONB NOT NULL DEFAULT '{}';
