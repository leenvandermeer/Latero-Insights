import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getSessionFromRequest, setDefaultInstallationId } from "@/lib/session-auth";
import { validateOrigin } from "@/lib/auth-audit";

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(`auth:set-default:${clientIp}`);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const ok = await setDefaultInstallationId(session.user_id, installationId);
  if (!ok) {
    return NextResponse.json({ error: "Installation not found or not accessible" }, { status: 403 });
  }

  return NextResponse.json({ success: true, default_installation_id: installationId });
}
