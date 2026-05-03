/**
 * oidc.ts — OIDC flow helpers: PKCE, state/nonce cookie, discovery, token validatie.
 *
 * Security model:
 * - State, nonce en code_verifier worden opgeslagen in een HMAC-gesignde HttpOnly cookie.
 * - Na gebruik wordt de cookie direct gewist (single-use nonce).
 * - State/nonce verlopen na 10 minuten (TTL-contract, WP3).
 * - Browser ontvangt nooit een IdP access token of refresh token (FP-001).
 * - PKCE (S256) is verplicht (FP-010).
 *
 * Verboden patronen: zie docs/requirements/sso-forbidden-patterns.md
 */

import { createHmac, randomBytes, createHash } from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { NextRequest, NextResponse } from "next/server";

// ── Constanten ──────────────────────────────────────────────────────────────

const OIDC_STATE_COOKIE = "oidc_flow";
const OIDC_STATE_TTL_MS = 10 * 60 * 1000; // 10 minuten

export interface OidcFlowState {
  state: string;
  nonce: string;
  code_verifier: string;
  installation_id: string;
  redirect_after: string;
  created_at: number; // unix ms
}

// ── PKCE ────────────────────────────────────────────────────────────────────

export function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

// ── State / Nonce ────────────────────────────────────────────────────────────

export function generateState(): string {
  return randomBytes(32).toString("base64url");
}

export function generateNonce(): string {
  return randomBytes(32).toString("base64url");
}

function getStateSecret(): string {
  const secret = process.env.OIDC_STATE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("OIDC_STATE_SECRET is not set or too short (minimum 32 characters).");
  }
  return secret;
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Serialiseert en signt de OIDC flow state voor opslag in een HttpOnly cookie. */
export function serializeOidcFlowState(data: OidcFlowState): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = signPayload(payload, getStateSecret());
  return `${payload}.${sig}`;
}

/**
 * Deserialiseert en verifieert de OIDC flow state cookie.
 * Retourneert null bij ongeldige handtekening of verlopen TTL.
 */
export function deserializeOidcFlowState(value: string): OidcFlowState | null {
  try {
    const dotIndex = value.lastIndexOf(".");
    if (dotIndex < 0) return null;

    const payload = value.slice(0, dotIndex);
    const sig = value.slice(dotIndex + 1);
    const expectedSig = signPayload(payload, getStateSecret());

    // Timing-safe vergelijking
    const sigBuf = Buffer.from(sig, "base64url");
    const expectedBuf = Buffer.from(expectedSig, "base64url");
    if (sigBuf.length !== expectedBuf.length) return null;

    let diff = 0;
    for (let i = 0; i < sigBuf.length; i++) diff |= sigBuf[i] ^ expectedBuf[i];
    if (diff !== 0) return null;

    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OidcFlowState;

    // TTL check
    if (Date.now() - data.created_at > OIDC_STATE_TTL_MS) return null;

    return data;
  } catch {
    return null;
  }
}

function shouldUseSecureCookie(request: NextRequest): boolean {
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const host = request.nextUrl.hostname;
  return proto === "https" && host !== "localhost" && host !== "127.0.0.1";
}

/** Zet de OIDC flow state cookie op de response. */
export function attachOidcFlowCookie(
  response: NextResponse,
  state: OidcFlowState,
  request: NextRequest,
): void {
  response.cookies.set({
    name: OIDC_STATE_COOKIE,
    value: serializeOidcFlowState(state),
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/api/auth/sso/callback",
    maxAge: OIDC_STATE_TTL_MS / 1000,
  });
}

/** Wist de OIDC flow state cookie na gebruik (single-use nonce). */
export function clearOidcFlowCookie(response: NextResponse, request: NextRequest): void {
  response.cookies.set({
    name: OIDC_STATE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/api/auth/sso/callback",
    maxAge: 0,
  });
}

/** Leest en valideert de OIDC flow state uit het cookie. */
export function readOidcFlowState(request: NextRequest): OidcFlowState | null {
  const value = request.cookies.get(OIDC_STATE_COOKIE)?.value;
  if (!value) return null;
  return deserializeOidcFlowState(value);
}

// ── OIDC Discovery ───────────────────────────────────────────────────────────

export interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  issuer: string;
}

const discoveryCache = new Map<string, { data: OidcDiscovery; fetchedAt: number }>();
const DISCOVERY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minuten

export async function fetchOidcDiscovery(issuer: string): Promise<OidcDiscovery> {
  const cached = discoveryCache.get(issuer);
  if (cached && Date.now() - cached.fetchedAt < DISCOVERY_CACHE_TTL_MS) {
    return cached.data;
  }

  const url = `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`OIDC discovery failed for issuer ${issuer}: HTTP ${res.status}`);
  }

  const data = (await res.json()) as OidcDiscovery;
  if (!data.authorization_endpoint || !data.token_endpoint || !data.jwks_uri) {
    throw new Error(`OIDC discovery document from ${issuer} is missing required fields.`);
  }

  discoveryCache.set(issuer, { data, fetchedAt: Date.now() });
  return data;
}

// ── Authorization URL ────────────────────────────────────────────────────────

export function buildAuthorizationUrl(
  discovery: OidcDiscovery,
  config: { client_id: string; redirect_uri: string; scopes: string[] },
  state: string,
  nonce: string,
  pkceChallenge: string,
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.client_id,
    redirect_uri: config.redirect_uri,
    scope: config.scopes.join(" "),
    state,
    nonce,
    code_challenge: pkceChallenge,
    code_challenge_method: "S256",
  });
  return `${discovery.authorization_endpoint}?${params.toString()}`;
}

// ── Token Exchange ───────────────────────────────────────────────────────────

export async function exchangeCodeForIdToken(
  discovery: OidcDiscovery,
  config: { client_id: string; redirect_uri: string },
  clientSecret: string,
  code: string,
  codeVerifier: string,
): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirect_uri,
    client_id: config.client_id,
    client_secret: clientSecret,
    code_verifier: codeVerifier,
  });

  const res = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(`Token exchange failed: HTTP ${res.status} — ${body}`);
  }

  const tokens = (await res.json()) as Record<string, unknown>;

  if (typeof tokens.id_token !== "string") {
    throw new Error("Token response does not contain an id_token.");
  }

  // Zorg dat access_token en refresh_token nooit verder verwerkt worden (FP-001)
  return tokens.id_token;
}

// ── ID Token validatie ───────────────────────────────────────────────────────

export interface IdTokenClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  nonce: string;
  exp: number;
  iat: number;
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function validateIdToken(
  idToken: string,
  config: { issuer: string; client_id: string },
  expectedNonce: string,
): Promise<IdTokenClaims> {
  let jwks = jwksCache.get(config.issuer);
  if (!jwks) {
    const discovery = await fetchOidcDiscovery(config.issuer);
    jwks = createRemoteJWKSet(new URL(discovery.jwks_uri));
    jwksCache.set(config.issuer, jwks);
  }

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: config.issuer,
    audience: config.client_id,
  });

  const claims = payload as unknown as IdTokenClaims;

  // Nonce validatie — beschermt tegen replay-aanvallen (WP3 acceptatiecriterium)
  if (claims.nonce !== expectedNonce) {
    throw new Error("ID token nonce mismatch — possible replay attack.");
  }

  return claims;
}
