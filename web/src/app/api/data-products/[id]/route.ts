import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";

const PRODUCT_SELECT = `
  dp.data_product_id,
  dp.display_name,
  dp.description,
  dp.owner,
  dp.domain,
  dp.sla_tier,
  dp.sla,
  dp.contract_ver,
  dp.deprecated_at,
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
   AND e.valid_to IS NULL
`;

const PRODUCT_GROUP = `
  GROUP BY dp.data_product_id, dp.display_name, dp.description,
           dp.owner, dp.domain, dp.sla_tier, dp.sla, dp.contract_ver,
           dp.deprecated_at, dp.tags, dp.created_at, dp.updated_at
`;

const VALID_SLA = new Set(["bronze", "silver", "gold"]);

function ip(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function resolveInstallation(request: NextRequest) {
  const session = await requireSession(request);
  return session.active_installation_id as string;
}

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

  const { id } = await params;
  const pool = getPgPool();
  try {
    const result = await pool.query(
      `SELECT ${PRODUCT_SELECT} ${PRODUCT_FROM}
       WHERE dp.installation_id = $1 AND dp.data_product_id = $2
         AND dp.valid_to IS NULL
       ${PRODUCT_GROUP}`,
      [installationId, id]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: result.rows[0] });
  } catch (err) {
    console.error("[GET /api/data-products/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { display_name, description, owner, domain, sla_tier, entity_ids, sla, contract_ver } = body as {
    display_name?: string; description?: string; owner?: string;
    domain?: string; sla_tier?: string | null; entity_ids?: string[];
    sla?: { freshness_minutes?: number; quality_threshold?: number } | null;
    contract_ver?: string | null;
  };

  if (display_name !== undefined && !display_name.trim()) {
    return NextResponse.json({ error: "display_name cannot be empty" }, { status: 400 });
  }
  if (sla_tier && !VALID_SLA.has(sla_tier)) {
    return NextResponse.json({ error: "Invalid sla_tier" }, { status: 400 });
  }

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify ownership
    const exists = await client.query(
      `SELECT 1 FROM meta.data_products WHERE installation_id = $1 AND data_product_id = $2`,
      [installationId, id]
    );
    if (exists.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await client.query(
      `UPDATE meta.data_products SET
         display_name  = COALESCE($3, display_name),
         description   = $4,
         owner         = $5,
         domain        = $6,
         sla_tier      = $7,
         sla           = CASE WHEN $8::text IS NULL THEN sla ELSE $8::jsonb END,
         contract_ver  = CASE WHEN $9::text IS NULL THEN contract_ver ELSE $9 END,
         updated_at    = now()
       WHERE installation_id = $1 AND data_product_id = $2`,
      [installationId, id,
       display_name?.trim() ?? null,
       description ?? null,
       owner ?? null,
       domain ?? null,
       sla_tier ?? null,
       sla !== undefined ? JSON.stringify(sla) : null,
       contract_ver !== undefined ? contract_ver : null]
    );

    if (Array.isArray(entity_ids)) {
      // Detach all current entities, then attach the new set
      await client.query(
        `UPDATE meta.entities SET data_product_id = NULL WHERE installation_id = $1 AND data_product_id = $2`,
        [installationId, id]
      );
      if (entity_ids.length > 0) {
        await client.query(
          `UPDATE meta.entities SET data_product_id = $1 WHERE installation_id = $2 AND entity_id = ANY($3::text[])`,
          [id, installationId, entity_ids]
        );
      }
    }

    await client.query("COMMIT");

    const row = await pool.query(
      `SELECT ${PRODUCT_SELECT} ${PRODUCT_FROM}
       WHERE dp.installation_id = $1 AND dp.data_product_id = $2 ${PRODUCT_GROUP}`,
      [installationId, id]
    );
    return NextResponse.json({ data: row.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[PUT /api/data-products/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const exists = await client.query(
      `SELECT 1 FROM meta.data_products WHERE installation_id = $1 AND data_product_id = $2`,
      [installationId, id]
    );
    if (exists.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Detach entities (FK is ON DELETE SET NULL, but we do it explicitly for clarity)
    await client.query(
      `UPDATE meta.entities SET data_product_id = NULL WHERE installation_id = $1 AND data_product_id = $2`,
      [installationId, id]
    );

    await client.query(
      `DELETE FROM meta.data_products WHERE installation_id = $1 AND data_product_id = $2`,
      [installationId, id]
    );

    await client.query("COMMIT");
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[DELETE /api/data-products/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    client.release();
  }
}
