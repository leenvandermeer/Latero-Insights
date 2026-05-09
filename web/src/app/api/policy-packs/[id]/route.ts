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

/** PUT /api/policy-packs/[id] — update name / description / framework */
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

  const pool = getPgPool();
  try {
    const result = await pool.query(
      `UPDATE meta.policy_packs SET
         name        = COALESCE($3, name),
         description = CASE WHEN $4::text IS NULL THEN description ELSE $4 END,
         framework   = CASE WHEN $5::text IS NULL THEN framework   ELSE $5 END
       WHERE installation_id = $1 AND id = $2
       RETURNING *`,
      [
        installationId,
        id,
        (body.name as string | undefined)?.trim() ?? null,
        (body.description as string | undefined)?.trim() ?? null,
        (body.framework as string | undefined)?.trim() ?? null,
      ]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: result.rows[0] });
  } catch (err) {
    console.error("[PUT /api/policy-packs/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE /api/policy-packs/[id] — removes the pack; policies become unassigned */
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
    // Detach policies from this pack first so they remain intact
    await pool.query(
      `UPDATE meta.policies SET pack_id = NULL WHERE installation_id = $1 AND pack_id = $2`,
      [installationId, id]
    );
    const result = await pool.query(
      `DELETE FROM meta.policy_packs WHERE installation_id = $1 AND id = $2 RETURNING id`,
      [installationId, id]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: { id } });
  } catch (err) {
    console.error("[DELETE /api/policy-packs/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
