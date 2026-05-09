import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";

const VALID_CONSUMER_TYPES = new Set(["team", "system", "person"]);

function ip(r: NextRequest) {
  return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function resolveInstallation(request: NextRequest): Promise<string> {
  const session = await requireSession(request);
  return session.active_installation_id as string;
}

/**
 * GET /api/products/[id]/consumers
 * Lijst met consumers + usage-statistieken.
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
  const pool = getPgPool();
  try {
    const result = await pool.query(
      `SELECT c.consumer_id, c.consumer_type, c.registered_at,
              COUNT(u.id)::int AS event_count,
              MAX(u.accessed_at) AS last_access_at
       FROM meta.product_consumers c
       LEFT JOIN meta.product_usage_events u
         ON u.installation_id = c.installation_id
        AND u.product_id = c.product_id
        AND u.consumer_id = c.consumer_id
       WHERE c.installation_id = $1 AND c.product_id = $2
       GROUP BY c.consumer_id, c.consumer_type, c.registered_at
       ORDER BY last_access_at DESC NULLS LAST, c.registered_at DESC`,
      [installationId, id]
    );
    return NextResponse.json({ data: result.rows });
  } catch (err) {
    console.error("[GET /api/products/[id]/consumers]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/products/[id]/consumers
 * Consumer registreren.
 * Body: { consumer_id, consumer_type }
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

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { consumer_id, consumer_type } = body as { consumer_id?: string; consumer_type?: string };

  if (!consumer_id?.trim()) return NextResponse.json({ error: "consumer_id is required" }, { status: 400 });
  if (!consumer_type || !VALID_CONSUMER_TYPES.has(consumer_type))
    return NextResponse.json({ error: "Invalid consumer_type" }, { status: 400 });

  const pool = getPgPool();
  try {
    await pool.query(
      `INSERT INTO meta.product_consumers (installation_id, product_id, consumer_id, consumer_type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (installation_id, product_id, consumer_id) DO NOTHING`,
      [installationId, id, consumer_id.trim(), consumer_type]
    );
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/products/[id]/consumers]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
