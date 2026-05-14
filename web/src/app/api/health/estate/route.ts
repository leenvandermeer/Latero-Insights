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

  // Reusable date-window clause; {col} is replaced with the date column expression.
  const runDateCond = `(
    ($2::date IS NOT NULL AND $3::date IS NOT NULL AND r.run_date BETWEEN $2::date AND $3::date)
    OR ($2::date IS NULL AND $3::date IS NULL AND r.run_date >= CURRENT_DATE - INTERVAL '7 days')
  )`;
  const resultDateCond = `(
    ($2::date IS NOT NULL AND $3::date IS NOT NULL AND result_date BETWEEN $2::date AND $3::date)
    OR ($2::date IS NULL AND $3::date IS NULL AND result_date >= CURRENT_DATE - INTERVAL '7 days')
  )`;

  try {
    const [products, entities, runMeta, issues, warnings, runCount, dqRes, layerHealth, incidents] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS cnt FROM meta.data_products WHERE installation_id = $1 AND valid_to IS NULL`,
        [installationId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS cnt FROM meta.entities WHERE installation_id = $1 AND valid_to IS NULL AND is_context_node = false`,
        [installationId]
      ),
      pool.query(
        `SELECT MAX(started_at) AS last_run_at,
                MAX(CASE WHEN status = 'SUCCESS' THEN started_at END) AS last_success_at
         FROM meta.runs WHERE installation_id = $1`,
        [installationId]
      ),
      // Failed DQ checks in period
      pool.query(
        `SELECT COUNT(*)::int AS cnt
         FROM meta.quality_results qr
         JOIN meta.runs r USING (run_id)
         WHERE qr.installation_id = $1 AND qr.status = 'FAILED'
           AND ${runDateCond}`,
        [installationId, from, to]
      ),
      // Warning DQ checks in period
      pool.query(
        `SELECT COUNT(*)::int AS cnt
         FROM meta.quality_results qr
         JOIN meta.runs r USING (run_id)
         WHERE qr.installation_id = $1 AND qr.status = 'WARNING'
           AND ${runDateCond}`,
        [installationId, from, to]
      ),
      // Total pipeline runs in period
      pool.query(
        `SELECT COUNT(*)::int AS cnt
         FROM meta.runs r
         WHERE r.installation_id = $1 AND ${runDateCond}`,
        [installationId, from, to]
      ),
      // DQ pass rate in period
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'SUCCESS')::float / NULLIF(COUNT(*), 0) * 100 AS pass_rate
         FROM meta.quality_results
         WHERE installation_id = $1 AND ${resultDateCond}`,
        [installationId, from, to]
      ),
      // Per-layer pipeline success rate (OUTPUT runs only, 5 medallion layers)
      pool.query(
        `SELECT
           io.layer,
           COUNT(*)::int                                                             AS run_count,
           COUNT(*) FILTER (WHERE r.status = 'SUCCESS')::int                        AS success_count,
           ROUND(
             COUNT(*) FILTER (WHERE r.status = 'SUCCESS')::numeric /
             NULLIF(COUNT(*), 0) * 100
           )::int                                                                    AS success_rate
         FROM meta.run_io io
         JOIN meta.runs r USING (run_id)
         WHERE io.installation_id = $1
           AND io.role = 'OUTPUT'
           AND ${runDateCond}
           AND io.layer IN ('landing','raw','bronze','silver','gold')
         GROUP BY io.layer
         ORDER BY ARRAY_POSITION(ARRAY['landing','raw','bronze','silver','gold']::text[], io.layer)`,
        [installationId, from, to]
      ),
      // Open incidents snapshot (not date-scoped — current operational state)
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('open','in_progress'))::int             AS open_count,
           COUNT(*) FILTER (WHERE status IN ('open','in_progress') AND severity = 'critical')::int AS critical_count
         FROM meta.incidents
         WHERE installation_id = $1`,
        [installationId]
      ),
    ]);

    return NextResponse.json({
      data: {
        installation_id: installationId,
        data_product_count: products.rows[0]?.cnt ?? 0,
        entity_count: entities.rows[0]?.cnt ?? 0,
        run_count: runCount.rows[0]?.cnt ?? 0,
        issue_count: issues.rows[0]?.cnt ?? 0,
        warning_count: warnings.rows[0]?.cnt ?? 0,
        dq_pass_rate: dqRes.rows[0]?.pass_rate ? Math.round(dqRes.rows[0].pass_rate) : null,
        open_incident_count: incidents.rows[0]?.open_count ?? 0,
        critical_incident_count: incidents.rows[0]?.critical_count ?? 0,
        layer_health: layerHealth.rows as Array<{ layer: string; run_count: number; success_count: number; success_rate: number }>,
        last_run_at: runMeta.rows[0]?.last_run_at ?? null,
        last_sync_at: runMeta.rows[0]?.last_success_at ?? null,
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
