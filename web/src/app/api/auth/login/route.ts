import { NextRequest, NextResponse } from "next/server";
import { rateLimit, AUTH_MAX_REQUESTS } from "@/lib/rate-limit";
import {
  attachSessionCookie,
  createSession,
  ensureAuthSchema,
  getUserInstallations,
  verifyUserPassword,
  checkIsAdmin,
  getDefaultInstallationId,
  checkIsBreakGlass,
} from "@/lib/session-auth";
import { getAuthPolicyByInstallation, isBreakGlassUser } from "@/lib/auth-policy";
import { logAuthEvent } from "@/lib/auth-audit";
import {
  makePending2FAPayload,
  serializePending2FA,
  PENDING_COOKIE_NAME,
  PENDING_2FA_TTL_SECONDS,
} from "@/lib/totp";

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? null;
  const { allowed } = rateLimit(`auth:login:${clientIp}`, AUTH_MAX_REQUESTS);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    return await handleLogin(body, clientIp, userAgent, request);
  } catch (err) {
    console.error("[auth/login] unexpected error:", err);
    return NextResponse.json({ error: "Sign-in failed. Please try again." }, { status: 500 });
  }
}

async function handleLogin(
  body: Record<string, unknown>,
  clientIp: string,
  userAgent: string | null,
  request: NextRequest,
): Promise<NextResponse> {

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "").trim();
  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }

  await ensureAuthSchema();
  const user = await verifyUserPassword(email, password);
  if (!user) {
    await logAuthEvent({ event_type: "local_login", outcome: "failure", ip_address: clientIp, user_agent: userAgent, detail: "invalid_credentials" });
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const installations = await getUserInstallations(user.user_id);
  const isBreakGlass = await checkIsBreakGlass(user.user_id);

  // Break-glass platform operators have no tenant installation — allow login without one
  if (installations.length === 0 && !isBreakGlass) {
    await logAuthEvent({ event_type: "local_login", outcome: "failure", user_id: user.user_id, ip_address: clientIp, user_agent: userAgent, detail: "no_installations" });
    return NextResponse.json({ error: "No active organizations assigned" }, { status: 403 });
  }

  // Break-glass with no installations: skip policy check and go straight to session
  if (isBreakGlass && installations.length === 0) {
    await logAuthEvent({ event_type: "local_login", outcome: "success", user_id: user.user_id, ip_address: clientIp, user_agent: userAgent });

    if (user.two_factor_enabled) {
      const pending = makePending2FAPayload(user.user_id, null);
      const signed = serializePending2FA(pending);
      const useSecure = (request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")) === "https"
        && !["localhost", "127.0.0.1"].includes(request.nextUrl.hostname);
      const response = NextResponse.json({ pending_2fa: true });
      response.cookies.set({ name: PENDING_COOKIE_NAME, value: signed, httpOnly: true, sameSite: "lax", secure: useSecure, path: "/", maxAge: PENDING_2FA_TTL_SECONDS });
      return response;
    }

    const rawToken = await createSession(user.user_id, null, request);
    const response = NextResponse.json({
      authenticated: true,
      user: { email: user.email, two_factor_enabled: user.two_factor_enabled, two_factor_required: user.two_factor_enabled, is_admin: false },
      active_installation: null,
      installations: [],
    });
    attachSessionCookie(response, rawToken, request);
    return response;
  }

  const preferredInstallation = String(body.installation_id ?? "").trim();
  const defaultInstallation = await getDefaultInstallationId(user.user_id);
  const activeInstallation =
    preferredInstallation && installations.some((i) => i.installation_id === preferredInstallation)
      ? preferredInstallation
      : defaultInstallation && installations.some((i) => i.installation_id === defaultInstallation)
        ? defaultInstallation
        : installations[0].installation_id;

  // WP4 — Hybride auth policy check
  // Lokale login is alleen toegestaan als de policy van de actieve installatie dat toelaat.
  // sso_only en sso_with_break_glass blokkeren lokale login, tenzij de gebruiker
  // een break-glass account is.
  const policy = await getAuthPolicyByInstallation(activeInstallation);
  const authMode = policy?.auth_mode ?? "local_only";

  if (authMode === "sso_only" || authMode === "sso_with_break_glass") {
    const breakGlass = await isBreakGlassUser(user.user_id);
    if (!breakGlass) {
      await logAuthEvent({ event_type: "local_login_blocked", outcome: "failure", user_id: user.user_id, installation_id: activeInstallation, ip_address: clientIp, user_agent: userAgent, detail: authMode });
      return NextResponse.json(
        { error: "local_login_disabled", hint: "sso" },
        { status: 403 },
      );
    }
  }
  // sso_with_local_fallback en local_only: lokale login altijd toegestaan.

  await logAuthEvent({
    event_type: "local_login",
    outcome: "success",
    user_id: user.user_id,
    installation_id: activeInstallation,
    ip_address: clientIp,
    user_agent: userAgent,
  });

  // LADR-036: If 2FA is enabled, don't create a session yet.
  // Issue a short-lived pending cookie and tell the client to show the TOTP step.
  if (user.two_factor_enabled) {
    const pending = makePending2FAPayload(user.user_id, activeInstallation);
    const signed = serializePending2FA(pending);
    const useSecure = (request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")) === "https"
      && !["localhost", "127.0.0.1"].includes(request.nextUrl.hostname);
    const response = NextResponse.json({ pending_2fa: true });
    response.cookies.set({
      name: PENDING_COOKIE_NAME,
      value: signed,
      httpOnly: true,
      sameSite: "lax",
      secure: useSecure,
      path: "/",
      maxAge: PENDING_2FA_TTL_SECONDS,
    });
    return response;
  }

  const rawToken = await createSession(user.user_id, activeInstallation, request);
  const isAdmin = await checkIsAdmin(user.user_id);

  const response = NextResponse.json({
    authenticated: true,
    user: {
      email: user.email,
      two_factor_enabled: user.two_factor_enabled,
      two_factor_required: user.two_factor_enabled,
      is_admin: isAdmin,
    },
    active_installation: installations.find((i) => i.installation_id === activeInstallation) ?? null,
    installations,
  });

  attachSessionCookie(response, rawToken, request);
  return response;
}
