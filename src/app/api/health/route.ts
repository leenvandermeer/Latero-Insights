import { NextRequest, NextResponse } from "next/server";
import { DatabricksAdapter } from "@/lib/adapters/databricks";
import { rateLimit } from "@/lib/rate-limit";
import { getCacheStatus, isCacheOnly } from "@/lib/cache";

const adapter = new DatabricksAdapter();

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(clientIp);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } }
    );
  }

  const cacheOnly = isCacheOnly();
  const connected = cacheOnly ? false : await adapter.testConnection();
  const cache = getCacheStatus();

  const response = NextResponse.json({
    status: connected || (cacheOnly && cache.entries > 0) ? "ok" : "error",
    databricks: connected,
    cache,
    timestamp: new Date().toISOString(),
  }, { status: connected || (cacheOnly && cache.entries > 0) ? 200 : 503 });
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}
