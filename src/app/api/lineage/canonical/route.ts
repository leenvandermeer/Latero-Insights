import { NextRequest, NextResponse } from "next/server";
import { DatabricksAdapter } from "@/lib/adapters/databricks";
import { rateLimit } from "@/lib/rate-limit";
import { getFromCache, writeToCache, isCacheOnly } from "@/lib/cache";
import type { LineageHop } from "@/lib/adapters/types";

const adapter = new DatabricksAdapter();

function deduplicateHops(hops: LineageHop[]): LineageHop[] {
  const edgeMap = new Map<string, LineageHop>();
  for (const hop of hops) {
    const edgeKey = `${hop.source_entity}::${hop.target_entity}::${hop.step}`;
    const existing = edgeMap.get(edgeKey);
    if (!existing || hop.timestamp_utc > existing.timestamp_utc) {
      edgeMap.set(edgeKey, hop);
    }
  }
  return [...edgeMap.values()];
}

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(clientIp);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } });
  }

  const cacheKey = { from: "canonical", to: "canonical" };

  if (isCacheOnly()) {
    // 1. Try dedicated canonical cache first
    const cached = getFromCache<LineageHop[]>("lineage_canonical", cacheKey);
    if (cached) {
      const response = NextResponse.json({ data: cached.data, cachedAt: cached.cachedAt, source: "cache" });
      response.headers.set("X-RateLimit-Remaining", String(remaining));
      return response;
    }

    // 2. Fall back: derive canonical view from any available lineage cache
    //    Use a wide range so the overlap logic finds all cached lineage entries.
    const fallback = getFromCache<LineageHop[]>("lineage", { from: "2000-01-01", to: "2099-12-31" });
    if (fallback && Array.isArray(fallback.data) && fallback.data.length > 0) {
      const canonical = deduplicateHops(fallback.data);
      const response = NextResponse.json({ data: canonical, cachedAt: fallback.cachedAt, source: "cache" });
      response.headers.set("X-RateLimit-Remaining", String(remaining));
      return response;
    }

    return NextResponse.json({ error: "No cached canonical lineage. Run a manual refresh first.", source: "cache" }, { status: 503 });
  }

  try {
    // Fetch all hops (no date filter) — use a wide range to get everything
    const allHops = await adapter.getLineageHops({ from: "2000-01-01", to: "2099-12-31" });
    const canonical = deduplicateHops(allHops);

    writeToCache("lineage_canonical", cacheKey, canonical);

    const response = NextResponse.json({ data: canonical, source: "databricks" });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    console.error("[API /lineage/canonical]", err instanceof Error ? err.message : "Unknown error");

    // Fallback 1: dedicated canonical cache
    const cached = getFromCache<LineageHop[]>("lineage_canonical", cacheKey);
    if (cached) {
      const response = NextResponse.json({ data: cached.data, cachedAt: cached.cachedAt, source: "fallback" });
      response.headers.set("X-RateLimit-Remaining", String(remaining));
      return response;
    }

    // Fallback 2: derive from any available lineage cache
    const fallback = getFromCache<LineageHop[]>("lineage", { from: "2000-01-01", to: "2099-12-31" });
    if (fallback && Array.isArray(fallback.data) && fallback.data.length > 0) {
      const canonical = deduplicateHops(fallback.data);
      const response = NextResponse.json({ data: canonical, cachedAt: fallback.cachedAt, source: "fallback" });
      response.headers.set("X-RateLimit-Remaining", String(remaining));
      return response;
    }

    return NextResponse.json({ error: "Failed to fetch canonical lineage and no cache available." }, { status: 503 });
  }
}
