import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";

const VALID_STATUS = new Set(["approved", "declined"]);

function ip(r: NextRequest) {
  return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function resolveInstallation(request: NextRequest): Promise<string> {
  const session = await requireSession(request);
  return session.active_installation_id as string;
}

/**
 * PUT /api/compliance/exceptions/[id]
 * Keur een uitzondering goed of wijs af.
 * Body: { status: 'approved' | 'declined', approved_by? }
 */
export async function PUT(
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
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { status, approved_by } = body as { status?: string; approved_by?: string };
  if (!status || !VALID_STATUS.has(status))
    return NextResponse.json({ error: "status must be 'approved' or 'declined'" }, { status: 400 });

  const pool = getPgPool();
  try {
    const result = await pool.query(
      `UPDATE meta.policy_exceptions SET
         status = $3, approved_by = $4, approved_at = now()
       WHERE installation_id = $1 AND id = $2 AND status = 'pending'
       RETURNING *`,
      [installationId, numId, status, approved_by?.trim() ?? null]
    );
    if (result.rows.length === 0)
      return NextResponse.json({ error: "Exception not found or already resolved" }, { status: 404 });
    return NextResponse.json({ data: result.rows[0] });
  } catch (err) {
    console.error("[PUT /api/compliance/exceptions/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
