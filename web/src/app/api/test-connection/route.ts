import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { loadSettings } from "@/lib/settings";
import { requireSession, checkIsAdmin } from "@/lib/session-auth";

// Transient states that indicate the warehouse is warming up — worth retrying
const RETRYABLE_STATES = new Set(["PENDING", "RUNNING"]);

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = await checkIsAdmin(session.user_id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden: admin role required" }, { status: 403 });
  }

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(clientIp);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } },
    );
  }

  const settings = loadSettings(session.active_installation_id ?? undefined);

  if (settings.connectionMode !== "databricks") {
    return NextResponse.json({
      connected: false,
      retryable: false,
      message: "Databricks test is disabled while connection mode is API ingest.",
    });
  }

  if (!settings.databricksHost || !settings.databricksToken || !settings.databricksWarehouseId) {
    return NextResponse.json({
      connected: false,
      retryable: false,
      message: "Missing configuration: host, token, or warehouse ID not set",
    });
  }

  try {
    const url = `https://${settings.databricksHost}/api/2.0/sql/statements`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.databricksToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        warehouse_id: settings.databricksWarehouseId,
        statement: "SELECT 1",
        // Give the warehouse up to 40 s to start — it may be cold
        wait_timeout: "40s",
        disposition: "INLINE",
        format: "JSON_ARRAY",
      }),
      // 45 s total budget per attempt (slightly more than wait_timeout)
      signal: AbortSignal.timeout(45000),
    });

    if (!resp.ok) {
      const text = await resp.text();
      let detail = text;
      try {
        const json = JSON.parse(text);
        detail = json.message || json.error || text;
      } catch { /* use raw text */ }
      return NextResponse.json({
        connected: false,
        retryable: false,
        message: `Databricks returned ${resp.status}: ${detail}`,
      });
    }

    const data = await resp.json();
    const state: string = data.status?.state ?? "UNKNOWN";

    if (state === "SUCCEEDED") {
      return NextResponse.json({
        connected: true,
        retryable: false,
        message: `Connected to ${settings.databricksHost} (warehouse ${settings.databricksWarehouseId})`,
      });
    }

    // Warehouse still warming up — let the client retry
    return NextResponse.json({
      connected: false,
      retryable: RETRYABLE_STATES.has(state),
      message: `Warehouse is starting (state: ${state})`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // A timeout means the warehouse is slow to respond — retryable
    const isTimeout = message.includes("timed out") || message.includes("TimeoutError") || message.includes("AbortError");
    return NextResponse.json({
      connected: false,
      retryable: isTimeout,
      message: isTimeout ? "Warehouse is still starting — will retry" : `Connection failed: ${message}`,
    });
  }
}
