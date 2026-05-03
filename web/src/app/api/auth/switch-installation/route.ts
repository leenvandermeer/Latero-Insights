import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getActiveInstallationFromSession, switchActiveInstallation } from "@/lib/session-auth";

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
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

  const session = await switchActiveInstallation(request, installationId);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized organization switch" }, { status: 401 });
  }

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
