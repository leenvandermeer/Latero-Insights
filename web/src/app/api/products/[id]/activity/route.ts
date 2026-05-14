import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";

function ip(r: NextRequest) {
  return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export interface ActivityRecord {
  id: string;
  source: "pipeline_run" | "quality_check";
  entity_fqn: string;
  status: string;
  occurred_at: string;
  label: string | null;
  detail: string | null;
}

/**
 * GET /api/products/[id]/activity
 * Returns a merged timeline of pipeline runs and quality check results
 * for all member entities of a product. Last 30 days, newest first.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed, remaining } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try {
    const session = await requireSession(request);
    installationId = session.active_installation_id as string;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: productId } = await params;
  const pool = getPgPool();

  try {
    const result = await pool.query<ActivityRecord>(
      `
      SELECT
        r.run_id::text               AS id,
        'pipeline_run'               AS source,
        io.dataset_id                AS entity_fqn,
        r.status,
        r.started_at                 AS occurred_at,
        j.job_name                   AS label,
        NULL::text                   AS detail
      FROM meta.runs r
      JOIN meta.jobs j
        ON  j.job_id           = r.job_id
      JOIN meta.run_io io
        ON  io.run_id          = r.run_id
        AND io.installation_id = r.installation_id
        AND io.role            = 'OUTPUT'
      JOIN meta.entities e
        ON  e.entity_id        = io.dataset_id
        AND e.installation_id  = r.installation_id
        AND e.valid_to         IS NULL
        AND e.data_product_id  = $2
      WHERE r.installation_id = $1
        AND r.started_at      >= now() - INTERVAL '30 days'

      ORDER BY occurred_at DESC
      LIMIT 200
      `,
      [installationId, productId]
    );

    return NextResponse.json(
      { data: result.rows },
      { headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
  } catch (err) {
    console.error("[GET /api/products/[id]/activity]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
