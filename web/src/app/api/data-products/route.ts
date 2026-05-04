import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";

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

  const pool = getPgPool();
  try {
    const result = await pool.query(
      `SELECT
         dp.data_product_id,
         dp.display_name,
         dp.description,
         dp.owner,
         dp.domain,
         dp.tags,
         dp.created_at,
         dp.updated_at,
         COUNT(DISTINCT e.entity_id)::int AS entity_count
       FROM meta.data_products dp
       LEFT JOIN meta.entities e
         ON e.installation_id = dp.installation_id
        AND e.data_product_id = dp.data_product_id
       WHERE dp.installation_id = $1
       GROUP BY dp.data_product_id, dp.display_name, dp.description,
                dp.owner, dp.domain, dp.tags, dp.created_at, dp.updated_at
       ORDER BY dp.display_name`,
      [installationId]
    );

    const response = NextResponse.json({ data: result.rows, source: "insights-saas" });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    console.error("[GET /api/data-products]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
