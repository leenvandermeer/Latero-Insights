import { NextRequest, NextResponse } from "next/server";
import { DatabricksAdapter } from "@/lib/adapters/databricks";
import { rateLimit } from "@/lib/rate-limit";
import { clearCache, writeToCache } from "@/lib/cache";
import { getLineageEntitiesFromSaaS, getLineageAttributesFromSaaS } from "@/lib/insights-saas-read";
import { requireSession, checkIsAdmin } from "@/lib/session-auth";

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

  // LADR-079: Require admin session to refresh cache
  let installationId: string;
  try {
    const session = await requireSession(request);
    if (!session.active_installation_id) {
      return NextResponse.json({ error: "No active installation" }, { status: 400 });
    }
    const isAdmin = await checkIsAdmin(session.user_id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: admin role required" }, { status: 403 });
    }
    installationId = session.active_installation_id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const from = params.get("from");
  const to = params.get("to");
  const endpoint = params.get("endpoint"); // optional: pipelines, quality, lineage, lineage-entities, lineage-attributes

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "Missing or invalid 'from' and 'to' date parameters (YYYY-MM-DD)" }, { status: 400 });
  }

  const cacheParams = { from, to };
  const endpoints = endpoint ? [endpoint] : ["pipelines", "quality", "lineage", "lineage-entities", "lineage-attributes"];
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
        case "lineage-entities": {
          // LADR-079: Read from Postgres (canonical store with GUID), not directly from Databricks
          const data = await getLineageEntitiesFromSaaS(installationId);
          writeToCache("lineage-entities", { scope: "current", installationId }, data);
          results["lineage-entities"] = `refreshed (${data.length} records)`;
          break;
        }
        case "lineage-attributes": {
          // LADR-079: Read from Postgres (canonical store), not directly from Databricks
          const data = await getLineageAttributesFromSaaS(installationId);
          writeToCache("lineage-attributes", { scope: "current", installationId }, data);
          results["lineage-attributes"] = `refreshed (${data.length} records)`;
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
