import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { writeToCache, isCacheOnly, getFromCache } from "@/lib/cache";
import { getDataQualityChecksFromSaaS } from "@/lib/insights-saas-read";
import { triggerAutoSyncIfDue } from "@/lib/databricks-auto-sync";
import { requireSession } from "@/lib/session-auth";

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
  const runId = params.get("run_id");
  const entityFqn = params.get("entity_fqn");
  let installationId = params.get("installation_id");

  try {
    const session = await requireSession(request);
    installationId = session.active_installation_id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "Missing or invalid 'from' and 'to' date parameters (YYYY-MM-DD)" }, { status: 400 });
  }

  const cacheParams = {
    from,
    to,
    installation_id: installationId ?? "unknown",
    run_id: runId ?? "",
    entity_fqn: entityFqn ?? "",
  };
  triggerAutoSyncIfDue("/api/quality");

  if (isCacheOnly()) {
    // Cache-only mode: serve from cache or return 503
    const cached = getFromCache("quality", cacheParams);
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

  // Live mode: read from Insights SaaS store and keep a fresh snapshot for fallback.
  try {
    const checks = await getDataQualityChecksFromSaaS({ from: from!, to: to!, installationId, runId, entityFqn });
    writeToCache("quality", cacheParams, checks);
    const response = NextResponse.json({ data: checks, source: "insights-saas" });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    response.headers.set("X-Cache", "BYPASS");
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[API /quality]", message);
    const cached = getFromCache("quality", cacheParams);
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
    return NextResponse.json({ error: "Failed to fetch live data and no snapshot is available", detail: message }, { status: 502 });
  }
}
