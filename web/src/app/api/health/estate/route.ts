import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";

export async function GET(request: NextRequest) {
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

  const pool = getPgPool();
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const hasRange = Boolean(from && to);
  try {
    const [products, entities, runs, issues] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS cnt FROM meta.data_products WHERE installation_id = $1 AND valid_to IS NULL`, [installationId]),
      pool.query(`SELECT COUNT(*)::int AS cnt FROM meta.entities WHERE installation_id = $1 AND valid_to IS NULL AND is_context_node = false`, [installationId]),
      pool.query(
        `SELECT MAX(started_at) AS last_run_at,
                MAX(CASE WHEN status = 'SUCCESS' THEN started_at END) AS last_success_at
         FROM meta.runs WHERE installation_id = $1`, [installationId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS cnt
         FROM meta.quality_results qr
         JOIN meta.runs r USING (run_id)
         WHERE qr.installation_id = $1
           AND qr.status = 'FAILED'
           AND (
             ($2::date IS NOT NULL AND $3::date IS NOT NULL AND r.run_date BETWEEN $2::date AND $3::date)
             OR
             ($2::date IS NULL AND $3::date IS NULL AND qr.result_date >= CURRENT_DATE - INTERVAL '7 days')
           )`,
        [installationId, from, to]
      ),
    ]);

    // DQ pass rate for selected range, with a 7-day fallback for callers without a range.
    const dqRes = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'SUCCESS')::float /
         NULLIF(COUNT(*), 0) * 100 AS pass_rate
       FROM meta.quality_results
       WHERE installation_id = $1
         AND (
           ($2::date IS NOT NULL AND $3::date IS NOT NULL AND result_date BETWEEN $2::date AND $3::date)
           OR
           ($2::date IS NULL AND $3::date IS NULL AND result_date >= CURRENT_DATE - INTERVAL '7 days')
         )`,
      [installationId, from, to]
    );

    return NextResponse.json({
      data: {
        installation_id: installationId,
        data_product_count: products.rows[0]?.cnt ?? 0,
        entity_count: entities.rows[0]?.cnt ?? 0,
        issue_count: issues.rows[0]?.cnt ?? 0,
        dq_pass_rate: dqRes.rows[0]?.pass_rate ? Math.round(dqRes.rows[0].pass_rate) : null,
        last_run_at: runs.rows[0]?.last_run_at ?? null,
        last_sync_at: runs.rows[0]?.last_success_at ?? null,
        range_from: hasRange ? from : null,
        range_to: hasRange ? to : null,
      },
      source: "insights-saas",
    });
  } catch (err) {
    console.error("[GET /api/health/estate]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
