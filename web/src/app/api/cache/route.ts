import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getCacheStatus, clearCache } from "@/lib/cache";
import { requireSession, checkIsAdmin } from "@/lib/session-auth";

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(clientIp);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } }
    );
  }

  try {
    await requireSession(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = getCacheStatus();
  const response = NextResponse.json({ cache: status });
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}

export async function DELETE(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(clientIp);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } }
    );
  }

  let session;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = await checkIsAdmin(session.user_id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden: admin role required" }, { status: 403 });
  }

  const endpoint = request.nextUrl.searchParams.get("endpoint") ?? undefined;
  const result = clearCache(endpoint);
  const response = NextResponse.json({
    message: `Cache cleared`,
    endpoint: endpoint ?? "all",
    ...result,
  });
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}
