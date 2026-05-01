import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isConnectionMode, loadSettings, saveSettings, maskSettings, type AppSettings } from "@/lib/settings";
import { requireSession } from "@/lib/session-auth";

export async function GET(request: NextRequest) {
  // LINS-016: Verify user session before exposing settings
  let session;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(clientIp);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } }
    );
  }

  const settings = loadSettings(session.active_installation_id);
  const masked = maskSettings(settings);
  const response = NextResponse.json({ settings: masked, installation_id: session.active_installation_id });
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}

export async function PUT(request: NextRequest) {
  // LINS-016: Verify user session before allowing settings modification
  let session;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(clientIp);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } }
    );
  }

  let body: Partial<AppSettings>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Load current settings as base
  const current = loadSettings(session.active_installation_id);

  // Merge — only update fields that are provided
  const updated: AppSettings = {
    connectionMode: body.connectionMode ?? current.connectionMode,
    databricksHost: body.databricksHost ?? current.databricksHost,
    // Don't overwrite token with masked placeholder
    databricksToken:
      body.databricksToken && !body.databricksToken.startsWith("••")
        ? body.databricksToken
        : current.databricksToken,
    databricksWarehouseId: body.databricksWarehouseId ?? current.databricksWarehouseId,
    databricksCatalog: body.databricksCatalog ?? current.databricksCatalog,
    databricksSchema: body.databricksSchema ?? current.databricksSchema,
    databricksEnvironment: body.databricksEnvironment ?? current.databricksEnvironment,
    cacheTtlSeconds: body.cacheTtlSeconds ?? current.cacheTtlSeconds,
    cacheOnly: body.cacheOnly ?? current.cacheOnly,
  };

  if (!isConnectionMode(updated.connectionMode)) {
    return NextResponse.json({ error: "connectionMode must be 'databricks' or 'api'" }, { status: 400 });
  }

  // Basic validation
  if (updated.cacheTtlSeconds < 0 || updated.cacheTtlSeconds > 604800) {
    return NextResponse.json({ error: "cacheTtlSeconds must be between 0 and 604800 (7 days)" }, { status: 400 });
  }

  saveSettings(updated, session.active_installation_id);

  const masked = maskSettings(updated);
  const response = NextResponse.json({ settings: masked, message: "Settings saved", installation_id: session.active_installation_id });
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}
