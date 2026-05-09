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
 * PUT /api/products/[id]/contract-requests/[reqId]
 * Keur een aanvraag goed of wijs af.
 * Body: { status: 'approved' | 'declined' }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reqId: string }> }
) {
  const { allowed } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  let resolvedBy = "unknown";
  try {
    const session = await requireSession(request);
    installationId = session.active_installation_id as string;
    resolvedBy = (session as unknown as Record<string, unknown>).user_id as string ?? "unknown";
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, reqId } = await params;
  const numReqId = parseInt(reqId, 10);
  if (isNaN(numReqId)) return NextResponse.json({ error: "Invalid reqId" }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { status } = body as { status?: string };
  if (!status || !VALID_STATUS.has(status))
    return NextResponse.json({ error: "status must be 'approved' or 'declined'" }, { status: 400 });

  const pool = getPgPool();
  try {
    const result = await pool.query(
      `UPDATE meta.contract_requests
       SET status = $3, resolved_at = now(), resolved_by = $4
       WHERE installation_id = $1 AND product_id = $2 AND id = $5 AND status = 'pending'
       RETURNING *`,
      [installationId, id, status, resolvedBy, numReqId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Request not found or already resolved" }, { status: 404 });
    }

    return NextResponse.json({ data: result.rows[0] });
  } catch (err) {
    console.error("[PUT /api/products/[id]/contract-requests/[reqId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
