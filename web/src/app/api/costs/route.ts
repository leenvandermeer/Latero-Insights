import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { listAllCosts } from "@/lib/cost-attribution";
import { getPgPool } from "@/lib/insights-saas-db";

const VALID_SOURCES = new Set(["databricks", "manual", "estimated"]);

function ip(r: NextRequest) {
  return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function resolveInstallation(request: NextRequest): Promise<string> {
  const session = await requireSession(request);
  return session.active_installation_id as string;
}

/**
 * GET /api/costs
 * Alle cost records voor de installatie (optioneel gefilterd op from/to).
 */
export async function GET(request: NextRequest) {
  const { allowed, remaining } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const p = request.nextUrl.searchParams;
  const from = p.get("from") ?? undefined;
  const to = p.get("to") ?? undefined;

  try {
    const records = await listAllCosts(installationId, { from, to });
    const response = NextResponse.json({ data: records });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    console.error("[GET /api/costs]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/costs/sync
 * Handmatig een cost record opslaan.
 * Body: { product_id, period_start, period_end, cost_usd, cost_breakdown?, source? }
 */
export async function POST(request: NextRequest) {
  const { allowed } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { product_id, period_start, period_end, cost_usd, cost_breakdown, source } = body as {
    product_id?: string; period_start?: string; period_end?: string;
    cost_usd?: number; cost_breakdown?: Record<string, number>; source?: string;
  };

  if (!product_id?.trim()) return NextResponse.json({ error: "product_id is required" }, { status: 400 });
  if (!period_start?.trim()) return NextResponse.json({ error: "period_start is required" }, { status: 400 });
  if (!period_end?.trim()) return NextResponse.json({ error: "period_end is required" }, { status: 400 });
  if (typeof cost_usd !== "number" || cost_usd < 0)
    return NextResponse.json({ error: "cost_usd must be a non-negative number" }, { status: 400 });
  const src = source ?? "manual";
  if (!VALID_SOURCES.has(src)) return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  if (new Date(period_end) <= new Date(period_start))
    return NextResponse.json({ error: "period_end must be after period_start" }, { status: 400 });

  const pool = getPgPool();
  try {
    const result = await pool.query(
      `INSERT INTO meta.product_cost_records
         (installation_id, product_id, period_start, period_end, cost_usd, cost_breakdown, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        installationId, product_id.trim(),
        period_start.trim(), period_end.trim(),
        cost_usd,
        cost_breakdown ? JSON.stringify(cost_breakdown) : null,
        src,
      ]
    );
    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/costs]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
