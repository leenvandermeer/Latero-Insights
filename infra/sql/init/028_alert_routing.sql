-- 028_alert_routing.sql
-- Alert routing rules and alert table with routing/suppression columns

CREATE TABLE IF NOT EXISTS meta.alerts (
  id              BIGSERIAL   PRIMARY KEY,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  type            TEXT        NOT NULL,
  severity        TEXT        NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  title           TEXT        NOT NULL,
  message         TEXT,
  source_id       TEXT,
  domain          TEXT,
  product_id      TEXT,
  status          TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','suppressed')),
  routed_to       TEXT,
  routing_rule_id TEXT,
  suppressed_by   BIGINT,
  digest_batch_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ
);

-- Support suppressed_by FK after table creation
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'alerts_suppressed_by_fkey'
  ) THEN
    ALTER TABLE meta.alerts
      ADD CONSTRAINT alerts_suppressed_by_fkey
        FOREIGN KEY (suppressed_by) REFERENCES meta.incidents (id)
        ON DELETE SET NULL
        DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS meta.alert_routing_rules (
  id              TEXT        PRIMARY KEY,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  name            TEXT        NOT NULL DEFAULT '',
  conditions      JSONB       NOT NULL DEFAULT '{}',
  actions         JSONB       NOT NULL DEFAULT '{}',
  priority        SMALLINT    NOT NULL DEFAULT 0,
  active          BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_installation ON meta.alerts (installation_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_source       ON meta.alerts (installation_id, source_id);
CREATE INDEX IF NOT EXISTS idx_routing_rules_inst  ON meta.alert_routing_rules (installation_id, active, priority);
