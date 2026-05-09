import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";

function ip(r: NextRequest) {
  return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function resolveInstallation(request: NextRequest): Promise<string> {
  const session = await requireSession(request);
  return session.active_installation_id as string;
}

/**
 * GET /api/products/[id]/usage
 * Dagelijkse usage timeseries (laatste 90 dagen).
 * Query params: ?days=N (max 365)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const daysParam = request.nextUrl.searchParams.get("days");
  const days = Math.min(parseInt(daysParam ?? "90", 10) || 90, 365);

  const pool = getPgPool();
  try {
    const result = await pool.query(
      `SELECT (accessed_at AT TIME ZONE 'UTC')::date AS day,
              COUNT(*)::int AS event_count,
              COUNT(DISTINCT consumer_id)::int AS unique_consumers
       FROM meta.product_usage_events
       WHERE installation_id = $1
         AND product_id = $2
         AND accessed_at >= now() - ($3 || ' days')::interval
       GROUP BY day
       ORDER BY day DESC`,
      [installationId, id, days]
    );
    return NextResponse.json({ data: result.rows });
  } catch (err) {
    console.error("[GET /api/products/[id]/usage]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/products/[id]/usage
 * Logt een usage event. Idempotent: duplicaten binnen 1 minuut worden genegeerd.
 * Body: { consumer_id? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { /* optional body */ }

  const consumer_id = typeof body.consumer_id === "string" ? body.consumer_id.trim() : null;

  const pool = getPgPool();
  try {
    // Idempotency: skip if same product+consumer had event in last minute
    const recent = await pool.query(
      `SELECT 1 FROM meta.product_usage_events
       WHERE installation_id = $1 AND product_id = $2
         AND consumer_id IS NOT DISTINCT FROM $3
         AND accessed_at >= now() - INTERVAL '1 minute'
       LIMIT 1`,
      [installationId, id, consumer_id]
    );

    if (recent.rows.length === 0) {
      await pool.query(
        `INSERT INTO meta.product_usage_events (installation_id, product_id, consumer_id)
         VALUES ($1, $2, $3)`,
        [installationId, id, consumer_id]
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/products/[id]/usage]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
