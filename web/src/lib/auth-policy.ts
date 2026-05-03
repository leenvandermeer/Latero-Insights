/**
 * auth-policy.ts — helpers voor het ophalen van auth-policy en SSO-config per installatie.
 * Gedeelde logica voor /api/auth/policy en /api/auth/sso/initiate en /api/auth/sso/callback.
 *
 * Security: installation_id komt altijd uit server-side lookup op domein of state cookie,
 * nooit direct uit user input. Zie FP-003 (sso-forbidden-patterns.md).
 */

import { getPgPool } from "@/lib/insights-saas-db";

export type AuthMode =
  | "sso_only"
  | "sso_with_break_glass"
  | "sso_with_local_fallback"
  | "local_only";

export interface AuthPolicyResult {
  installation_id: string;
  auth_mode: AuthMode;
  jit_provisioning: boolean;
  jit_default_role: string;
  allowed_domains: string[] | null;
  break_glass_enabled: boolean;
}

export interface SsoConfig {
  installation_id: string;
  issuer: string;
  client_id: string;
  client_secret_ref: string | null;
  redirect_uri: string;
  scopes: string[];
  allowed_groups: string[] | null;
  pkce_required: boolean;
  enabled: boolean;
  /**
   * Mapping van IdP-groepsnaam naar installation-rol.
   * Formaat: { "GroupName": "member", "AdminGroup": "admin" }
   * Admin-escalatie via SSO-claims raakt NOOIT insights_users.is_admin (FP-006).
   */
  role_mapping: Record<string, string>;
}

export interface PolicyForDomain {
  auth_mode: AuthMode;
  sso_available: boolean;
  sso_label: string | null;
  /** Internal — not exposed to the browser. */
  installation_id: string | null;
}

/**
 * Zoekt de auth-policy op voor een installatie op basis van het e-maildomein.
 * Match is op `allowed_domains` in `installation_sso_config`.
 * Retourneert null als er geen installatie matcht; caller valt terug op local_only.
 */
export async function getAuthPolicyByDomain(domain: string): Promise<PolicyForDomain> {
  const pool = getPgPool();

  // Zoek een installatie waarvan het SSO-config het domein toelaat
  const result = await pool.query<{
    installation_id: string;
    auth_mode: AuthMode;
    sso_enabled: boolean;
    sso_label: string | null;
  }>(
    `SELECT
       p.installation_id,
       p.auth_mode,
       COALESCE(s.enabled, FALSE) AS sso_enabled,
       i.label                   AS sso_label
     FROM installation_auth_policy p
     JOIN insights_installations i ON i.installation_id = p.installation_id
     LEFT JOIN installation_sso_config s ON s.installation_id = p.installation_id
     WHERE i.active = TRUE
       AND p.allowed_domains IS NOT NULL
       AND $1 = ANY(p.allowed_domains)
     LIMIT 1`,
    [domain.toLowerCase()],
  );

  if (result.rowCount === 0) {
    return { auth_mode: "local_only", sso_available: false, sso_label: null, installation_id: null };
  }

  const row = result.rows[0];
  return {
    auth_mode: row.auth_mode,
    sso_available: row.sso_enabled,
    sso_label: row.sso_label,
    installation_id: row.installation_id,
  };
}

/**
 * Haalt de volledige auth-policy op voor een specifieke installatie.
 */
export async function getAuthPolicyByInstallation(installationId: string): Promise<AuthPolicyResult | null> {
  const pool = getPgPool();
  const result = await pool.query<AuthPolicyResult>(
    `SELECT installation_id, auth_mode, jit_provisioning, jit_default_role,
            allowed_domains, break_glass_enabled
     FROM installation_auth_policy
     WHERE installation_id = $1`,
    [installationId],
  );
  if (result.rowCount === 0) return null;
  return result.rows[0];
}

/**
 * Haalt de SSO-configuratie op voor een installatie.
 * Bevat geen client_secret — zie secrets-opslagcontract (007_sso_auth.sql).
 */
export async function getSsoConfig(installationId: string): Promise<SsoConfig | null> {
  const pool = getPgPool();
  const result = await pool.query<SsoConfig>(
    `SELECT installation_id, issuer, client_id, client_secret_ref,
            redirect_uri, scopes, allowed_groups, pkce_required, enabled,
            COALESCE(role_mapping, '{}')::jsonb AS role_mapping
     FROM installation_sso_config
     WHERE installation_id = $1`,
    [installationId],
  );
  if (result.rowCount === 0) return null;
  return result.rows[0];
}

/**
 * Bepaalt de installation-rol op basis van groups/roles claims uit het ID token.
 *
 * Doorloopt de claim-groepen in volgorde; retourneert de eerste match in roleMapping.
 * Fallback: defaultRole.
 *
 * Security: deze functie kent NOOIT admin-rechten toe op insights_users.is_admin.
 * De geretourneerde rol is uitsluitend geldig als insights_user_installations.role.
 */
export function resolveRoleFromClaims(
  groupsClaims: string[],
  roleMapping: Record<string, string>,
  defaultRole: string,
): string {
  for (const group of groupsClaims) {
    const mapped = roleMapping[group];
    if (mapped) return mapped;
  }
  return defaultRole;
}

/**
 * Controleert of een gebruiker een break-glass account is.
 * Break-glass accounts mogen lokaal inloggen ook als de installatie sso_only is.
 */
export async function isBreakGlassUser(userId: string): Promise<boolean> {
  const pool = getPgPool();
  const result = await pool.query<{ is_break_glass: boolean }>(
    `SELECT is_break_glass FROM insights_users WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  if (result.rowCount === 0) return false;
  return result.rows[0].is_break_glass === true;
}

/**
 * Haalt het OIDC client secret op uit environment variabelen.
 * Secret is nooit opgeslagen in de database of .cache/settings.json (FP-005).
 */
export function resolveClientSecret(installationId: string): string {
  // Per-installatie secret: OIDC_CLIENT_SECRET_{INSTALLATION_ID_UPPERCASE_SLUGIFIED}
  const slug = installationId.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const perInstallation = process.env[`OIDC_CLIENT_SECRET_${slug}`];
  if (perInstallation) return perInstallation;

  // Fallback: globaal secret voor single-tenant / dev
  const global = process.env.OIDC_CLIENT_SECRET;
  if (global) return global;

  throw new Error(
    `OIDC client secret not configured. Set OIDC_CLIENT_SECRET or OIDC_CLIENT_SECRET_${slug}.`,
  );
}
