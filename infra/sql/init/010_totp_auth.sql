-- LADR-036: TOTP 2FA voor lokale accounts
-- Dit script is idempotent en kan meerdere keren worden uitgevoerd.

-- Zorg dat pgcrypto beschikbaar is (al aangemaakt door bootstrap, maar defensief herhalen)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypted TOTP secret kolom op insights_users
ALTER TABLE insights_users
  ADD COLUMN IF NOT EXISTS totp_secret_enc TEXT;

-- Backup codes tabel (single-use, SHA-256 gehashed)
CREATE TABLE IF NOT EXISTS insights_totp_backup_codes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES insights_users(user_id) ON DELETE CASCADE,
  code_hash    TEXT        NOT NULL,
  used_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_totp_backup_codes_user_id
  ON insights_totp_backup_codes(user_id);

-- Tijdstip waarop TOTP-setup werd voltooid (NULL = niet ingeschakeld)
ALTER TABLE insights_users
  ADD COLUMN IF NOT EXISTS totp_verified_at TIMESTAMPTZ;

-- Pending 2FA: short-lived token tussen wachtwoord-check en TOTP-verificatie
-- Verlopen records worden opgeruimd door de app (expires_at check).
CREATE TABLE IF NOT EXISTS insights_pending_2fa (
  token_hash      TEXT        PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES insights_users(user_id) ON DELETE CASCADE,
  installation_id TEXT        NOT NULL REFERENCES insights_installations(installation_id),
  ip_address      TEXT,
  user_agent      TEXT,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_2fa_expires
  ON insights_pending_2fa (expires_at);
