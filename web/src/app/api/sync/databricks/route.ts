import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { syncFromDatabricks } from "@/lib/databricks-sync";
import { requireSession } from "@/lib/session-auth";
import { loadSettings } from "@/lib/settings";

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 7);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function POST(request: NextRequest) {
  // LINS-016: Verify user session before allowing sync
  let session;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = loadSettings(session.active_installation_id ?? undefined);
  if (settings.connectionMode !== "databricks") {
    return NextResponse.json(
      { error: "Databricks sync is disabled while connection mode is API ingest." },
      { status: 409 },
    );
  }

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(`sync:databricks:${clientIp}`);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text) as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const defaults = defaultDateRange();
  const from = isValidDate(body.from) ? body.from : defaults.from;
  const to = isValidDate(body.to) ? body.to : defaults.to;

  if (from > to) {
    return NextResponse.json({ error: "'from' must be before or equal to 'to'" }, { status: 400 });
  }

  const started = Date.now();

  try {
    const synced = await syncFromDatabricks({ from, to }, session.active_installation_id ?? undefined);
    const duration_ms = Date.now() - started;

    const response = NextResponse.json({ synced, duration_ms, range: { from, to } });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
