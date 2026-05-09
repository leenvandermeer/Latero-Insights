import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";
import { randomUUID } from "crypto";

const PRODUCT_SELECT = `
  dp.data_product_id,
  dp.display_name,
  dp.description,
  dp.owner,
  dp.domain,
  dp.sla_tier,
  dp.tags,
  dp.created_at,
  dp.updated_at,
  COALESCE(json_agg(e.entity_id ORDER BY e.entity_id) FILTER (WHERE e.entity_id IS NOT NULL), '[]') AS entity_ids,
  COUNT(DISTINCT e.entity_id)::int AS entity_count
`;

const PRODUCT_FROM = `
  FROM meta.data_products dp
  LEFT JOIN meta.entities e
    ON e.installation_id = dp.installation_id
   AND e.data_product_id = dp.data_product_id
`;

const PRODUCT_GROUP = `
  GROUP BY dp.data_product_id, dp.display_name, dp.description,
           dp.owner, dp.domain, dp.sla_tier, dp.tags, dp.created_at, dp.updated_at
`;

const VALID_SLA = new Set(["bronze", "silver", "gold"]);

function ip(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function GET(request: NextRequest) {
  const { allowed, remaining } = rateLimit(ip(request));
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
      `SELECT ${PRODUCT_SELECT} ${PRODUCT_FROM}
       WHERE dp.installation_id = $1
         AND dp.valid_to IS NULL
       ${PRODUCT_GROUP}
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

export async function POST(request: NextRequest) {
  const { allowed } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string | null = null;
  try {
    const session = await requireSession(request);
    installationId = session.active_installation_id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { display_name, description, owner, domain, sla_tier, entity_ids } = body as {
    display_name?: string; description?: string; owner?: string;
    domain?: string; sla_tier?: string; entity_ids?: string[];
  };

  if (!display_name?.trim()) return NextResponse.json({ error: "display_name is required" }, { status: 400 });
  if (sla_tier && !VALID_SLA.has(sla_tier)) return NextResponse.json({ error: "Invalid sla_tier" }, { status: 400 });

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = randomUUID();
    await client.query(
      `INSERT INTO meta.data_products (data_product_id, installation_id, display_name, description, owner, domain, sla_tier)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, installationId, display_name.trim(), description ?? null, owner ?? null, domain ?? null, sla_tier ?? null]
    );
    if (Array.isArray(entity_ids) && entity_ids.length > 0) {
      await client.query(
        `UPDATE meta.entities SET data_product_id = $1 WHERE installation_id = $2 AND entity_id = ANY($3::text[])`,
        [id, installationId, entity_ids]
      );
    }
    await client.query("COMMIT");
    const row = await pool.query(
      `SELECT ${PRODUCT_SELECT} ${PRODUCT_FROM} WHERE dp.installation_id = $1 AND dp.data_product_id = $2 ${PRODUCT_GROUP}`,
      [installationId, id]
    );
    return NextResponse.json({ data: row.rows[0] }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[POST /api/data-products]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    client.release();
  }
}
