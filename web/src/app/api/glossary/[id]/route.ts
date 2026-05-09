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
 * GET /api/glossary/[id]
 * Retourneert een glossarium-term incl. dataset-koppelingen.
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

  const { id } = await params;
  const pool = getPgPool();

  try {
    const [termRes, linksRes] = await Promise.all([
      pool.query(
        `SELECT id, installation_id, name, definition, owner_team, valid_from
         FROM meta.glossary_terms
         WHERE installation_id = $1 AND id = $2 AND valid_to IS NULL`,
        [installationId, id]
      ),
      pool.query(
        `SELECT l.dataset_id, l.column_name, d.fqn AS dataset_fqn
         FROM meta.term_dataset_links l
         LEFT JOIN meta.datasets d ON d.id = l.dataset_id AND d.valid_to IS NULL
         WHERE l.installation_id = $1 AND l.term_id = $2`,
        [installationId, id]
      ),
    ]);

    if (termRes.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      data: { ...termRes.rows[0], dataset_links: linksRes.rows },
    });
  } catch (err) {
    console.error("[GET /api/glossary/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/glossary/[id]
 * Versioned update: sluit de huidige term af en maakt een nieuwe versie.
 * Body: { name?, definition?, owner_team? }
 */
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

  const { name, definition, owner_team } = body as {
    name?: string; definition?: string; owner_team?: string;
  };

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Load current version
    const current = await client.query(
      `SELECT * FROM meta.glossary_terms
       WHERE installation_id = $1 AND id = $2 AND valid_to IS NULL
       FOR UPDATE`,
      [installationId, id]
    );
    if (current.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const now = new Date();
    const row = current.rows[0];

    // Close current version
    await client.query(
      `UPDATE meta.glossary_terms SET valid_to = $3
       WHERE installation_id = $1 AND id = $2 AND valid_to IS NULL`,
      [installationId, id, now]
    );

    // Insert new version
    const newRow = await client.query(
      `INSERT INTO meta.glossary_terms
         (id, installation_id, name, definition, owner_team, valid_from)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, installation_id, name, definition, owner_team, valid_from`,
      [
        id, installationId,
        name?.trim() ?? row.name,
        definition?.trim() ?? row.definition,
        owner_team !== undefined ? (owner_team?.trim() ?? null) : row.owner_team,
        now,
      ]
    );

    await client.query("COMMIT");
    return NextResponse.json({ data: newRow.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[PUT /api/glossary/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    client.release();
  }
}

/**
 * DELETE /api/glossary/[id]
 * Soft-delete: sluit de actieve versie af.
 */
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
  try {
    const result = await pool.query(
      `UPDATE meta.glossary_terms SET valid_to = now()
       WHERE installation_id = $1 AND id = $2 AND valid_to IS NULL`,
      [installationId, id]
    );
    if (result.rowCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/glossary/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
