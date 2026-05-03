/**
 * GET /api/auth/sso/callback?code=<code>&state=<state>
 *
 * OIDC callback handler. Volledige server-side verwerking:
 * 1. State validatie tegen de gesignde HttpOnly cookie
 * 2. Code exchange voor ID token
 * 3. ID token validatie (issuer, audience, nonce, expiry, JWKS)
 * 4. WP5: allowed_groups check — blokkeert login als gebruiker niet in allowlist zit
 * 5. Identity linking via (issuer, subject) — nooit via email (FP-002)
 * 6. JIT provisioning indien policy dit toestaat (met role mapping via groups claims)
 * 7. Latero-sessie aanmaken
 * 8. Redirect naar bestemming
 *
 * Bij elke fout: redirect naar /login?error=<code>, geen interne details naar browser.
 * Browser ontvangt nooit een IdP access token of refresh token (FP-001).
 *
 * Rate limit: AUTH_MAX_REQUESTS (5/min) per IP.
 * Audit: elke uitkomst (succes en fout) wordt gelogd in auth_audit_log (WP6).
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, AUTH_MAX_REQUESTS } from "@/lib/rate-limit";
import { getPgPool } from "@/lib/insights-saas-db";
import { attachSessionCookie, createSession, getUserInstallations } from "@/lib/session-auth";
import {
  getSsoConfig,
  getAuthPolicyByInstallation,
  resolveClientSecret,
  resolveRoleFromClaims,
} from "@/lib/auth-policy";
import {
  readOidcFlowState,
  clearOidcFlowCookie,
  fetchOidcDiscovery,
  exchangeCodeForIdToken,
  validateIdToken,
} from "@/lib/oidc";
import { logAuthEvent } from "@/lib/auth-audit";

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? null;

  const { allowed } = rateLimit(`auth:sso:callback:${clientIp}`, AUTH_MAX_REQUESTS);
  if (!allowed) {
    return redirectError(request, "rate_limited");
  }

  // ── Lees en valideer de flow state cookie ──
  const flowState = readOidcFlowState(request);
  if (!flowState) {
    await logAuthEvent({ event_type: "sso_callback_failure", outcome: "failure", ip_address: clientIp, user_agent: userAgent, detail: "missing_flow_state" });
    return redirectError(request, "callback_failed");
  }

  // ── Valideer state parameter (CSRF bescherming op OIDC flow) ──
  const params = request.nextUrl.searchParams;
  const returnedState = params.get("state");
  if (!returnedState || returnedState !== flowState.state) {
    await logAuthEvent({ event_type: "sso_callback_failure", outcome: "failure", ip_address: clientIp, user_agent: userAgent, detail: "state_mismatch" });
    return redirectError(request, "state_mismatch");
  }

  const code = params.get("code");
  if (!code) {
    await logAuthEvent({ event_type: "sso_callback_failure", outcome: "failure", ip_address: clientIp, user_agent: userAgent, detail: "missing_code" });
    return redirectError(request, "callback_failed");
  }

  const { installation_id, nonce: expectedNonce, code_verifier, redirect_after } = flowState;

  // ── Haal SSO-config op ──
  let ssoConfig;
  try {
    ssoConfig = await getSsoConfig(installation_id);
  } catch {
    await logAuthEvent({ event_type: "sso_callback_failure", outcome: "failure", installation_id, ip_address: clientIp, detail: "sso_config_error" });
    return redirectError(request, "callback_failed");
  }
  if (!ssoConfig || !ssoConfig.enabled) {
    await logAuthEvent({ event_type: "sso_callback_failure", outcome: "failure", installation_id, ip_address: clientIp, detail: "sso_not_enabled" });
    return redirectError(request, "sso_config_missing");
  }

  let clientSecret: string;
  try {
    clientSecret = resolveClientSecret(installation_id);
  } catch {
    await logAuthEvent({ event_type: "sso_callback_failure", outcome: "failure", installation_id, ip_address: clientIp, detail: "client_secret_missing" });
    return redirectError(request, "sso_config_missing");
  }

  // ── OIDC discovery en token exchange ──
  let idToken: string;
  try {
    const discovery = await fetchOidcDiscovery(ssoConfig.issuer);
    idToken = await exchangeCodeForIdToken(
      discovery,
      { client_id: ssoConfig.client_id, redirect_uri: ssoConfig.redirect_uri },
      clientSecret,
      code,
      code_verifier,
    );
  } catch {
    await logAuthEvent({ event_type: "sso_callback_failure", outcome: "failure", installation_id, ip_address: clientIp, detail: "token_exchange_failed" });
    return redirectError(request, "callback_failed");
  }

  // ── ID token validatie (issuer, audience, nonce, expiry, JWKS) ──
  let claims;
  try {
    claims = await validateIdToken(
      idToken,
      { issuer: ssoConfig.issuer, client_id: ssoConfig.client_id },
      expectedNonce,
    );
  } catch {
    await logAuthEvent({ event_type: "sso_callback_failure", outcome: "failure", installation_id, ip_address: clientIp, detail: "id_token_validation_failed" });
    return redirectError(request, "callback_failed");
  }

  // ── WP5: allowed_groups check ──
  // Als de installatie een allowlist heeft, moet de gebruiker in minstens één groep zitten.
  // Groepen worden gelezen uit `groups` of `roles` claim (IdP-afhankelijk).
  if (ssoConfig.allowed_groups && ssoConfig.allowed_groups.length > 0) {
    const userGroups = [...(claims.groups ?? []), ...(claims.roles ?? [])];
    const hasAllowedGroup = ssoConfig.allowed_groups.some((g) => userGroups.includes(g));
    if (!hasAllowedGroup) {
      await logAuthEvent({
        event_type: "sso_callback_failure",
        outcome: "failure",
        installation_id,
        ip_address: clientIp,
        user_agent: userAgent,
        detail: "groups_not_in_allowlist",
      });
      return redirectError(request, "unauthorized");
    }
  }

  // ── Identity linking via (issuer, subject) — nooit via email (FP-002) ──
  const pool = getPgPool();
  let userId: string | null = null;

  const identityResult = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM external_identities
     WHERE issuer = $1 AND subject = $2
     LIMIT 1`,
    [claims.iss, claims.sub],
  );

  if (identityResult.rowCount && identityResult.rowCount > 0) {
    userId = identityResult.rows[0].user_id;

    // Update last_login_at en email_hint (informationeel)
    await pool.query(
      `UPDATE external_identities
       SET last_login_at = NOW(), email_hint = $3, display_name = $4
       WHERE issuer = $1 AND subject = $2`,
      [claims.iss, claims.sub, claims.email ?? null, claims.name ?? null],
    );
  } else {
    // Geen bestaande identity: controleer JIT provisioning policy
    const policy = await getAuthPolicyByInstallation(installation_id);
    if (!policy || !policy.jit_provisioning) {
      await logAuthEvent({
        event_type: "sso_callback_failure",
        outcome: "failure",
        installation_id,
        ip_address: clientIp,
        detail: "jit_not_enabled",
      });
      return redirectError(request, "unauthorized");
    }

    // WP5: bepaal rol via groups claim + role_mapping (nooit is_admin via SSO)
    const userGroups = [...(claims.groups ?? []), ...(claims.roles ?? [])];
    const installationRole = resolveRoleFromClaims(
      userGroups,
      ssoConfig.role_mapping ?? {},
      policy.jit_default_role,
    );

    // JIT: maak gebruiker en koppel identity aan in één transactie
    await pool.query("BEGIN");
    try {
      const email = claims.email ?? `${claims.sub}@sso.local`;
      const displayName = claims.name ?? claims.email ?? claims.sub;

      const userResult = await pool.query<{ user_id: string }>(
        `INSERT INTO insights_users (email, password_hash, active)
         VALUES ($1, '', TRUE)
         ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
         RETURNING user_id`,
        [email.toLowerCase()],
      );
      userId = userResult.rows[0].user_id;

      // Koppel aan installatie met bepaalde rol (nooit is_admin via SSO)
      await pool.query(
        `INSERT INTO insights_user_installations (user_id, installation_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, installation_id) DO NOTHING`,
        [userId, installation_id, installationRole],
      );

      // Registreer externe identity
      await pool.query(
        `INSERT INTO external_identities
           (user_id, issuer, subject, email_hint, display_name, last_login_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [userId, claims.iss, claims.sub, claims.email ?? null, displayName],
      );

      await pool.query("COMMIT");
    } catch {
      await pool.query("ROLLBACK");
      await logAuthEvent({ event_type: "sso_callback_failure", outcome: "failure", installation_id, ip_address: clientIp, detail: "jit_transaction_failed" });
      return redirectError(request, "callback_failed");
    }
  }

  if (!userId) {
    await logAuthEvent({ event_type: "sso_callback_failure", outcome: "failure", installation_id, ip_address: clientIp, detail: "no_user_id_after_linking" });
    return redirectError(request, "unauthorized");
  }

  // ── Verifieer installatie-toegang ──
  const installations = await getUserInstallations(userId);
  const hasAccess = installations.some((i) => i.installation_id === installation_id);
  if (!hasAccess) {
    await logAuthEvent({ event_type: "sso_callback_failure", outcome: "failure", user_id: userId, installation_id, ip_address: clientIp, detail: "no_installation_access" });
    return redirectError(request, "unauthorized");
  }

  // ── Maak Latero-sessie aan ──
  const rawToken = await createSession(userId, installation_id, request);

  // ── WP6: log succesvolle SSO-login ──
  await logAuthEvent({
    event_type: "sso_login",
    outcome: "success",
    user_id: userId,
    installation_id,
    ip_address: clientIp,
    user_agent: userAgent,
  });

  // ── Redirect naar bestemming met sessiecookie ──
  const safeRedirect =
    redirect_after.startsWith("/") && !redirect_after.startsWith("//")
      ? redirect_after
      : "/pipelines";

  const response = NextResponse.redirect(new URL(safeRedirect, request.nextUrl.origin));
  attachSessionCookie(response, rawToken, request);
  clearOidcFlowCookie(response, request);
  return response;
}

function redirectError(request: NextRequest, code: string): NextResponse {
  const url = new URL(`/login?error=${encodeURIComponent(code)}`, request.nextUrl.origin);
  const response = NextResponse.redirect(url);
  // Wis de flow state cookie ook bij fout (single-use nonce)
  clearOidcFlowCookie(response, request);
  return response;
}
