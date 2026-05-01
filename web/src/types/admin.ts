/**
 * Admin UI types and interfaces
 */

export interface AdminInstallation {
  installation_id: string;
  label: string | null;
  environment: string;
  tier: string;
  contact_email?: string;
  active: boolean;
  status: "connected" | "degraded" | "offline" | "unknown" | "inactive";
  message_count_24h: number;
  error_rate_pct: number;
  user_count: number;
  last_synced_at?: string;
  created_at?: string;
}

export interface AdminHealthMetrics {
  total_installations: number;
  active_installations: number;
  inactive_installations: number;
  connected: number;
  degraded: number;
  offline: number;
  unknown: number;
  total_messages_24h: number;
  avg_error_rate: number;
  postgres_connection_ok: boolean;
  postgres_latency_ms: number;
  timestamp: string;
}

export interface AdminAuditLog {
  id: number;
  admin_user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  changes?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface AdminUser {
  user_id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  installations: Array<{
    installation_id: string;
    role: string;
  }>;
}

export interface AdminUserProvisionResult {
  user: AdminUser;
  password_generated: boolean;
  temporary_password?: string;
  message: string;
}

export interface AdminUserUpdateResult {
  user: AdminUser;
}

export interface AdminPasswordResetResult {
  message: string;
  user_id: string;
  email: string;
  temporary_password?: string;
  password_generated: boolean;
}

export interface AdminUserDeactivationResult {
  message: string;
  user_id: string;
  email: string;
  active: boolean;
}
