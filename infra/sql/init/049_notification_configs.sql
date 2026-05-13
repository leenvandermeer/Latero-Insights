-- Migration 049: Notification configuration table
-- Purpose: Store per-installation notification preferences and channel credentials
-- LADR-077 Phase 3: Multi-channel drift notifications (Slack, PagerDuty, Email)

CREATE TABLE IF NOT EXISTS meta.notification_configs (
  config_id BIGSERIAL PRIMARY KEY,
  installation_id TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  min_severity TEXT NOT NULL DEFAULT 'significant',  -- informational | significant | breaking
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Channels JSONB structure:
-- {
--   "slack": {
--     "enabled": true,
--     "webhook_url": "https://hooks.slack.com/services/...",
--     "severity_filter": "significant"
--   },
--   "pagerduty": {
--     "enabled": true,
--     "token": "Bearer xxx",
--     "service_id": "PXXXXX",
--     "severity_filter": "breaking"
--   },
--   "email": {
--     "enabled": true,
--     "recipients": ["ops@example.com", "security@example.com"],
--     "severity_filter": "significant"
--   }
-- }

-- Add channels column after table creation to avoid dependency on JSONB type
ALTER TABLE meta.notification_configs ADD COLUMN IF NOT EXISTS channels JSONB;

-- Unique constraint on installation_id to enforce one config per installation
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_configs_installation
  ON meta.notification_configs (installation_id);

-- Add check constraint for min_severity
ALTER TABLE meta.notification_configs ADD CONSTRAINT check_min_severity
  CHECK (min_severity IN ('informational', 'significant', 'breaking'))
  NOT VALID;

-- Trigger to update updated_at on modification
CREATE OR REPLACE FUNCTION meta.update_notification_configs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_notification_configs_timestamp
  ON meta.notification_configs;

CREATE TRIGGER trigger_update_notification_configs_timestamp
BEFORE UPDATE ON meta.notification_configs
FOR EACH ROW
EXECUTE FUNCTION meta.update_notification_configs_timestamp();

-- View: notification configs with enabled channels listed
CREATE OR REPLACE VIEW meta.notification_configs_view AS
SELECT
  config_id,
  installation_id,
  enabled,
  min_severity,
  CASE WHEN (channels->'slack'->>'enabled')::boolean THEN true ELSE false END AS slack_enabled,
  CASE WHEN (channels->'pagerduty'->>'enabled')::boolean THEN true ELSE false END AS pagerduty_enabled,
  CASE WHEN (channels->'email'->>'enabled')::boolean THEN true ELSE false END AS email_enabled,
  created_at,
  updated_at
FROM meta.notification_configs;

-- Notification delivery log (audit trail)
CREATE TABLE IF NOT EXISTS meta.notification_events (
  event_id BIGSERIAL PRIMARY KEY,
  installation_id TEXT NOT NULL,
  change_event_id TEXT,  -- Reference to meta.change_events.id
  channel TEXT NOT NULL,  -- slack | pagerduty | email
  status TEXT NOT NULL,  -- sent | failed | skipped
  reason TEXT,  -- Skip/failure reason
  external_id TEXT,  -- External message ID (e.g., Slack ts, PagerDuty incident ID)
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_code INT,
  response_body TEXT  -- For debugging
);

-- Index for audit log queries
CREATE INDEX IF NOT EXISTS idx_notification_events_installation
  ON meta.notification_events (installation_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_events_change
  ON meta.notification_events (change_event_id);
