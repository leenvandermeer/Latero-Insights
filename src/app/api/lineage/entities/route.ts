import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { writeToCache, isCacheOnly, getFromCache } from "@/lib/cache";
import { getLineageEntitiesFromSaaS } from "@/lib/insights-saas-read";
import type { LineageEntity } from "@/lib/adapters/types";

const CACHE_KEY = "lineage-entities";
const CACHE_PARAMS = { scope: "current" };

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(clientIp);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } }
    );
  }

  if (isCacheOnly()) {
    const cached = getFromCache<LineageEntity[]>(CACHE_KEY, CACHE_PARAMS);
    if (cached) {
      const response = NextResponse.json({ data: cached.data, cachedAt: cached.cachedAt, source: "cache" });
      response.headers.set("X-RateLimit-Remaining", String(remaining));
      return response;
    }
    return NextResponse.json(
      { error: "No cached lineage entity data. Run a manual refresh first.", source: "cache" },
      { status: 503 }
    );
  }

  try {
    const entities = await getLineageEntitiesFromSaaS();
    writeToCache(CACHE_KEY, CACHE_PARAMS, entities);
    const response = NextResponse.json({
      data: entities,
      source: "postgres",
      meta: {
        resolution: "data_lineage_derived",
      },
    });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    response.headers.set("X-Cache", "BYPASS");
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const cached = getFromCache<LineageEntity[]>(CACHE_KEY, CACHE_PARAMS);
    if (cached) {
      const response = NextResponse.json({
        data: cached.data,
        cachedAt: cached.cachedAt,
        source: "fallback",
        warning: message,
      });
      response.headers.set("X-RateLimit-Remaining", String(remaining));
      response.headers.set("X-Cache", "FALLBACK");
      return response;
    }
    return NextResponse.json({ error: "Failed to fetch lineage entities and no snapshot is available", detail: message }, { status: 502 });
  }
}
