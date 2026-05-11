import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";
import { detectOwnershipDrift, detectContractDrift } from "@/lib/change-detection";

const PRODUCT_SELECT = `
  dp.data_product_id,
  dp.display_name,
  dp.description,
  dp.owner,
  dp.data_steward,
  dp.domain,
  dp.classification,
  dp.retention_days,
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
           dp.owner, dp.data_steward, dp.domain, dp.classification, dp.retention_days,
           dp.sla_tier, dp.sla, dp.contract_ver,
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

  const { display_name, description, owner, domain, sla_tier, entity_ids, sla, contract_ver,
          classification, data_steward, retention_days } = body as {
    display_name?: string; description?: string; owner?: string;
    domain?: string; sla_tier?: string | null; entity_ids?: string[];
    sla?: { freshness_minutes?: number; quality_threshold?: number } | null;
    contract_ver?: string | null;
    classification?: string | null;
    data_steward?: string | null;
    retention_days?: number | null;
  };

  const VALID_CLASSIFICATION = new Set(["public", "internal", "confidential", "restricted"]);
  if (classification && !VALID_CLASSIFICATION.has(classification)) {
    return NextResponse.json({ error: "Invalid classification" }, { status: 400 });
  }
  if (retention_days !== undefined && retention_days !== null && (typeof retention_days !== "number" || retention_days <= 0)) {
    return NextResponse.json({ error: "retention_days must be a positive number" }, { status: 400 });
  }

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

    // Verify ownership + fetch current state for drift detection
    const exists = await client.query(
      `SELECT owner, sla, contract_ver FROM meta.data_products WHERE installation_id = $1 AND data_product_id = $2`,
      [installationId, id]
    );
    if (exists.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const prev = exists.rows[0];

    // Build dynamic SET clause — only update fields present in the request body
    const setClauses: string[] = ["updated_at = now()"];
    const values: unknown[] = [installationId, id];
    let idx = 3;

    const addField = (col: string, val: unknown) => {
      setClauses.push(`${col} = $${idx++}`);
      values.push(val);
    };
    const addJsonField = (col: string, val: unknown) => {
      setClauses.push(`${col} = $${idx++}::jsonb`);
      values.push(val !== null ? JSON.stringify(val) : null);
    };

    if (display_name !== undefined) addField("display_name", display_name.trim() || null);
    if (description  !== undefined) addField("description",  description ?? null);
    if (owner        !== undefined) addField("owner",         owner ?? null);
    if (domain       !== undefined) addField("domain",        domain ?? null);
    if (sla_tier     !== undefined) addField("sla_tier",      sla_tier ?? null);
    if (sla          !== undefined) addJsonField("sla",        sla ?? null);
    if (contract_ver !== undefined) addField("contract_ver",  contract_ver ?? null);
    if (classification !== undefined) addField("classification", classification ?? null);
    if (data_steward   !== undefined) addField("data_steward",   data_steward ?? null);
    if (retention_days !== undefined) addField("retention_days", retention_days ?? null);

    await client.query(
      `UPDATE meta.data_products SET ${setClauses.join(", ")}
       WHERE installation_id = $1 AND data_product_id = $2`,
      values
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

    // Fire-and-forget: drift detection (non-blocking)
    const newOwner = owner !== undefined ? (owner ?? null) : (prev.owner ?? null);
    const newSla = sla !== undefined ? sla : prev.sla;
    const newContractVer = contract_ver !== undefined ? (contract_ver ?? null) : (prev.contract_ver ?? null);

    void detectOwnershipDrift(id, installationId, prev.owner ?? null, newOwner).catch(() => {});
    void detectContractDrift(id, installationId,
      { sla: prev.sla, contract_ver: prev.contract_ver ?? null },
      { sla: newSla, contract_ver: newContractVer }
    ).catch(() => {});

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
