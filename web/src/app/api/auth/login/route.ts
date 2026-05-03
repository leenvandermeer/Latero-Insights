import { NextRequest, NextResponse } from "next/server";
import { rateLimit, AUTH_MAX_REQUESTS } from "@/lib/rate-limit";
import {
  attachSessionCookie,
  createSession,
  ensureAuthSchema,
  getUserInstallations,
  verifyUserPassword,
  checkIsAdmin,
} from "@/lib/session-auth";
import { getAuthPolicyByInstallation, isBreakGlassUser } from "@/lib/auth-policy";
import { logAuthEvent } from "@/lib/auth-audit";

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
  if (installations.length === 0) {
    await logAuthEvent({ event_type: "local_login", outcome: "failure", user_id: user.user_id, ip_address: clientIp, user_agent: userAgent, detail: "no_installations" });
    return NextResponse.json({ error: "No active organizations assigned" }, { status: 403 });
  }

  const preferredInstallation = String(body.installation_id ?? "").trim();
  const activeInstallation =
    preferredInstallation && installations.some((i) => i.installation_id === preferredInstallation)
      ? preferredInstallation
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

  const rawToken = await createSession(user.user_id, activeInstallation, request);
  const isAdmin = await checkIsAdmin(user.user_id);

  await logAuthEvent({
    event_type: "local_login",
    outcome: "success",
    user_id: user.user_id,
    installation_id: activeInstallation,
    ip_address: clientIp,
    user_agent: userAgent,
  });

  const response = NextResponse.json({
    authenticated: true,
    user: {
      email: user.email,
      two_factor_enabled: user.two_factor_enabled,
      two_factor_required: false,
      is_admin: isAdmin,
    },
    active_installation: installations.find((i) => i.installation_id === activeInstallation) ?? null,
    installations,
  });

  attachSessionCookie(response, rawToken, request);
  return response;
}
