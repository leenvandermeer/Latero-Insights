import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Skip auth for health, settings, and test-connection endpoints
  if (path === "/api/health" || path === "/api/settings" || path === "/api/test-connection" || path === "/api/cache/seed") {
    return NextResponse.next();
  }

  // Allow disabling auth for local development
  if (process.env.INSIGHTS_AUTH_DISABLED === "true") {
    return NextResponse.next();
  }

  const apiKey = process.env.INSIGHTS_API_KEY;
  if (!apiKey) {
    // No API key configured — reject all API requests
    return NextResponse.json(
      { error: "Server misconfiguration: INSIGHTS_API_KEY not set" },
      { status: 500 }
    );
  }

  const providedKey = request.headers.get("x-api-key") ?? request.nextUrl.searchParams.get("api_key");
  if (!providedKey || providedKey !== apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
