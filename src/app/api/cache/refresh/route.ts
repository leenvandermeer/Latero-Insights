import { NextRequest, NextResponse } from "next/server";
import { DatabricksAdapter } from "@/lib/adapters/databricks";
import { rateLimit } from "@/lib/rate-limit";
import { clearCache, writeToCache } from "@/lib/cache";

const adapter = new DatabricksAdapter();

export async function POST(request: NextRequest) {
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
  const endpoint = params.get("endpoint"); // optional: pipelines, quality, lineage

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "Missing or invalid 'from' and 'to' date parameters (YYYY-MM-DD)" }, { status: 400 });
  }

  const cacheParams = { from, to };
  const endpoints = endpoint ? [endpoint] : ["pipelines", "quality", "lineage"];
  const results: Record<string, string> = {};

  for (const ep of endpoints) {
    clearCache(ep);
    try {
      switch (ep) {
        case "pipelines": {
          const data = await adapter.getPipelineRuns({ from, to });
          writeToCache("pipelines", cacheParams, data);
          results.pipelines = `refreshed (${data.length} records)`;
          break;
        }
        case "quality": {
          const data = await adapter.getDataQualityChecks({ from, to });
          writeToCache("quality", cacheParams, data);
          results.quality = `refreshed (${data.length} records)`;
          break;
        }
        case "lineage": {
          const data = await adapter.getLineageHops({ from, to });
          writeToCache("lineage", cacheParams, data);
          results.lineage = `refreshed (${data.length} records)`;
          break;
        }
        default:
          results[ep] = "unknown endpoint";
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[API /cache/refresh] ${ep}:`, message);
      results[ep] = `failed: ${message}`;
    }
  }

  const response = NextResponse.json({
    message: "Cache refresh complete",
    dateRange: { from, to },
    results,
    refreshedAt: new Date().toISOString(),
  });
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}
