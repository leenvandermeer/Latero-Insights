import { NextRequest, NextResponse } from "next/server";
import { DatabricksAdapter } from "@/lib/adapters/databricks";
import { rateLimit } from "@/lib/rate-limit";
import { getCacheStatus, isCacheOnly } from "@/lib/cache";
import { loadSettings } from "@/lib/settings";

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
  const settings = loadSettings();

  const configured = Boolean(
    settings.databricksHost && settings.databricksToken && settings.databricksWarehouseId,
  );
  const configuredEnvironment = settings.databricksEnvironment.trim() || "auto-detect";
  const warehouseSuffix = settings.databricksWarehouseId
    ? settings.databricksWarehouseId.slice(-6)
    : "";

  const response = NextResponse.json({
    status: connected || (cacheOnly && cache.entries > 0) ? "ok" : "error",
    databricks: connected,
    sql: {
      live: connected,
      configured,
      environment: configuredEnvironment,
      host: settings.databricksHost || null,
      catalog: settings.databricksCatalog || null,
      schema: settings.databricksSchema || null,
      warehouseLabel: warehouseSuffix ? `...${warehouseSuffix}` : null,
    },
    cache,
    timestamp: new Date().toISOString(),
  }, { status: connected || (cacheOnly && cache.entries > 0) ? 200 : 503 });
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}
