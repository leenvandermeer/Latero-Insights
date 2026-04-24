import { NextRequest, NextResponse } from "next/server";
import { DatabricksAdapter } from "@/lib/adapters/databricks";
import { rateLimit } from "@/lib/rate-limit";
import { writeToCache, isCacheOnly, getFromCache } from "@/lib/cache";
import type { LineageEntity } from "@/lib/adapters/types";

const adapter = new DatabricksAdapter();
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
    const [entities, schema] = await Promise.all([
      adapter.getLineageEntities(),
      adapter.getLineageSchemaInventory(),
    ]);
    writeToCache(CACHE_KEY, CACHE_PARAMS, entities);
    const response = NextResponse.json({
      data: entities,
      source: "databricks",
      meta: {
        schema: schema.lineage_entities_current,
        resolution: "lineage_entities_current",
      },
    });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    response.headers.set("X-Cache", "BYPASS");
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to fetch live lineage entity data. Cache fallback is disabled in Live mode to avoid showing stale or demo results.",
        detail: message,
      },
      { status: 502 }
    );
  }
}
