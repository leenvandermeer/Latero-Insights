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
 * GET /api/lineage/[id]/impact
 * Geeft alle business outputs die downstream afhankelijk zijn van de gegeven entity.
 * Traverseert maximaal 10 hops downstream via meta.lineage_hops.
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

  const { id: entityId } = await params;
  const pool = getPgPool();

  try {
    // Recursive CTE: traverse downstream lineage from entity's datasets
    // Chain: entity → entity_sources → lineage_edges → downstream datasets
    //        → datasets.entity_id → entities.data_product_id → product_output_links → business_outputs
    const result = await pool.query(
      `WITH RECURSIVE downstream AS (
         -- Base: alle datasets die als source dienen voor deze entity
         SELECT es.source_dataset_id AS dataset_id, 0 AS depth
         FROM meta.entity_sources es
         WHERE es.installation_id = $1 AND es.entity_id = $2
         UNION ALL
         -- Recursive: volg lineage_edges downstream
         SELECT le.target_dataset_id, ds.depth + 1
         FROM meta.lineage_edges le
         JOIN downstream ds ON le.source_dataset_id = ds.dataset_id
         WHERE le.installation_id = $1 AND ds.depth < 10
       )
       SELECT DISTINCT bo.*, pol.product_id AS via_product_id, MIN(ds.depth) AS min_depth
       FROM downstream ds
       JOIN meta.datasets d ON d.installation_id = $1 AND d.dataset_id = ds.dataset_id
         AND d.valid_to IS NULL
       JOIN meta.entities e ON e.installation_id = $1 AND e.entity_id = d.entity_id
         AND e.valid_to IS NULL
       JOIN meta.data_products dp ON dp.installation_id = $1 AND dp.data_product_id = e.data_product_id
         AND dp.valid_to IS NULL
       JOIN meta.product_output_links pol
         ON pol.installation_id = $1 AND pol.product_id = dp.data_product_id
       JOIN meta.business_outputs bo
         ON bo.installation_id = $1 AND bo.id = pol.output_id
       GROUP BY bo.installation_id, bo.id, bo.name, bo.output_type,
                bo.owner_team, bo.criticality, bo.description, pol.product_id
       ORDER BY bo.criticality DESC, min_depth, bo.name`,
      [installationId, entityId]
    );

    return NextResponse.json({ data: result.rows });
  } catch (err) {
    console.error("[GET /api/lineage/[id]/impact]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
