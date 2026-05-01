import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getSessionFromRequest } from "@/lib/session-auth";

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(clientIp);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = NextResponse.json({
      active_installation_id: session.active_installation_id,
      installations: session.installations.map((i) => ({
        installation_id: i.installation_id,
        label: i.label,
        environment: i.environment,
        active: i.active,
      })),
    });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
