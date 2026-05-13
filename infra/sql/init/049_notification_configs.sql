-- Migration 049: Notification configuration table
-- Purpose: Store per-installation notification preferences and channel credentials
-- LADR-077 Phase 3: Multi-channel drift notifications (Slack, PagerDuty, Email)

CREATE TABLE IF NOT EXISTS meta.notification_configs (
  config_id BIGSERIAL PRIMARY KEY,
  installation_id TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  min_severity TEXT NOT NULL DEFAULT 'significant',
  channels JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint on installation_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_configs_installation
  ON meta.notification_configs (installation_id);

-- Notification delivery log (audit trail)
CREATE TABLE IF NOT EXISTS meta.notification_events (
  event_id BIGSERIAL PRIMARY KEY,
  installation_id TEXT NOT NULL,
  change_event_id TEXT,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  external_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_code INT,
  response_body TEXT
);

-- Index for audit log queries
CREATE INDEX IF NOT EXISTS idx_notification_events_installation
  ON meta.notification_events (installation_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_events_change
  ON meta.notification_events (change_event_id);
