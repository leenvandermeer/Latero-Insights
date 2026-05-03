-- WP2: SSO external identities, installation-scoped auth policy, and SSO configuration
-- Migratie-patroon: infra/sql/init/ is leidend voor alle schema-wijzigingen.
-- Inline DDL via ensureAuthSchema() is niet toegestaan voor SSO-tabellen.
-- Safe to run multiple times (IF NOT EXISTS / ON CONFLICT guards).
--
-- Secrets-opslagcontract:
--   OIDC client_secret en JWKS-gerelateerde waarden worden NIET opgeslagen in
--   deze tabel of in .cache/settings.json.
--   Opslagvorm: environment-variabele (OIDC_CLIENT_SECRET) of Docker secrets mount.
--   installation_sso_config slaat alleen niet-geheime configuratiewaarden op
--   (issuer, client_id, allowed_domains, redirect_uri).
--   client_secret_ref is een optioneel label/pad naar het secrets-mechanisme,
--   niet de secret-waarde zelf.

-- ============================================================
-- Tabel 1: external_identities
-- Koppelt een externe IdP-identity (issuer + subject) aan een lokale Latero-user.
-- Identity binding is altijd op (issuer, subject) — email is informationeel.
-- ============================================================
CREATE TABLE IF NOT EXISTS external_identities (
  identity_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES insights_users(user_id) ON DELETE CASCADE,
  issuer           TEXT        NOT NULL,
  subject          TEXT        NOT NULL,  -- IdP sub claim
  email_hint       TEXT,                  -- informationeel, niet gebruikt voor linking
  display_name     TEXT,
  linked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at    TIMESTAMPTZ,
  CONSTRAINT uq_external_identity UNIQUE (issuer, subject)
);

CREATE INDEX IF NOT EXISTS idx_external_identities_user_id
  ON external_identities (user_id);

-- ============================================================
-- Tabel 2: installation_auth_policy
-- Definieert het auth-gedrag per installatie.
-- auth_mode: sso_only | sso_with_break_glass | sso_with_local_fallback | local_only
-- jit_provisioning: als TRUE, worden nieuwe gebruikers automatisch aangemaakt na
--   succesvolle federated login (deny-by-default: FALSE).
-- ============================================================
CREATE TABLE IF NOT EXISTS installation_auth_policy (
  installation_id       TEXT        PRIMARY KEY REFERENCES insights_installations(installation_id) ON DELETE CASCADE,
  auth_mode             TEXT        NOT NULL DEFAULT 'local_only'
                          CHECK (auth_mode IN ('sso_only', 'sso_with_break_glass', 'sso_with_local_fallback', 'local_only')),
  jit_provisioning      BOOLEAN     NOT NULL DEFAULT FALSE,
  jit_default_role      TEXT        NOT NULL DEFAULT 'member',
  allowed_domains       TEXT[],              -- optionele allowlist van e-maildomeinen voor JIT
  break_glass_enabled   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alle bestaande installaties krijgen local_only als default policy.
INSERT INTO installation_auth_policy (installation_id, auth_mode)
SELECT installation_id, 'local_only'
FROM insights_installations
ON CONFLICT (installation_id) DO NOTHING;

-- ============================================================
-- Tabel 3: installation_sso_config
-- Slaat OIDC-configuratie per installatie op.
-- Bevat GEEN client_secret — zie secrets-opslagcontract bovenaan dit bestand.
-- client_secret_ref is optioneel; het bevat een label of mount-pad, geen secret-waarde.
-- ============================================================
CREATE TABLE IF NOT EXISTS installation_sso_config (
  installation_id   TEXT        PRIMARY KEY REFERENCES insights_installations(installation_id) ON DELETE CASCADE,
  issuer            TEXT        NOT NULL,   -- OIDC issuer URL (ook JWKS base URL)
  client_id         TEXT        NOT NULL,
  client_secret_ref TEXT,                   -- optioneel: label/pad naar secret, NOOIT de waarde
  redirect_uri      TEXT        NOT NULL,
  scopes            TEXT[]      NOT NULL DEFAULT ARRAY['openid', 'email', 'profile'],
  allowed_groups    TEXT[],                 -- optionele IdP-groups die toegang krijgen
  pkce_required     BOOLEAN     NOT NULL DEFAULT TRUE,
  enabled           BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Markering voor break-glass accounts op insights_users
-- Break-glass accounts mogen lokaal inloggen ook als de installatie sso_only is.
-- ============================================================
ALTER TABLE insights_users
  ADD COLUMN IF NOT EXISTS is_break_glass BOOLEAN NOT NULL DEFAULT FALSE;
