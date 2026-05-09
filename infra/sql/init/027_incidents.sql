-- LADR-069 / WP-106: Incident Management — data model
-- Incidents, workflow-stappen en evidence per installatie.

CREATE TABLE IF NOT EXISTS meta.incidents (
  id              BIGSERIAL   PRIMARY KEY,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  product_id      TEXT,
  title           TEXT        NOT NULL,
  severity        TEXT        NOT NULL DEFAULT 'medium'
                              CHECK (severity IN ('low','medium','high','critical')),
  status          TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','in_progress','resolved')),
  assignee        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  source_type     TEXT        CHECK (source_type IN ('alert','policy_violation','manual')),
  source_id       TEXT
);

CREATE INDEX IF NOT EXISTS idx_incidents_installation
  ON meta.incidents (installation_id, status, severity);

CREATE INDEX IF NOT EXISTS idx_incidents_product
  ON meta.incidents (installation_id, product_id);

-- ---------------------------------------------------------------------------
-- Workflow-stappen per incident
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.incident_steps (
  id           BIGSERIAL   PRIMARY KEY,
  incident_id  BIGINT      NOT NULL REFERENCES meta.incidents (id) ON DELETE CASCADE,
  label        TEXT        NOT NULL,
  completed_at TIMESTAMPTZ,
  completed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_incident_steps_incident
  ON meta.incident_steps (incident_id);

-- ---------------------------------------------------------------------------
-- Evidence-bijlagen per incident
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.incident_evidence (
  id            BIGSERIAL   PRIMARY KEY,
  incident_id   BIGINT      NOT NULL REFERENCES meta.incidents (id) ON DELETE CASCADE,
  evidence_type TEXT        NOT NULL,
  payload       JSONB       NOT NULL,
  attached_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_evidence_incident
  ON meta.incident_evidence (incident_id);
