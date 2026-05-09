import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fqn: string }> }
) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(clientIp);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string | null = null;
  try {
    const session = await requireSession(request);
    installationId = session.active_installation_id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fqn } = await params;
  const decodedFqn = decodeURIComponent(fqn);
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "50"), 200);
  const pool = getPgPool();

  try {
    const result = await pool.query(
      `SELECT r.run_id, r.external_run_id, j.job_name, j.dataset_id,
              r.status, r.environment,
              r.started_at, r.ended_at, r.duration_ms
       FROM meta.runs r
       JOIN meta.jobs j USING (job_id)
       WHERE j.dataset_id = $2 AND r.installation_id = $1
       ORDER BY r.started_at DESC
       LIMIT $3`,
      [installationId, decodedFqn, limit]
    );

    return NextResponse.json({ data: result.rows, source: "insights-saas" });
  } catch (err) {
    console.error("[GET /api/entities/[fqn]/runs]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
