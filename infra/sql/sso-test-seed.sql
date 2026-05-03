-- SSO test seed — Latero installatie met Keycloak config
--
-- Dit script maakt een kant-en-klare testomgeving:
--   1. Installatie "Latero (SSO Test)"
--   2. Auth policy: sso_with_local_fallback + JIT provisioning
--   3. SSO config: lokale Keycloak (latero-test realm)
--   4. Break-glass admin: admin@latero.local / LateroAdmin1!
--      (lokale fallback voor als SSO niet beschikbaar is)
--
-- Gebruik:
--   npm run sso:seed
--
-- Vereisten:
--   - infra stack draait: npm run infra:up
--   - SSO stack draait:   npm run sso:up
--   - Keycloak is healthy (wacht op: npm run sso:logs → "Running")
--
-- Keycloak testgebruikers (aangemaakt via realm import):
--   alice@acme.test  /  Test1234!  → groep: latero-users  → rol: member
--   bob@acme.test    /  Test1234!  → groep: latero-admins → rol: admin
--
-- Na dit script:
--   1. Start de app: npm run dev
--   2. Log in op http://localhost:3010 met admin@latero.local / LateroAdmin1!
--   3. Ga naar Admin → Installaties → Latero (SSO Test)
--   4. Klik "Auth configuration" → config is al ingevuld
--   5. Test de SSO login via: http://localhost:3010 met alice@acme.test

\set ON_ERROR_STOP on

-- ============================================================
-- 1. Installatie
-- ============================================================
INSERT INTO insights_installations (installation_id, label, environment, tier, token_hash, active)
VALUES (
  'sso-test-acme',
  'Latero (SSO Test)',
  'test',
  'enterprise',
  -- token hash van 'sso-test-token-local' (SHA-256, nooit in productie gebruiken)
  'b7e6f2c9a1d4e8f0b3c5a7d9e2f1b4c6a8d0e3f5b7c9a1d3e5f7b9c0a2d4e6f8',
  TRUE
)
ON CONFLICT (installation_id) DO UPDATE SET
  label       = EXCLUDED.label,
  environment = EXCLUDED.environment,
  tier        = EXCLUDED.tier,
  active      = EXCLUDED.active;

-- ============================================================
-- 2. Auth policy: SSO with local fallback + JIT
-- ============================================================
INSERT INTO installation_auth_policy
  (installation_id, auth_mode, jit_provisioning, jit_default_role, allowed_domains, break_glass_enabled)
VALUES
  ('sso-test-acme', 'sso_with_local_fallback', TRUE, 'member', ARRAY['acme.test'], TRUE)
ON CONFLICT (installation_id) DO UPDATE SET
  auth_mode           = EXCLUDED.auth_mode,
  jit_provisioning    = EXCLUDED.jit_provisioning,
  jit_default_role    = EXCLUDED.jit_default_role,
  allowed_domains     = EXCLUDED.allowed_domains,
  break_glass_enabled = EXCLUDED.break_glass_enabled;

-- ============================================================
-- 3. SSO config: lokale Keycloak
--    Issuer: http://localhost:8080/realms/latero-test
--    (HTTP werkt in Keycloak dev mode voor localhost redirect URIs)
--    Voor TLS via Caddy: https://idp.latero.local/realms/latero-test
-- ============================================================
INSERT INTO installation_sso_config
  (installation_id, issuer, client_id, client_secret_ref, redirect_uri,
   scopes, allowed_groups, pkce_required, enabled, role_mapping)
VALUES (
  'sso-test-acme',
  'http://localhost:8080/realms/latero-test',
  'latero-control',
  'OIDC_CLIENT_SECRET',
  'http://localhost:3010/api/auth/sso/callback',
  ARRAY['openid', 'email', 'profile'],
  NULL,
  TRUE,
  TRUE,
  '{"latero-admins": "admin", "latero-users": "member"}'::jsonb
)
ON CONFLICT (installation_id) DO UPDATE SET
  issuer            = EXCLUDED.issuer,
  client_id         = EXCLUDED.client_id,
  client_secret_ref = EXCLUDED.client_secret_ref,
  redirect_uri      = EXCLUDED.redirect_uri,
  scopes            = EXCLUDED.scopes,
  allowed_groups    = EXCLUDED.allowed_groups,
  pkce_required     = EXCLUDED.pkce_required,
  enabled           = EXCLUDED.enabled,
  role_mapping      = EXCLUDED.role_mapping;

-- ============================================================
-- 4. Break-glass admin account
--    Wachtwoord: LateroAdmin1!
--    Dit account werkt altijd via lokale login, ook als SSO is ingeschakeld.
--    Vervang het wachtwoord zo snel mogelijk via de admin UI.
-- ============================================================
INSERT INTO insights_users (user_id, email, password_hash, active, is_admin, is_break_glass)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@latero.local',
  crypt('LateroAdmin1!', gen_salt('bf', 12)),
  TRUE,
  FALSE,  -- platform-only account: is_admin=FALSE, toegang via is_break_glass
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  password_hash  = crypt('LateroAdmin1!', gen_salt('bf', 12)),
  is_admin       = FALSE,
  is_break_glass = TRUE,
  active         = TRUE;

-- admin@latero.local is een platform operator, geen tenant-lid.
-- Verwijder eventuele installation_members koppelingen.
DELETE FROM insights_user_installations
WHERE user_id = '00000000-0000-0000-0000-000000000001';

-- is_break_glass zorgt ervoor dat lokale login werkt ook bij sso_only policy
UPDATE insights_users SET is_break_glass = TRUE WHERE email = 'admin@latero.local';
