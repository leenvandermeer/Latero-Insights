import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // /api/v1 routes handle their own Bearer-token authentication.
  if (path.startsWith("/api/v1/")) {
    return NextResponse.next();
  }

  // Session-based UI auth endpoints handle credentials/cookies themselves.
  if (path.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // Skip auth for health, settings, and test-connection endpoints
  if (path === "/api/health" || path === "/api/settings" || path === "/api/test-connection" || path === "/api/cache/seed") {
    return NextResponse.next();
  }

  // Allow disabling auth for local development
  if (process.env.INSIGHTS_AUTH_DISABLED === "true") {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("insights_session")?.value;
  if (sessionCookie) {
    // Session validity is resolved in route handlers.
    return NextResponse.next();
  }

  const apiKey = process.env.INSIGHTS_API_KEY;
  const providedKey = request.headers.get("x-api-key") ?? request.nextUrl.searchParams.get("api_key");
  if (!apiKey || !providedKey || providedKey !== apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
