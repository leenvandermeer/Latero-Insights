import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { writeToCache, isCacheOnly, getFromCache } from "@/lib/cache";
import { getLineageAttributesFromSaaS } from "@/lib/insights-saas-read";
import type { LineageAttribute } from "@/lib/adapters/types";
import { requireSession } from "@/lib/session-auth";

const CACHE_KEY = "lineage-attributes";

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(clientIp);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } }
    );
  }

  let installationId = request.nextUrl.searchParams.get("installation_id");
  const asOf = request.nextUrl.searchParams.get("as_of") ?? undefined;
  try {
    const session = await requireSession(request);
    installationId = session.active_installation_id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cacheParams: Record<string, string> = installationId
    ? { scope: asOf ? `as_of:${asOf}` : "current", installationId }
    : { scope: asOf ? `as_of:${asOf}` : "current" };

  if (isCacheOnly(installationId)) {
    const cached = getFromCache<LineageAttribute[]>(CACHE_KEY, cacheParams);
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
    const attributes = await getLineageAttributesFromSaaS(installationId, asOf);
    writeToCache(CACHE_KEY, cacheParams, attributes);
    const response = NextResponse.json({
      data: attributes,
      source: "insights-saas",
      meta: {
        resolution: "data_lineage_derived",
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
    const cached = getFromCache<LineageAttribute[]>(CACHE_KEY, cacheParams);
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
    return NextResponse.json({ error: "Failed to fetch lineage attributes and no snapshot is available", detail: message }, { status: 502 });
  }
}
