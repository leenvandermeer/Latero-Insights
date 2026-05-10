-- =============================================================================
-- Latero Control — Canonical Production Schema
-- =============================================================================
-- Dit is het ENIGE gezaghebbende schema-bestand voor nieuwe installaties.
-- De afzonderlijke scripts in infra/sql/init/ zijn vervallen als initialisatie-
-- bron; dit bestand vervangt ze volledig.
--
-- Gebruik:
--   Nieuwe installatie  → dit bestand uitvoeren
--   Bestaande database  → alleen ontbrekende stukken uitvoeren (scripts zijn idempotent)
--
-- Volgorde van secties:
--   1. Extensies
--   2. Platform-tabellen (installaties, gebruikers, sessies, audit)
--   3. SSO-tabellen
--   4. meta.* schema (operationeel datamodel)
-- =============================================================================

-- =============================================================================
-- 1. Extensies
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 2. Platform-tabellen
-- =============================================================================

-- -----------------------------------------------------------------------------
-- insights_installations — tenants / installaties
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insights_installations (
  installation_id TEXT        PRIMARY KEY,
  label           TEXT,
  environment     TEXT        NOT NULL,
  tier            TEXT        NOT NULL DEFAULT 'pro',
  contact_email   TEXT,
  token_hash      TEXT        NOT NULL,
  active          BOOLEAN     NOT NULL DEFAULT TRUE,
  last_synced_at  TIMESTAMPTZ,
  valid_until     TIMESTAMPTZ,
  last_token_used_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- insights_users — platform- en tenant-gebruikers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insights_users (
  user_id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                  TEXT        NOT NULL UNIQUE,
  password_hash          TEXT        NOT NULL,
  two_factor_enabled     BOOLEAN     NOT NULL DEFAULT FALSE,
  totp_secret_enc        TEXT,
  totp_verified_at       TIMESTAMPTZ,
  is_admin               BOOLEAN     NOT NULL DEFAULT FALSE,
  is_break_glass         BOOLEAN     NOT NULL DEFAULT FALSE,
  default_installation_id TEXT       REFERENCES insights_installations(installation_id) ON DELETE SET NULL,
  active                 BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- insights_user_installations — koppeltabel gebruiker ↔ installatie
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insights_user_installations (
  user_id         UUID        NOT NULL REFERENCES insights_users(user_id) ON DELETE CASCADE,
  installation_id TEXT        NOT NULL REFERENCES insights_installations(installation_id) ON DELETE CASCADE,
  role            TEXT        NOT NULL DEFAULT 'member',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, installation_id)
);

CREATE INDEX IF NOT EXISTS idx_user_installations_installation
  ON insights_user_installations (installation_id);

-- -----------------------------------------------------------------------------
-- insights_sessions — authenticatiesessies
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insights_sessions (
  session_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash             TEXT        NOT NULL UNIQUE,
  user_id                UUID        NOT NULL REFERENCES insights_users(user_id) ON DELETE CASCADE,
  active_installation_id TEXT        REFERENCES insights_installations(installation_id) ON DELETE SET NULL,
  user_agent             TEXT,
  ip_address             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at             TIMESTAMPTZ NOT NULL,
  revoked_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_active
  ON insights_sessions (user_id, active_installation_id)
  WHERE revoked_at IS NULL;

-- -----------------------------------------------------------------------------
-- insights_pending_2fa — tijdelijk token tussen wachtwoord-check en TOTP
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- insights_totp_backup_codes — single-use backup codes voor TOTP
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insights_totp_backup_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES insights_users(user_id) ON DELETE CASCADE,
  code_hash   TEXT        NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_totp_backup_codes_user_id
  ON insights_totp_backup_codes(user_id);

-- -----------------------------------------------------------------------------
-- insights_password_resets
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insights_password_resets (
  user_id    UUID        PRIMARY KEY REFERENCES insights_users(user_id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at
  ON insights_password_resets(expires_at);

-- -----------------------------------------------------------------------------
-- insights_audit_logs — admin operaties
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insights_audit_logs (
  id            SERIAL      PRIMARY KEY,
  admin_user_id UUID        NOT NULL REFERENCES insights_users(user_id) ON DELETE CASCADE,
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50)  NOT NULL,
  resource_id   VARCHAR(255),
  changes       JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user_id ON insights_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at    ON insights_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action        ON insights_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource      ON insights_audit_logs(resource_type, resource_id);

-- -----------------------------------------------------------------------------
-- insights_installation_health — health-metrics per installatie
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insights_installation_health (
  id                      SERIAL       PRIMARY KEY,
  installation_id         VARCHAR(255) NOT NULL REFERENCES insights_installations(installation_id) ON DELETE CASCADE,
  status                  VARCHAR(50),
  message_count_24h       INTEGER      DEFAULT 0,
  error_rate_pct          NUMERIC(5,2) DEFAULT 0,
  postgres_latency_ms     INTEGER      DEFAULT 0,
  api_response_time_p95_ms INTEGER     DEFAULT 0,
  cache_hit_ratio         NUMERIC(5,4) DEFAULT 0,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_installation_id
  ON insights_installation_health(installation_id);
CREATE INDEX IF NOT EXISTS idx_health_created_at
  ON insights_installation_health(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_installation_created
  ON insights_installation_health(installation_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- auth_audit_log — forensisch auth-log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_audit_log (
  event_id        UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT   NOT NULL
                         CHECK (event_type IN (
                           'local_login','local_login_blocked','sso_login',
                           'sso_callback_failure','logout','installation_switch'
                         )),
  outcome         TEXT   NOT NULL CHECK (outcome IN ('success','failure')),
  user_id         UUID   REFERENCES insights_users(user_id) ON DELETE SET NULL,
  installation_id TEXT   REFERENCES insights_installations(installation_id) ON DELETE SET NULL,
  ip_address      TEXT,
  user_agent      TEXT,
  detail          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id    ON auth_audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_created_at ON auth_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_event_type ON auth_audit_log (event_type, outcome);

-- -----------------------------------------------------------------------------
-- ingest_audit
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingest_audit (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint        TEXT    NOT NULL,
  installation_id TEXT,
  status_code     INTEGER NOT NULL,
  request_body    JSONB,
  response_body   JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- adapter_version_log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS adapter_version_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id TEXT NOT NULL,
  adapter_package TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  validated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adapter_version_installation
  ON adapter_version_log (installation_id, validated_at DESC);

-- =============================================================================
-- 3. SSO-tabellen
-- =============================================================================

-- -----------------------------------------------------------------------------
-- external_identities — IdP-koppeling per gebruiker
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS external_identities (
  identity_id  UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID  NOT NULL REFERENCES insights_users(user_id) ON DELETE CASCADE,
  issuer       TEXT  NOT NULL,
  subject      TEXT  NOT NULL,
  email_hint   TEXT,
  display_name TEXT,
  linked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  CONSTRAINT uq_external_identity UNIQUE (issuer, subject)
);

CREATE INDEX IF NOT EXISTS idx_external_identities_user_id
  ON external_identities (user_id);

-- -----------------------------------------------------------------------------
-- installation_auth_policy — auth-modus per installatie
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS installation_auth_policy (
  installation_id    TEXT    PRIMARY KEY REFERENCES insights_installations(installation_id) ON DELETE CASCADE,
  auth_mode          TEXT    NOT NULL DEFAULT 'local_only'
                             CHECK (auth_mode IN ('sso_only','sso_with_break_glass','sso_with_local_fallback','local_only')),
  jit_provisioning   BOOLEAN NOT NULL DEFAULT FALSE,
  jit_default_role   TEXT    NOT NULL DEFAULT 'member',
  allowed_domains    TEXT[],
  break_glass_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Nieuwe installaties krijgen automatisch local_only policy
CREATE OR REPLACE FUNCTION fn_default_auth_policy()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO installation_auth_policy (installation_id, auth_mode)
  VALUES (NEW.installation_id, 'local_only')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_default_auth_policy ON insights_installations;
CREATE TRIGGER trg_default_auth_policy
  AFTER INSERT ON insights_installations
  FOR EACH ROW EXECUTE FUNCTION fn_default_auth_policy();

-- Backfill voor bestaande installaties
INSERT INTO installation_auth_policy (installation_id, auth_mode)
SELECT installation_id, 'local_only'
FROM insights_installations
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- installation_sso_config — OIDC-configuratie per installatie
-- Bevat GEEN client_secret (zie AGENTS.md guardrails)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS installation_sso_config (
  installation_id   TEXT    PRIMARY KEY REFERENCES insights_installations(installation_id) ON DELETE CASCADE,
  issuer            TEXT    NOT NULL,
  client_id         TEXT    NOT NULL,
  client_secret_ref TEXT,
  redirect_uri      TEXT    NOT NULL,
  scopes            TEXT[]  NOT NULL DEFAULT ARRAY['openid','email','profile'],
  allowed_groups    TEXT[],
  role_mapping      JSONB   NOT NULL DEFAULT '{}',
  pkce_required     BOOLEAN NOT NULL DEFAULT TRUE,
  enabled           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 4. meta.* schema — operationeel datamodel
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS meta;

-- -----------------------------------------------------------------------------
-- meta.datasets
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.datasets (
  dataset_id      TEXT        NOT NULL,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  layer           TEXT        NOT NULL DEFAULT 'unknown'
                              CHECK (layer IN ('landing','raw','bronze','silver','gold','unknown')),
  namespace       TEXT        NOT NULL,
  object_name     TEXT        NOT NULL,
  platform        TEXT        NOT NULL DEFAULT 'UNKNOWN'
                              CHECK (platform IN ('ICEBERG','DELTA','HIVE','JDBC','FILE','TOPIC','UNKNOWN')),
  entity_type     TEXT        NOT NULL DEFAULT 'TABLE'
                              CHECK (entity_type IN ('TABLE','VIEW','STREAM','FILE','TOPIC')),
  source_system   TEXT,
  entity_id       TEXT,
  dataset_facets  JSONB,
  dataset_name    TEXT GENERATED ALWAYS AS (split_part(dataset_id, '::', 1)) STORED,
  valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to        TIMESTAMPTZ,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (installation_id, dataset_id, layer)
);

CREATE INDEX IF NOT EXISTS idx_meta_datasets_installation_id
  ON meta.datasets (installation_id, dataset_id);
CREATE INDEX IF NOT EXISTS idx_meta_datasets_entity
  ON meta.datasets (installation_id, entity_id);
CREATE INDEX IF NOT EXISTS idx_datasets_temporal
  ON meta.datasets (installation_id, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_meta_datasets_name
  ON meta.datasets (installation_id, dataset_name);

-- -----------------------------------------------------------------------------
-- meta.jobs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.jobs (
  job_id          UUID  NOT NULL DEFAULT gen_random_uuid(),
  installation_id TEXT  NOT NULL REFERENCES insights_installations (installation_id),
  job_name        TEXT  NOT NULL,
  job_namespace   TEXT  NOT NULL DEFAULT 'latero',
  job_type        TEXT  NOT NULL DEFAULT 'PIPELINE'
                        CHECK (job_type IN ('PIPELINE','SYNC','VALIDATION')),
  dataset_id      TEXT,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id),
  UNIQUE (installation_id, job_name)
);

-- -----------------------------------------------------------------------------
-- meta.runs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.runs (
  run_id          UUID  NOT NULL DEFAULT gen_random_uuid(),
  job_id          UUID  NOT NULL REFERENCES meta.jobs (job_id),
  installation_id TEXT  NOT NULL REFERENCES insights_installations (installation_id),
  external_run_id TEXT  NOT NULL,
  parent_run_id   UUID  REFERENCES meta.runs (run_id),
  status          TEXT  NOT NULL
                        CHECK (status IN ('SUCCESS','FAILED','WARNING','RUNNING')),
  environment     TEXT  NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ,
  duration_ms     BIGINT,
  run_date        DATE GENERATED ALWAYS AS ((started_at AT TIME ZONE 'UTC')::date) STORED,
  run_facets      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id),
  CONSTRAINT meta_runs_installation_id_external_run_id_run_date_key
    UNIQUE (installation_id, external_run_id, run_date)
);

CREATE INDEX IF NOT EXISTS idx_meta_runs_installation_date
  ON meta.runs (installation_id, run_date DESC);
CREATE INDEX IF NOT EXISTS idx_meta_runs_job_date
  ON meta.runs (job_id, run_date DESC);

-- -----------------------------------------------------------------------------
-- meta.run_io
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.run_io (
  id              UUID  NOT NULL DEFAULT gen_random_uuid(),
  run_id          UUID  NOT NULL REFERENCES meta.runs (run_id),
  installation_id TEXT  NOT NULL REFERENCES insights_installations (installation_id),
  dataset_id      TEXT  NOT NULL,
  layer           TEXT,
  role            TEXT  NOT NULL CHECK (role IN ('INPUT','OUTPUT')),
  observed_at     TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT meta_run_io_unique_run_entity_layer_role
    UNIQUE (run_id, dataset_id, layer, role)
);

CREATE INDEX IF NOT EXISTS idx_meta_run_io_run     ON meta.run_io (run_id);
CREATE INDEX IF NOT EXISTS idx_meta_run_io_dataset ON meta.run_io (installation_id, dataset_id);

-- -----------------------------------------------------------------------------
-- meta.quality_rules
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.quality_rules (
  check_id        TEXT        NOT NULL,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  check_name      TEXT,
  check_category  TEXT
                  CHECK (check_category IS NULL OR check_category IN (
                    'schema','accuracy','completeness','freshness','uniqueness','custom'
                  )),
  severity        TEXT        NOT NULL DEFAULT 'MEDIUM'
                              CHECK (severity IN ('HIGH','MEDIUM','LOW')),
  check_mode      TEXT,
  policy_version  TEXT,
  dataset_id      TEXT,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (installation_id, check_id)
);

-- -----------------------------------------------------------------------------
-- meta.quality_results
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.quality_results (
  result_id       UUID  NOT NULL DEFAULT gen_random_uuid(),
  check_id        TEXT  NOT NULL,
  installation_id TEXT  NOT NULL,
  run_id          UUID  REFERENCES meta.runs (run_id),
  status          TEXT  NOT NULL CHECK (status IN ('SUCCESS','FAILED','WARNING')),
  result_value    NUMERIC,
  threshold_value NUMERIC,
  message         TEXT,
  check_result    TEXT,
  executed_at     TIMESTAMPTZ NOT NULL,
  result_date     DATE GENERATED ALWAYS AS ((executed_at AT TIME ZONE 'UTC')::date) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (result_id),
  FOREIGN KEY (installation_id, check_id) REFERENCES meta.quality_rules (installation_id, check_id),
  UNIQUE (installation_id, check_id, run_id, result_date)
);

CREATE INDEX IF NOT EXISTS idx_meta_quality_results_installation_date
  ON meta.quality_results (installation_id, result_date DESC);
CREATE INDEX IF NOT EXISTS idx_meta_quality_results_check_date
  ON meta.quality_results (installation_id, check_id, result_date DESC);

-- -----------------------------------------------------------------------------
-- meta.lineage_edges
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.lineage_edges (
  edge_id               UUID  NOT NULL DEFAULT gen_random_uuid(),
  installation_id       TEXT  NOT NULL REFERENCES insights_installations (installation_id),
  source_dataset_id     TEXT  NOT NULL,
  source_layer          TEXT,
  target_dataset_id     TEXT  NOT NULL,
  target_layer          TEXT,
  first_observed_run    UUID  REFERENCES meta.runs (run_id),
  last_observed_run     UUID  REFERENCES meta.runs (run_id),
  source_kind           TEXT  NOT NULL DEFAULT 'dataset'
                              CHECK (source_kind IN ('dataset', 'entity')),
  target_kind           TEXT  NOT NULL DEFAULT 'dataset'
                              CHECK (target_kind IN ('dataset', 'entity')),
  first_observed_at     TIMESTAMPTZ NOT NULL,
  last_observed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  observation_count     INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (edge_id),
  CONSTRAINT meta_lineage_edges_unique_hop
    UNIQUE (installation_id, source_dataset_id, source_layer, target_dataset_id, target_layer)
);

CREATE INDEX IF NOT EXISTS idx_meta_lineage_edges_source
  ON meta.lineage_edges (installation_id, source_dataset_id);
CREATE INDEX IF NOT EXISTS idx_meta_lineage_edges_target
  ON meta.lineage_edges (installation_id, target_dataset_id);

-- -----------------------------------------------------------------------------
-- meta.lineage_columns
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.lineage_columns (
  column_edge_id        UUID  NOT NULL DEFAULT gen_random_uuid(),
  installation_id       TEXT  NOT NULL REFERENCES insights_installations (installation_id),
  source_dataset_id     TEXT  NOT NULL,
  source_layer          TEXT,
  source_column         TEXT  NOT NULL,
  target_dataset_id     TEXT  NOT NULL,
  target_layer          TEXT,
  target_column         TEXT  NOT NULL,
  transformation_type   TEXT
                        CHECK (transformation_type IS NULL OR transformation_type IN ('DIRECT','INDIRECT','UNKNOWN')),
  transformation_subtype TEXT
                        CHECK (transformation_subtype IS NULL OR transformation_subtype IN (
                          'IDENTITY','AGGREGATION','FILTER','MASKING','RENAME','DERIVED'
                        )),
  first_observed_at     TIMESTAMPTZ NOT NULL,
  last_observed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (column_edge_id),
  CONSTRAINT meta_lineage_columns_unique_hop
    UNIQUE (installation_id, source_dataset_id, source_layer, source_column,
            target_dataset_id, target_layer, target_column)
);

CREATE INDEX IF NOT EXISTS idx_meta_lineage_columns_source
  ON meta.lineage_columns (installation_id, source_dataset_id, source_column);
CREATE INDEX IF NOT EXISTS idx_meta_lineage_columns_target
  ON meta.lineage_columns (installation_id, target_dataset_id, target_column);

-- -----------------------------------------------------------------------------
-- meta.data_products
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.data_products (
  data_product_id TEXT        NOT NULL,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  display_name    TEXT        NOT NULL,
  description     TEXT,
  owner           TEXT,
  domain          TEXT,
  tags            JSONB       NOT NULL DEFAULT '{}',
  sla_tier        TEXT        CHECK (sla_tier IN ('bronze', 'silver', 'gold')),
  sla             JSONB,
  contract_ver    TEXT,
  deprecated_at   TIMESTAMPTZ,
  valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (installation_id, data_product_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_data_products_installation
  ON meta.data_products (installation_id);
CREATE INDEX IF NOT EXISTS idx_data_products_temporal
  ON meta.data_products (installation_id, valid_from, valid_to);

-- -----------------------------------------------------------------------------
-- meta.entities
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.entities (
  entity_id       TEXT        NOT NULL,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  data_product_id TEXT,
  entity_name     TEXT,
  display_name    TEXT,
  description     TEXT,
  source_system   TEXT,
  owner           TEXT,
  tags            JSONB       NOT NULL DEFAULT '{}',
  is_context_node BOOLEAN     NOT NULL DEFAULT FALSE,
  valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (installation_id, entity_id),
  CONSTRAINT meta_entities_data_product_fk
    FOREIGN KEY (installation_id, data_product_id)
    REFERENCES meta.data_products (installation_id, data_product_id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_meta_entities_installation
  ON meta.entities (installation_id);
CREATE INDEX IF NOT EXISTS idx_meta_entities_data_product
  ON meta.entities (installation_id, data_product_id);
CREATE INDEX IF NOT EXISTS idx_entities_temporal
  ON meta.entities (installation_id, valid_from, valid_to);

-- -----------------------------------------------------------------------------
-- meta.entity_sources
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.entity_sources (
  id                UUID        NOT NULL DEFAULT gen_random_uuid(),
  installation_id   TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  entity_id         TEXT        NOT NULL,
  source_dataset_id TEXT        NOT NULL,
  source_layer      TEXT        NOT NULL
                                CHECK (source_layer IN ('bronze', 'silver')),
  first_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_observed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (installation_id, entity_id, source_dataset_id),
  CONSTRAINT meta_entity_sources_entity_fk
    FOREIGN KEY (installation_id, entity_id)
    REFERENCES meta.entities (installation_id, entity_id)
    ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- meta.trust_score_snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.trust_score_snapshots (
  id              BIGSERIAL   PRIMARY KEY,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  product_id      TEXT        NOT NULL,
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  score           SMALLINT    NOT NULL CHECK (score BETWEEN 0 AND 100),
  factors         JSONB       NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trust_snapshots_product
  ON meta.trust_score_snapshots (installation_id, product_id, calculated_at DESC);

-- -----------------------------------------------------------------------------
-- meta.incidents
-- -----------------------------------------------------------------------------
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
  source_type     TEXT        CHECK (source_type IN ('alert','policy_violation','manual')),
  source_id       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_incidents_installation ON meta.incidents (installation_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_incidents_product      ON meta.incidents (installation_id, product_id);

CREATE TABLE IF NOT EXISTS meta.incident_steps (
  id           BIGSERIAL PRIMARY KEY,
  incident_id  BIGINT    NOT NULL REFERENCES meta.incidents (id) ON DELETE CASCADE,
  label        TEXT      NOT NULL,
  completed_at TIMESTAMPTZ,
  completed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_incident_steps_incident ON meta.incident_steps (incident_id);

CREATE TABLE IF NOT EXISTS meta.incident_evidence (
  id            BIGSERIAL PRIMARY KEY,
  incident_id   BIGINT    NOT NULL REFERENCES meta.incidents (id) ON DELETE CASCADE,
  evidence_type TEXT      NOT NULL,
  payload       JSONB     NOT NULL,
  attached_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_evidence_incident ON meta.incident_evidence (incident_id);

-- -----------------------------------------------------------------------------
-- meta.alerts + meta.alert_routing_rules
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.alerts (
  id              BIGSERIAL   PRIMARY KEY,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  type            TEXT        NOT NULL,
  severity        TEXT        NOT NULL DEFAULT 'medium'
                              CHECK (severity IN ('low','medium','high','critical')),
  title           TEXT        NOT NULL,
  message         TEXT,
  source_id       TEXT,
  domain          TEXT,
  product_id      TEXT,
  status          TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','acknowledged','resolved','suppressed')),
  routed_to       TEXT,
  routing_rule_id TEXT,
  suppressed_by   BIGINT,
  digest_batch_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alerts_suppressed_by_fkey') THEN
    ALTER TABLE meta.alerts
      ADD CONSTRAINT alerts_suppressed_by_fkey
        FOREIGN KEY (suppressed_by) REFERENCES meta.incidents (id)
        ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
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

-- -----------------------------------------------------------------------------
-- meta.business_outputs + meta.product_output_links
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.business_outputs (
  id              TEXT        NOT NULL,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  name            TEXT        NOT NULL,
  output_type     TEXT        NOT NULL CHECK (output_type IN ('kpi','dashboard','process','report','risk')),
  owner_team      TEXT,
  criticality     TEXT        NOT NULL DEFAULT 'medium'
                              CHECK (criticality IN ('low','medium','high','critical')),
  description     TEXT,
  PRIMARY KEY (installation_id, id)
);

CREATE INDEX IF NOT EXISTS idx_business_outputs_installation
  ON meta.business_outputs (installation_id, output_type);

CREATE TABLE IF NOT EXISTS meta.product_output_links (
  installation_id TEXT NOT NULL REFERENCES insights_installations (installation_id),
  product_id      TEXT NOT NULL,
  output_id       TEXT NOT NULL,
  description     TEXT,
  PRIMARY KEY (installation_id, product_id, output_id),
  FOREIGN KEY (installation_id, output_id) REFERENCES meta.business_outputs (installation_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_output_links_product ON meta.product_output_links (installation_id, product_id);
CREATE INDEX IF NOT EXISTS idx_product_output_links_output  ON meta.product_output_links (installation_id, output_id);

-- -----------------------------------------------------------------------------
-- meta.change_events
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.change_events (
  id              BIGSERIAL   PRIMARY KEY,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  change_type     TEXT        NOT NULL,
  severity        TEXT        NOT NULL CHECK (severity IN ('informational','significant','breaking')),
  entity_type     TEXT        CHECK (entity_type IN ('product','entity','dataset')),
  entity_id       TEXT,
  diff            JSONB       NOT NULL,
  risk_assessment JSONB,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_change_events_entity ON meta.change_events (installation_id, entity_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_events_type   ON meta.change_events (installation_id, change_type, severity, detected_at DESC);

-- -----------------------------------------------------------------------------
-- meta.product_consumers + meta.product_usage_events + meta.contract_requests
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.product_consumers (
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  product_id      TEXT        NOT NULL,
  consumer_id     TEXT        NOT NULL,
  consumer_type   TEXT        NOT NULL CHECK (consumer_type IN ('team','system','person')),
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (installation_id, product_id, consumer_id)
);

CREATE INDEX IF NOT EXISTS idx_product_consumers_product ON meta.product_consumers (installation_id, product_id);

CREATE TABLE IF NOT EXISTS meta.product_usage_events (
  id              BIGSERIAL   PRIMARY KEY,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  product_id      TEXT        NOT NULL,
  consumer_id     TEXT,
  accessed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_usage_events_product
  ON meta.product_usage_events (installation_id, product_id, accessed_at DESC);

CREATE TABLE IF NOT EXISTS meta.contract_requests (
  id              BIGSERIAL   PRIMARY KEY,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  product_id      TEXT        NOT NULL,
  consumer_id     TEXT        NOT NULL,
  requirements    JSONB       NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     TEXT
);

CREATE INDEX IF NOT EXISTS idx_contract_requests_product
  ON meta.contract_requests (installation_id, product_id, status);

-- -----------------------------------------------------------------------------
-- meta.glossary_terms + meta.term_dataset_links
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.glossary_terms (
  id              TEXT        NOT NULL,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  name            TEXT        NOT NULL,
  definition      TEXT        NOT NULL,
  owner_team      TEXT,
  valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to        TIMESTAMPTZ,
  PRIMARY KEY (installation_id, id, valid_from)
);

CREATE INDEX IF NOT EXISTS idx_glossary_terms_current
  ON meta.glossary_terms (installation_id, id) WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_glossary_terms_name
  ON meta.glossary_terms (installation_id, lower(name)) WHERE valid_to IS NULL;

CREATE TABLE IF NOT EXISTS meta.term_dataset_links (
  installation_id TEXT NOT NULL REFERENCES insights_installations (installation_id),
  term_id         TEXT NOT NULL,
  dataset_id      TEXT NOT NULL,
  column_name     TEXT,
  PRIMARY KEY (installation_id, term_id, dataset_id)
);

CREATE INDEX IF NOT EXISTS idx_term_dataset_links_term    ON meta.term_dataset_links (installation_id, term_id);
CREATE INDEX IF NOT EXISTS idx_term_dataset_links_dataset ON meta.term_dataset_links (installation_id, dataset_id);

-- -----------------------------------------------------------------------------
-- meta.policy_packs + meta.policies + meta.policy_verdicts + meta.policy_exceptions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.policy_packs (
  id              TEXT NOT NULL,
  installation_id TEXT NOT NULL REFERENCES insights_installations (installation_id),
  name            TEXT NOT NULL,
  description     TEXT,
  framework       TEXT,
  PRIMARY KEY (installation_id, id)
);

CREATE INDEX IF NOT EXISTS idx_policy_packs_installation ON meta.policy_packs (installation_id);

CREATE TABLE IF NOT EXISTS meta.policies (
  id              TEXT    NOT NULL,
  installation_id TEXT    NOT NULL REFERENCES insights_installations (installation_id),
  pack_id         TEXT,
  name            TEXT    NOT NULL,
  description     TEXT,
  rule            JSONB   NOT NULL,
  scope           JSONB   NOT NULL DEFAULT '{"all":true}',
  action          TEXT    NOT NULL CHECK (action IN ('warn','block','notify')),
  active          BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (installation_id, id),
  CONSTRAINT meta_policies_pack_fk
    FOREIGN KEY (installation_id, pack_id)
    REFERENCES meta.policy_packs (installation_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_policies_installation ON meta.policies (installation_id, active);
CREATE INDEX IF NOT EXISTS idx_policies_pack         ON meta.policies (installation_id, pack_id);

CREATE TABLE IF NOT EXISTS meta.policy_verdicts (
  id              BIGSERIAL PRIMARY KEY,
  policy_id       TEXT      NOT NULL,
  installation_id TEXT      NOT NULL,
  product_id      TEXT      NOT NULL,
  verdict         TEXT      NOT NULL CHECK (verdict IN ('pass','fail','exception')),
  detail          JSONB,
  evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT meta_policy_verdicts_policy_fk
    FOREIGN KEY (installation_id, policy_id) REFERENCES meta.policies (installation_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_policy_verdicts_policy  ON meta.policy_verdicts (installation_id, policy_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_policy_verdicts_product ON meta.policy_verdicts (installation_id, product_id, evaluated_at DESC);

CREATE TABLE IF NOT EXISTS meta.policy_exceptions (
  id              BIGSERIAL PRIMARY KEY,
  policy_id       TEXT      NOT NULL,
  installation_id TEXT      NOT NULL,
  product_id      TEXT      NOT NULL,
  justification   TEXT      NOT NULL,
  expiry_date     DATE      NOT NULL,
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  status          TEXT      NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  CONSTRAINT meta_policy_exceptions_policy_fk
    FOREIGN KEY (installation_id, policy_id) REFERENCES meta.policies (installation_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_policy_exceptions_policy  ON meta.policy_exceptions (installation_id, policy_id, status);
CREATE INDEX IF NOT EXISTS idx_policy_exceptions_product ON meta.policy_exceptions (installation_id, product_id, status);

-- -----------------------------------------------------------------------------
-- meta.evidence_records — append-only bewijs-trail
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.evidence_records (
  id              BIGSERIAL   PRIMARY KEY,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  product_id      TEXT        NOT NULL,
  event_type      TEXT        NOT NULL,
  run_id          TEXT,
  payload         JSONB       NOT NULL,
  hash            TEXT        NOT NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_records_product
  ON meta.evidence_records (installation_id, product_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_records_event_type
  ON meta.evidence_records (installation_id, product_id, event_type, recorded_at DESC);

CREATE OR REPLACE RULE no_update_evidence
  AS ON UPDATE TO meta.evidence_records DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_evidence
  AS ON DELETE TO meta.evidence_records DO INSTEAD NOTHING;

-- -----------------------------------------------------------------------------
-- meta.product_cost_records
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.product_cost_records (
  id              BIGSERIAL     PRIMARY KEY,
  installation_id TEXT          NOT NULL REFERENCES insights_installations (installation_id),
  product_id      TEXT          NOT NULL,
  period_start    DATE          NOT NULL,
  period_end      DATE          NOT NULL,
  cost_usd        NUMERIC(12,4) NOT NULL,
  cost_breakdown  JSONB,
  source          TEXT          NOT NULL DEFAULT 'manual'
                                CHECK (source IN ('databricks','manual','estimated')),
  recorded_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT chk_cost_period CHECK (period_end > period_start),
  CONSTRAINT chk_cost_usd    CHECK (cost_usd >= 0)
);

CREATE INDEX IF NOT EXISTS idx_product_cost_records_product
  ON meta.product_cost_records (installation_id, product_id, period_start DESC);

-- =============================================================================
-- Keycloak database-gebruiker en database
-- =============================================================================
-- Keycloak heeft een eigen Postgres-gebruiker en database nodig.
-- Het wachtwoord wordt hier NIET hardgecodeerd — stel het in via:
--   ALTER ROLE keycloak WITH PASSWORD '<wachtwoord>';
-- Dit script zorgt alleen dat de role en database bestaan.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'keycloak') THEN
    CREATE ROLE keycloak WITH LOGIN;
  END IF;
END
$$;

SELECT 'CREATE DATABASE keycloak OWNER keycloak'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'keycloak') \gexec

-- =============================================================================
-- Helper-functies
-- =============================================================================

CREATE OR REPLACE FUNCTION log_admin_action(
  p_admin_user_id UUID,
  p_action        VARCHAR,
  p_resource_type VARCHAR,
  p_resource_id   VARCHAR DEFAULT NULL,
  p_changes       JSONB   DEFAULT NULL,
  p_ip_address    INET    DEFAULT NULL,
  p_user_agent    TEXT    DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO insights_audit_logs
    (admin_user_id, action, resource_type, resource_id, changes, ip_address, user_agent)
  VALUES
    (p_admin_user_id, p_action, p_resource_type, p_resource_id, p_changes, p_ip_address, p_user_agent);
END;
$$ LANGUAGE plpgsql;
