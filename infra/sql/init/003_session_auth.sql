-- Session-based dashboard auth with multi-org membership
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS insights_users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insights_user_installations (
  user_id UUID NOT NULL REFERENCES insights_users(user_id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL REFERENCES insights_installations(installation_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, installation_id)
);

CREATE TABLE IF NOT EXISTS insights_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES insights_users(user_id) ON DELETE CASCADE,
  active_installation_id TEXT NOT NULL REFERENCES insights_installations(installation_id),
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

ALTER TABLE insights_installations
  ADD COLUMN IF NOT EXISTS last_token_used_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sessions_user_active
  ON insights_sessions (user_id, active_installation_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_installations_installation
  ON insights_user_installations (installation_id);
