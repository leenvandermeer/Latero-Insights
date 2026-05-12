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
 * GET /api/compliance/exceptions
 * Lijst met policy-uitzonderingen, optioneel gefilterd op status.
 * Query params: ?status=pending|approved|declined
 */
export async function GET(request: NextRequest) {
  const { allowed } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const statusFilter = request.nextUrl.searchParams.get("status");
  const VALID_STATUSES = new Set(["pending", "approved", "declined"]);

  const pool = getPgPool();
  try {
    const result = await pool.query(
      `SELECT e.*,
              p.name AS policy_name,
              p.rule AS policy_rule,
              pk.name AS pack_name
       FROM meta.policy_exceptions e
       JOIN meta.policies p ON p.installation_id = e.installation_id AND p.id = e.policy_id
       LEFT JOIN meta.policy_packs pk ON pk.installation_id = p.installation_id AND pk.id = p.pack_id
       WHERE e.installation_id = $1
         ${statusFilter && VALID_STATUSES.has(statusFilter) ? "AND e.status = $2" : ""}
       ORDER BY e.created_at DESC`,
      statusFilter && VALID_STATUSES.has(statusFilter)
        ? [installationId, statusFilter]
        : [installationId]
    );
    return NextResponse.json({ data: result.rows });
  } catch (err) {
    console.error("[GET /api/compliance/exceptions]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/compliance/exceptions
 * Dient een uitzondering in voor een policy × product.
 * Body: { policy_id, product_id, justification, expiry_date }
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

  const { policy_id, product_id, justification, expiry_date } = body as {
    policy_id?: string; product_id?: string; justification?: string; expiry_date?: string;
  };

  if (!policy_id?.trim()) return NextResponse.json({ error: "policy_id is required" }, { status: 400 });
  if (!product_id?.trim()) return NextResponse.json({ error: "product_id is required" }, { status: 400 });
  if (!justification?.trim()) return NextResponse.json({ error: "justification is required" }, { status: 400 });
  if (!expiry_date?.trim()) return NextResponse.json({ error: "expiry_date is required" }, { status: 400 });

  const expiryParsed = new Date(expiry_date);
  if (isNaN(expiryParsed.getTime()) || expiryParsed <= new Date()) {
    return NextResponse.json({ error: "expiry_date must be a future date" }, { status: 400 });
  }

  const pool = getPgPool();
  try {
    // Verify policy belongs to installation
    const policyExists = await pool.query(
      `SELECT 1 FROM meta.policies WHERE installation_id = $1 AND id = $2`,
      [installationId, policy_id]
    );
    if (policyExists.rows.length === 0) return NextResponse.json({ error: "Policy not found" }, { status: 404 });

    const result = await pool.query(
      `INSERT INTO meta.policy_exceptions
         (policy_id, installation_id, product_id, justification, expiry_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [policy_id.trim(), installationId, product_id.trim(), justification.trim(), expiry_date.trim()]
    );
    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/compliance/exceptions]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
