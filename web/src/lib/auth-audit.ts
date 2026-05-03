/**
 * auth-audit.ts — Auth event logging en CSRF origin-check.
 *
 * Audit logging is fire-and-forget: een log-fout brengt nooit de auth-flow in gevaar.
 * Security: tokens, wachtwoorden en volledige claim-payloads worden NOOIT gelogd.
 * De `detail`-velden bevatten alleen beschrijvende tekst.
 *
 * CSRF-bescherming via Origin-check: als de browser een Origin-header stuurt die
 * niet overeenkomt met de app-origin, wordt het verzoek geweigerd (HTTP 403).
 * Geldt voor alle muterende sessie-endpoints: logout en switch-installation.
 */

import { NextRequest } from "next/server";
import { getPgPool } from "@/lib/insights-saas-db";

export type AuditEventType =
  | "local_login"
  | "local_login_blocked"
  | "sso_login"
  | "sso_callback_failure"
  | "logout"
  | "installation_switch";

export interface AuditEventParams {
  event_type: AuditEventType;
  outcome: "success" | "failure";
  user_id?: string | null;
  installation_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  /** Beschrijvende context — GEEN tokens, wachtwoorden of claim-payloads. */
  detail?: string | null;
}

/**
 * Logt een auth-event naar auth_audit_log.
 * Gooit nooit een exception — mislukte logging stopt de auth-flow niet.
 */
export async function logAuthEvent(params: AuditEventParams): Promise<void> {
  try {
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO auth_audit_log
         (event_type, outcome, user_id, installation_id, ip_address, user_agent, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        params.event_type,
        params.outcome,
        params.user_id ?? null,
        params.installation_id ?? null,
        params.ip_address ?? null,
        params.user_agent ?? null,
        params.detail ?? null,
      ],
    );
  } catch {
    // Fire-and-forget: logging-fouten worden genegeerd
  }
}

/**
 * CSRF origin-check voor muterende sessie-endpoints (logout, installation-switch).
 *
 * Strategie: als de browser een Origin-header meestuurt die niet overeenkomt
 * met de app-origin, is het verzoek cross-origin en wordt het geweigerd.
 * Verzoeken zonder Origin-header (direct API-calls, server-to-server) worden
 * toegestaan — alleen browsers sturen Origin consistent mee.
 *
 * @returns true als het verzoek is toegestaan, false als het geblokkeerd moet worden.
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Geen Origin → geen browser cross-origin request
  return origin === request.nextUrl.origin;
}
