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

export type AdminAuthMode =
  | "sso_only"
  | "sso_with_break_glass"
  | "sso_with_local_fallback"
  | "local_only";

export interface AdminAuthPolicy {
  auth_mode: AdminAuthMode;
  jit_provisioning: boolean;
  jit_default_role: string;
  allowed_domains: string[] | null;
  break_glass_enabled: boolean;
}

export interface AdminSsoConfig {
  issuer: string;
  client_id: string;
  /** Name of the environment variable holding the client secret. Never the secret itself. */
  client_secret_ref: string | null;
  redirect_uri: string;
  scopes: string[];
  allowed_groups: string[] | null;
  pkce_required: boolean;
  enabled: boolean;
  role_mapping: Record<string, string>;
}

export interface AdminAuthConfig {
  auth_policy: AdminAuthPolicy | null;
  sso_config: AdminSsoConfig | null;
}

export interface AdminSsoTestResult {
  ok: boolean;
  error?: string;
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  jwks_uri?: string;
}
