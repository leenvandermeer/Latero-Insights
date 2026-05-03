import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { ensureAuthSchema, getActiveInstallationFromSession, getSessionFromRequest, checkIsAdmin, getDefaultInstallationId } from "@/lib/session-auth";

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(`auth:session:${clientIp}`);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  await ensureAuthSchema();
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const isAdmin = await checkIsAdmin(session.user_id);
  const defaultInstallationId = await getDefaultInstallationId(session.user_id);

  return NextResponse.json({
    authenticated: true,
    user: {
      email: session.email,
      two_factor_enabled: session.two_factor_enabled,
      two_factor_required: false,
      is_admin: isAdmin,
    },
    active_installation: getActiveInstallationFromSession(session),
    installations: session.installations,
    default_installation_id: defaultInstallationId,
  });
}
