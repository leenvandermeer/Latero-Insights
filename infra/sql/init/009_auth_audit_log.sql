-- WP6: Auth audit logging
-- Registreert auth-events voor forensisch gebruik en operationele monitoring.
-- Bewaarregel: events worden niet automatisch verwijderd; retention is operators-verantwoordelijkheid.
-- Security: tokens, wachtwoorden en volledige claim-payloads worden NOOIT gelogd.
-- detail-kolom bevat alleen beschrijvende tekst zonder gevoelige waarden.
-- Safe to run multiple times (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS auth_audit_log (
  event_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT        NOT NULL
                    CHECK (event_type IN (
                      'local_login',
                      'local_login_blocked',
                      'sso_login',
                      'sso_callback_failure',
                      'logout',
                      'installation_switch'
                    )),
  outcome         TEXT        NOT NULL
                    CHECK (outcome IN ('success', 'failure')),
  user_id         UUID        REFERENCES insights_users(user_id) ON DELETE SET NULL,
  installation_id TEXT        REFERENCES insights_installations(installation_id) ON DELETE SET NULL,
  ip_address      TEXT,
  user_agent      TEXT,
  -- Beschrijvende context, GEEN tokens, wachtwoorden of claim-payloads
  detail          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id
  ON auth_audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_created_at
  ON auth_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_event_type
  ON auth_audit_log (event_type, outcome);
