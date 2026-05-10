import { NextRequest, NextResponse } from "next/server";
import { DatabricksAdapter } from "@/lib/adapters/databricks";
import { rateLimit } from "@/lib/rate-limit";
import { getCacheStatus, isCacheOnly } from "@/lib/cache";
import { loadSettings } from "@/lib/settings";
import { getSessionFromRequest } from "@/lib/session-auth";

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(clientIp);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } }
    );
  }

  const session = await getSessionFromRequest(request).catch(() => null);
  const installationId = session?.active_installation_id ?? undefined;
  const settings = loadSettings(installationId);
  const cacheOnly = isCacheOnly();
  const databricksEnabled = settings.connectionMode === "databricks";
  const adapter = new DatabricksAdapter(installationId ?? undefined);
  const connected = cacheOnly || !databricksEnabled ? false : await adapter.testConnection();
  const cache = getCacheStatus();

  const configured = Boolean(
    settings.databricksHost && settings.databricksToken && settings.databricksWarehouseId,
  );
  const configuredEnvironment = settings.databricksEnvironment.trim() || "auto-detect";
  const warehouseSuffix = settings.databricksWarehouseId
    ? settings.databricksWarehouseId.slice(-6)
    : "";
  const status = connected || (cacheOnly && cache.entries > 0) ? "ok" : "error";

  const response = NextResponse.json({
    status,
    databricks: connected,
    connectionMode: settings.connectionMode,
    sql: {
      live: connected,
      configured: databricksEnabled ? configured : false,
      environment: configuredEnvironment,
      host: databricksEnabled ? (settings.databricksHost || null) : null,
      catalog: databricksEnabled ? (settings.databricksCatalog || null) : null,
      schema: databricksEnabled ? (settings.databricksSchema || null) : null,
      warehouseLabel: databricksEnabled && warehouseSuffix ? `...${warehouseSuffix}` : null,
    },
    cache,
    timestamp: new Date().toISOString(),
  });
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}
