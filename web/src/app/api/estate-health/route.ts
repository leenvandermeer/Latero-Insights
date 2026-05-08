import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";

function ip(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function GET(request: NextRequest) {
  const { allowed } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try {
    const session = await requireSession(request);
    installationId = session.active_installation_id as string;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPgPool();
  try {
    const result = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM meta.data_products WHERE installation_id = $1) AS data_product_count,
         (SELECT COUNT(*)::int FROM meta.entities  WHERE installation_id = $1 AND is_context_node = false) AS entity_count,
         (
           SELECT COUNT(*)::int
           FROM meta.quality_results qr
           JOIN meta.runs r USING (run_id)
           WHERE r.installation_id = $1
             AND qr.status = 'FAILED'
             AND r.started_at >= now() - interval '7 days'
         ) AS issue_count,
         (
           SELECT ROUND(
             100.0 * COUNT(*) FILTER (WHERE qr.status = 'SUCCESS')
             / NULLIF(COUNT(*), 0)
           )::int
           FROM meta.quality_results qr
           JOIN meta.runs r USING (run_id)
           WHERE r.installation_id = $1
             AND r.started_at >= now() - interval '7 days'
         ) AS dq_pass_rate,
         (
           SELECT MAX(started_at)
           FROM meta.runs
           WHERE installation_id = $1
         ) AS last_run_at`,
      [installationId]
    );

    return NextResponse.json({ data: result.rows[0] });
  } catch (err) {
    console.error("[GET /api/estate-health]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
