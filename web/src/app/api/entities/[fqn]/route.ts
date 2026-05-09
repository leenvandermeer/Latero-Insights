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
  const pool = getPgPool();

  try {
    // Entity base
    const entityRes = await pool.query(
      `SELECT e.entity_id, e.display_name, e.data_product_id,
              e.source_system, e.owner, e.description, e.tags
       FROM meta.entities e
       WHERE e.installation_id = $1 AND e.entity_id = $2 AND e.valid_to IS NULL`,
      [installationId, decodedFqn]
    );
    if (entityRes.rows.length === 0) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }
    const entity = entityRes.rows[0];

    // Layer statuses
    const layerRes = await pool.query(
      `SELECT DISTINCT ON (d.layer)
         d.dataset_id, d.layer,
         COALESCE(r.status, 'UNKNOWN') AS latest_status,
         r.started_at AS latest_run_at,
         r.run_id AS latest_run_id
       FROM meta.datasets d
       LEFT JOIN LATERAL (
         SELECT rn.status, rn.started_at, rn.run_id
         FROM meta.runs rn
         JOIN meta.jobs j USING (job_id)
         WHERE j.dataset_id = d.dataset_id
           AND rn.installation_id = d.installation_id
         ORDER BY rn.started_at DESC
         LIMIT 1
       ) r ON true
       WHERE d.installation_id = $1 AND d.entity_id = $2 AND d.valid_to IS NULL
       ORDER BY d.layer,
         CASE d.layer WHEN 'landing' THEN 0 WHEN 'raw' THEN 1
                      WHEN 'bronze' THEN 2 WHEN 'silver' THEN 3
                      WHEN 'gold' THEN 4 ELSE 5 END,
         r.started_at DESC NULLS LAST`,
      [installationId, decodedFqn]
    );

    return NextResponse.json({
      data: { ...entity, layer_statuses: layerRes.rows },
      source: "insights-saas",
    });
  } catch (err) {
    console.error("[GET /api/entities/[fqn]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
