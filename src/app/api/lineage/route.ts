import { NextRequest, NextResponse } from "next/server";
import { DatabricksAdapter } from "@/lib/adapters/databricks";
import { rateLimit } from "@/lib/rate-limit";
import { writeToCache, isCacheOnly, getFromCache } from "@/lib/cache";

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

  const params = request.nextUrl.searchParams;
  const from = params.get("from");
  const to = params.get("to");

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "Missing or invalid 'from' and 'to' date parameters (YYYY-MM-DD)" }, { status: 400 });
  }

  const cacheParams = { from, to };

  if (isCacheOnly()) {
    // Cache-only mode: serve from cache or return 503
    const cached = getFromCache("lineage", cacheParams);
    if (cached) {
      const response = NextResponse.json({ data: cached.data, cachedAt: cached.cachedAt, source: "cache" });
      response.headers.set("X-RateLimit-Remaining", String(remaining));
      response.headers.set("X-Cache", "HIT");
      return response;
    }
    return NextResponse.json(
      { error: "No cached data available. Run a manual refresh first.", source: "cache" },
      { status: 503 }
    );
  }

  // Live mode: query Databricks directly and fail fast on errors.
  try {
    const hops = await adapter.getLineageHops({ from, to });
    writeToCache("lineage", cacheParams, hops);
    const response = NextResponse.json({ data: hops, source: "databricks" });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    response.headers.set("X-Cache", "BYPASS");
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[API /lineage]", message);
    return NextResponse.json(
      {
        error: "Failed to fetch live lineage data. Cache fallback is disabled in Live mode to avoid showing stale or demo results.",
        detail: message,
      },
      { status: 502 }
    );
  }
}
