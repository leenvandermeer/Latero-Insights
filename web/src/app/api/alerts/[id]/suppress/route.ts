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
 * PUT /api/alerts/[id]/suppress
 * Handmatige suppressie van een alert.
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

  const { id: alertIdStr } = await params;
  const alertId = parseInt(alertIdStr, 10);
  if (isNaN(alertId)) return NextResponse.json({ error: "Invalid alert ID" }, { status: 400 });

  const pool = getPgPool();
  const result = await pool.query(
    `UPDATE meta.alerts
     SET status = 'suppressed'
     WHERE id = $1 AND installation_id = $2 AND status = 'open'
     RETURNING *`,
    [alertId, installationId]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Alert not found or not suppressible" }, { status: 404 });
  }

  return NextResponse.json({ data: result.rows[0] });
}
