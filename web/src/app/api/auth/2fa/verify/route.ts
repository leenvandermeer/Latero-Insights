/**
 * POST /api/auth/2fa/verify
 *
 * Verifies a TOTP token (or backup code) after password authentication.
 * Requires the `insights_pending_2fa` cookie set by the login route.
 * On success: creates a full session and clears the pending cookie.
 *
 * LADR-036
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, AUTH_MAX_REQUESTS } from "@/lib/rate-limit";
import {
  attachSessionCookie,
  createSession,
  checkIsAdmin,
  getUserInstallations,
  getUserEmail,
  getTotpSecretEnc,
  consumeBackupCode,
  ensureAuthSchema,
} from "@/lib/session-auth";
import {
  deserializePending2FA,
  decryptTotpSecret,
  verifyTotpToken,
  hashBackupCode,
  PENDING_COOKIE_NAME,
} from "@/lib/totp";
import { logAuthEvent } from "@/lib/auth-audit";

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? null;
  const { allowed } = rateLimit(`auth:2fa:${clientIp}`, AUTH_MAX_REQUESTS);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = String(body.code ?? "").trim().replace(/\s/g, "");
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  // Read and verify pending cookie
  const pendingCookieValue = request.cookies.get(PENDING_COOKIE_NAME)?.value;
  if (!pendingCookieValue) {
    return NextResponse.json({ error: "No pending 2FA session. Please sign in again." }, { status: 401 });
  }

  const pending = deserializePending2FA(pendingCookieValue);
  if (!pending) {
    return NextResponse.json({ error: "2FA session expired. Please sign in again." }, { status: 401 });
  }

  await ensureAuthSchema();

  // Retrieve and decrypt TOTP secret
  const secretEnc = await getTotpSecretEnc(pending.user_id);
  if (!secretEnc) {
    await logAuthEvent({ event_type: "2fa_verify", outcome: "failure", user_id: pending.user_id, ip_address: clientIp, user_agent: userAgent, detail: "no_totp_secret" });
    return NextResponse.json({ error: "2FA not configured for this account." }, { status: 400 });
  }

  const secret = decryptTotpSecret(secretEnc);
  if (!secret) {
    return NextResponse.json({ error: "2FA configuration error. Contact your administrator." }, { status: 500 });
  }

  let verified = false;

  // Try TOTP first, then backup code
  if (verifyTotpToken(secret, code)) {
    verified = true;
  } else {
    // Try backup code
    const codeHash = hashBackupCode(code);
    verified = await consumeBackupCode(pending.user_id, codeHash);
  }

  if (!verified) {
    await logAuthEvent({ event_type: "2fa_verify", outcome: "failure", user_id: pending.user_id, ip_address: clientIp, user_agent: userAgent, detail: "invalid_code" });
    return NextResponse.json({ error: "Invalid or expired code. Please try again." }, { status: 401 });
  }

  // Code valid → create full session
  const rawToken = await createSession(pending.user_id, pending.installation_id, request);
  const isAdmin = await checkIsAdmin(pending.user_id);
  const installations = await getUserInstallations(pending.user_id);
  const userEmail = await getUserEmail(pending.user_id);

  await logAuthEvent({ event_type: "2fa_verify", outcome: "success", user_id: pending.user_id, installation_id: pending.installation_id, ip_address: clientIp, user_agent: userAgent });

  const response = NextResponse.json({
    authenticated: true,
    user: {
      email: userEmail,
      two_factor_enabled: true,
      two_factor_required: true,
      is_admin: isAdmin,
    },
    active_installation: installations.find((i) => i.installation_id === pending.installation_id) ?? null,
    installations,
  });

  // Clear pending cookie
  response.cookies.set({
    name: PENDING_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  attachSessionCookie(response, rawToken, request);
  return response;
}
