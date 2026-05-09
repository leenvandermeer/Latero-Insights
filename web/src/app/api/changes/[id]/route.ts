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
 * GET /api/changes/[id]
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
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const pool = getPgPool();
  try {
    const result = await pool.query(
      `SELECT * FROM meta.change_events WHERE installation_id = $1 AND id = $2`,
      [installationId, numId]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: result.rows[0] });
  } catch (err) {
    console.error("[GET /api/changes/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
