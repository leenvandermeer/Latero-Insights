import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { loadSettings, saveSettings, maskSettings, type AppSettings } from "@/lib/settings";

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(clientIp);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } }
    );
  }

  const settings = loadSettings();
  const masked = maskSettings(settings);
  const response = NextResponse.json({ settings: masked });
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}

export async function PUT(request: NextRequest) {
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
  const current = loadSettings();

  // Merge — only update fields that are provided
  const updated: AppSettings = {
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

  // Basic validation
  if (updated.cacheTtlSeconds < 0 || updated.cacheTtlSeconds > 604800) {
    return NextResponse.json({ error: "cacheTtlSeconds must be between 0 and 604800 (7 days)" }, { status: 400 });
  }

  saveSettings(updated);

  const masked = maskSettings(updated);
  const response = NextResponse.json({ settings: masked, message: "Settings saved" });
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}
