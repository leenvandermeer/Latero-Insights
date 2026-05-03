/**
 * GET /api/auth/sso/callback?code=<code>&state=<state>
 *
 * OIDC callback handler. Volledige server-side verwerking:
 * 1. State validatie tegen de gesignde HttpOnly cookie
 * 2. Code exchange voor ID token
 * 3. ID token validatie (issuer, audience, nonce, expiry, JWKS)
 * 4. Identity linking via (issuer, subject) — nooit via email (FP-002)
 * 5. JIT provisioning indien policy dit toestaat
 * 6. Latero-sessie aanmaken
 * 7. Redirect naar bestemming
 *
 * Bij elke fout: redirect naar /login?error=<code>, geen interne details naar browser.
 * Browser ontvangt nooit een IdP access token of refresh token (FP-001).
 *
 * Rate limit: AUTH_MAX_REQUESTS (5/min) per IP.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, AUTH_MAX_REQUESTS } from "@/lib/rate-limit";
import { getPgPool } from "@/lib/insights-saas-db";
import { attachSessionCookie, createSession, getUserInstallations } from "@/lib/session-auth";
import { getSsoConfig, getAuthPolicyByInstallation, resolveClientSecret } from "@/lib/auth-policy";
import {
  readOidcFlowState,
  clearOidcFlowCookie,
  fetchOidcDiscovery,
  exchangeCodeForIdToken,
  validateIdToken,
} from "@/lib/oidc";

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(`auth:sso:callback:${clientIp}`, AUTH_MAX_REQUESTS);
  if (!allowed) {
    return redirectError(request, "rate_limited");
  }

  // ── Lees en valideer de flow state cookie ──
  const flowState = readOidcFlowState(request);
  if (!flowState) {
    return redirectError(request, "callback_failed");
  }

  // ── Valideer state parameter (CSRF bescherming op OIDC flow) ──
  const params = request.nextUrl.searchParams;
  const returnedState = params.get("state");
  if (!returnedState || returnedState !== flowState.state) {
    return redirectError(request, "state_mismatch");
  }

  const code = params.get("code");
  if (!code) {
    return redirectError(request, "callback_failed");
  }

  // ── Wis de flow state cookie direct (single-use nonce) ──
  // We bouwen de response op aan het eind; cookie clearing wordt meegenomen.
  const { installation_id, nonce: expectedNonce, code_verifier, redirect_after } = flowState;

  // ── Haal SSO-config op ──
  let ssoConfig;
  try {
    ssoConfig = await getSsoConfig(installation_id);
  } catch {
    return redirectError(request, "callback_failed");
  }
  if (!ssoConfig || !ssoConfig.enabled) {
    return redirectError(request, "sso_config_missing");
  }

  let clientSecret: string;
  try {
    clientSecret = resolveClientSecret(installation_id);
  } catch {
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
    return redirectError(request, "callback_failed");
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
      return redirectError(request, "unauthorized");
    }

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

      // Koppel aan installatie met default rol
      await pool.query(
        `INSERT INTO insights_user_installations (user_id, installation_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, installation_id) DO NOTHING`,
        [userId, installation_id, policy.jit_default_role],
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
      return redirectError(request, "callback_failed");
    }
  }

  if (!userId) {
    return redirectError(request, "unauthorized");
  }

  // ── Verifieer installatie-toegang ──
  const installations = await getUserInstallations(userId);
  const hasAccess = installations.some((i) => i.installation_id === installation_id);
  if (!hasAccess) {
    return redirectError(request, "unauthorized");
  }

  // ── Maak Latero-sessie aan ──
  const rawToken = await createSession(userId, installation_id, request);

  // ── Redirect naar bestemming met sessiecookie ──
  const safeRedirect = redirect_after.startsWith("/") && !redirect_after.startsWith("//")
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
