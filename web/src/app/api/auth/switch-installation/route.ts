import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getActiveInstallationFromSession, switchActiveInstallation, getSessionFromRequest } from "@/lib/session-auth";
import { logAuthEvent, validateOrigin } from "@/lib/auth-audit";

export async function POST(request: NextRequest) {
  // WP6: CSRF origin-check — blokkeert cross-origin requests
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? null;

  const { allowed } = rateLimit(`auth:switch:${clientIp}`, 30);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const installationId = String(body.installation_id ?? "").trim();
  if (!installationId) {
    return NextResponse.json({ error: "installation_id is required" }, { status: 400 });
  }

  // Lees huidige sessie voor audit log
  const currentSession = await getSessionFromRequest(request);

  const session = await switchActiveInstallation(request, installationId);
  if (!session) {
    await logAuthEvent({
      event_type: "installation_switch",
      outcome: "failure",
      user_id: currentSession?.user_id ?? null,
      installation_id: installationId,
      ip_address: clientIp,
      user_agent: userAgent,
      detail: "unauthorized_switch",
    });
    return NextResponse.json({ error: "Unauthorized organization switch" }, { status: 401 });
  }

  await logAuthEvent({
    event_type: "installation_switch",
    outcome: "success",
    user_id: session.user_id,
    installation_id: installationId,
    ip_address: clientIp,
    user_agent: userAgent,
  });

  return NextResponse.json({
    authenticated: true,
    user: {
      email: session.email,
      two_factor_enabled: session.two_factor_enabled,
      two_factor_required: false,
    },
    active_installation: getActiveInstallationFromSession(session),
    installations: session.installations,
  });
}
