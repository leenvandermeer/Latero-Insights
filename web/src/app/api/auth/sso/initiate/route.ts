/**
 * GET /api/auth/sso/initiate?hint=<email-domein>&next=<redirect-pad>
 *
 * Start de OIDC Authorization Code Flow met PKCE.
 * - Genereert state, nonce en PKCE code_verifier/challenge.
 * - Slaat deze op in een HMAC-gesignde HttpOnly cookie (10 min TTL).
 * - Redirecteert de browser naar de IdP authorization endpoint.
 *
 * Security:
 * - installation_id wordt server-side bepaald via domein-hint lookup (FP-003).
 * - PKCE (S256) is verplicht (FP-010).
 * - State en nonce worden server-side bewaard, nooit alleen client-side (FP-004).
 * - Rate limit: 20/min per IP.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getAuthPolicyByDomain, getSsoConfig, resolveClientSecret } from "@/lib/auth-policy";
import {
  generatePKCE,
  generateState,
  generateNonce,
  attachOidcFlowCookie,
  fetchOidcDiscovery,
  buildAuthorizationUrl,
  type OidcFlowState,
} from "@/lib/oidc";

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(`auth:sso:initiate:${clientIp}`, 20);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const params = request.nextUrl.searchParams;
  const hint = params.get("hint")?.trim().toLowerCase() ?? "";
  const nextPath = params.get("next") ?? "/pipelines";

  // Valideer next-pad om open-redirect te voorkomen
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/pipelines";

  // Publieke origin: gebruik X-Forwarded-* headers als beschikbaar (achter reverse proxy)
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.nextUrl.host;
  const publicOrigin = `${proto}://${host}`;

  // Bepaal domein uit hint
  const domain = hint.includes("@") ? hint.split("@")[1] ?? "" : hint;
  if (!domain || !domain.includes(".")) {
    return NextResponse.redirect(new URL("/login?error=sso_config_missing", publicOrigin));
  }

  // Zoek installatie op basis van domein (server-side, FP-003)
  let policy;
  try {
    policy = await getAuthPolicyByDomain(domain);
  } catch {
    return NextResponse.redirect(new URL("/login?error=sso_config_missing", publicOrigin));
  }

  if (!policy.installation_id || !policy.sso_available) {
    return NextResponse.redirect(new URL("/login?error=sso_config_missing", publicOrigin));
  }

  // Haal SSO-configuratie op
  const ssoConfig = await getSsoConfig(policy.installation_id);
  if (!ssoConfig || !ssoConfig.enabled) {
    return NextResponse.redirect(new URL("/login?error=sso_config_missing", publicOrigin));
  }

  // Verifieer dat client secret beschikbaar is vóór redirect
  let clientSecret: string;
  try {
    clientSecret = resolveClientSecret(policy.installation_id);
    void clientSecret; // gebruikt bij token exchange (callback)
  } catch {
    return NextResponse.redirect(new URL("/login?error=sso_config_missing", publicOrigin));
  }

  // Genereer PKCE, state, nonce
  const { verifier, challenge } = generatePKCE();
  const state = generateState();
  const nonce = generateNonce();

  // Haal OIDC discovery op
  let discovery;
  try {
    discovery = await fetchOidcDiscovery(ssoConfig.issuer);
  } catch {
    return NextResponse.redirect(new URL("/login?error=sso_config_missing", request.nextUrl.origin));
  }

  // Bouw authorization URL
  const authUrl = buildAuthorizationUrl(
    discovery,
    {
      client_id: ssoConfig.client_id,
      redirect_uri: ssoConfig.redirect_uri,
      scopes: ssoConfig.scopes,
    },
    state,
    nonce,
    challenge,
  );

  // Flow state opslaan in gesignde HttpOnly cookie
  const flowState: OidcFlowState = {
    state,
    nonce,
    code_verifier: verifier,
    installation_id: policy.installation_id,
    redirect_after: safeNext,
    created_at: Date.now(),
  };

  const response = NextResponse.redirect(authUrl);
  attachOidcFlowCookie(response, flowState, request);
  return response;
}
