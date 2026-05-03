import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, revokeSessionFromRequest, getSessionFromRequest } from "@/lib/session-auth";
import { logAuthEvent, validateOrigin } from "@/lib/auth-audit";

export async function POST(request: NextRequest) {
  // WP6: CSRF origin-check — blokkeert cross-origin requests
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? null;

  // Lees sessie voor audit log vóór revocatie
  const session = await getSessionFromRequest(request);

  await revokeSessionFromRequest(request);

  await logAuthEvent({
    event_type: "logout",
    outcome: "success",
    user_id: session?.user_id ?? null,
    installation_id: session?.active_installation_id ?? null,
    ip_address: clientIp,
    user_agent: userAgent,
  });

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response, request);
  return response;
}
