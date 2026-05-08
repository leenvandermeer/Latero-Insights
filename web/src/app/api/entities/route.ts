import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";

const LAYER_ORDER = ["landing", "raw", "bronze", "silver", "gold"];

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(clientIp);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string | null = null;
  try {
    const session = await requireSession(request);
    installationId = session.active_installation_id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const product_id = params.get("product_id");
  const status = params.get("status");
  const q = params.get("q");

  const pool = getPgPool();
  const values: (string)[] = [installationId!];
  let idx = 2;
  let filters = "";
  if (product_id) { filters += ` AND e.entity_id = ANY(SELECT entity_id FROM meta.entities WHERE installation_id = $1 AND data_product_id = $${idx++})`; values.push(product_id); }
  if (q) { filters += ` AND (e.entity_id ILIKE $${idx} OR e.display_name ILIKE $${idx++})`; values.push(`%${q}%`); }

  try {
    // All entities with per-layer status
    const entitiesRes = await pool.query(
      `SELECT
         e.entity_id, e.display_name, e.data_product_id,
         e.source_system, e.owner, e.tags, e.created_at, e.updated_at,
         -- Layer statuses as JSON array
         COALESCE((
           SELECT json_agg(ls ORDER BY ls.layer_rank)
           FROM (
             SELECT DISTINCT ON (d.layer)
               d.dataset_id,
               d.layer,
               CASE d.layer
                 WHEN 'landing' THEN 0
                 WHEN 'raw' THEN 1
                 WHEN 'bronze' THEN 2
                 WHEN 'silver' THEN 3
                 WHEN 'gold' THEN 4
                 ELSE 5
               END AS layer_rank,
               COALESCE(r.status, 'UNKNOWN') AS latest_status,
               r.started_at AS latest_run_at,
               r.run_id AS latest_run_id
             FROM meta.datasets d
             LEFT JOIN LATERAL (
               SELECT rn.status, rn.started_at, rn.run_id
               FROM meta.runs rn
               JOIN meta.jobs j2 USING (job_id)
               WHERE j2.dataset_id = d.dataset_id
                 AND rn.installation_id = d.installation_id
                 AND d.layer = CASE
                   WHEN split_part(rn.step, '_to_', 2) IN ('landing','raw','bronze','silver','gold')
                     THEN split_part(rn.step, '_to_', 2)
                   ELSE regexp_replace(split_part(rn.step, '_to_', 2), '_.*$', '')
                 END
               ORDER BY rn.started_at DESC
               LIMIT 1
             ) r ON true
             WHERE d.installation_id = e.installation_id
               AND d.entity_id = e.entity_id
             ORDER BY d.layer, r.started_at DESC NULLS LAST
           ) ls
         ), '[]'::json) AS layer_statuses
       FROM meta.entities e
       WHERE e.installation_id = $1
         AND e.is_context_node = false
         AND EXISTS (
           SELECT 1 FROM meta.datasets d
           WHERE d.installation_id = e.installation_id
             AND d.entity_id = e.entity_id
             AND d.layer IN ('silver', 'gold')
         )
         ${filters}
       ORDER BY e.entity_id`,
      values
    );

    // Compute aggregate health and apply status filter
    const rows = entitiesRes.rows.map((row) => {
      const ls: Array<{ layer: string; latest_status: string; latest_run_at?: string }> = row.layer_statuses ?? [];
      const statuses = ls.map((l) => l.latest_status);
      let health_status: string = "UNKNOWN";
      if (statuses.includes("FAILED")) health_status = "FAILED";
      else if (statuses.includes("WARNING")) health_status = "WARNING";
      else if (statuses.length > 0 && statuses.every((s) => s === "SUCCESS")) health_status = "SUCCESS";
      const latest_run_at = ls.map((l) => l.latest_run_at).filter(Boolean).sort().reverse()[0] ?? null;
      return { ...row, health_status, latest_run_at };
    });

    const filtered = status
      ? rows.filter((r) => r.health_status === status.toUpperCase())
      : rows;

    const response = NextResponse.json({ data: filtered, source: "insights-saas" });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    console.error("[GET /api/entities]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
