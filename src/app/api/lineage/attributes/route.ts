import { NextRequest, NextResponse } from "next/server";
import { DatabricksAdapter } from "@/lib/adapters/databricks";
import { rateLimit } from "@/lib/rate-limit";
import { writeToCache, isCacheOnly, getFromCache } from "@/lib/cache";
import type { LineageAttribute } from "@/lib/adapters/types";

const adapter = new DatabricksAdapter();
const CACHE_KEY = "lineage-attributes";
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
    const cached = getFromCache<LineageAttribute[]>(CACHE_KEY, CACHE_PARAMS);
    if (cached) {
      const response = NextResponse.json({ data: cached.data, cachedAt: cached.cachedAt, source: "cache" });
      response.headers.set("X-RateLimit-Remaining", String(remaining));
      return response;
    }
    return NextResponse.json(
      { error: "No cached lineage attribute data. Run a manual refresh first.", source: "cache" },
      { status: 503 }
    );
  }

  try {
    const [attributes, schema] = await Promise.all([
      adapter.getLineageAttributes(),
      adapter.getLineageSchemaInventory(),
    ]);
    writeToCache(CACHE_KEY, CACHE_PARAMS, attributes);
    const response = NextResponse.json({
      data: attributes,
      source: "databricks",
      meta: {
        schema: schema.lineage_attributes_current,
        provenanceCounts: {
          lineage_attributes_current: attributes.length,
        },
      },
    });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    response.headers.set("X-Cache", "BYPASS");
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to fetch live lineage attribute data. Cache fallback is disabled in Live mode to avoid showing stale or demo results.",
        detail: message,
      },
      { status: 502 }
    );
  }
}
