-- Audit logging for admin operations
-- Tracks who did what and when

CREATE TABLE IF NOT EXISTS insights_audit_logs (
  id SERIAL PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES insights_users(user_id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255),
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user_id ON insights_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON insights_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON insights_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON insights_audit_logs(resource_type, resource_id);

-- Add is_admin flag to users table if not exists
ALTER TABLE insights_users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS insights_password_resets (
  user_id UUID PRIMARY KEY REFERENCES insights_users(user_id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON insights_password_resets(expires_at);

-- Helper function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
  p_admin_user_id UUID,
  p_action VARCHAR,
  p_resource_type VARCHAR,
  p_resource_id VARCHAR DEFAULT NULL,
  p_changes JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO insights_audit_logs (admin_user_id, action, resource_type, resource_id, changes, ip_address, user_agent)
  VALUES (p_admin_user_id, p_action, p_resource_type, p_resource_id, p_changes, p_ip_address, p_user_agent);
END;
$$ LANGUAGE plpgsql;

-- Health metrics table for installations (for timeline tracking)
CREATE TABLE IF NOT EXISTS insights_installation_health (
  id SERIAL PRIMARY KEY,
  installation_id VARCHAR(255) NOT NULL REFERENCES insights_installations(installation_id) ON DELETE CASCADE,
  status VARCHAR(50),
  message_count_24h INTEGER DEFAULT 0,
  error_rate_pct NUMERIC(5, 2) DEFAULT 0,
  postgres_latency_ms INTEGER DEFAULT 0,
  api_response_time_p95_ms INTEGER DEFAULT 0,
  cache_hit_ratio NUMERIC(5, 4) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_health_installation_id ON insights_installation_health(installation_id);
CREATE INDEX IF NOT EXISTS idx_health_created_at ON insights_installation_health(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_installation_created ON insights_installation_health(installation_id, created_at DESC);
