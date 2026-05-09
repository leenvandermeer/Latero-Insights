import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";

function ip(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * POST /api/data-products/[id]/deprecate
 * Markeert een data product als deprecated (deprecated_at = now()).
 * Is idempotent: al-gedeprecateerde producten krijgen geen nieuwe timestamp.
 *
 * DELETE (undeprecate) is ook ondersteund.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try {
    const session = await requireSession(request);
    installationId = session.active_installation_id as string;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const pool = getPgPool();

  try {
    const result = await pool.query(
      `UPDATE meta.data_products
       SET deprecated_at = COALESCE(deprecated_at, now()),
           updated_at    = now()
       WHERE installation_id = $1 AND data_product_id = $2
         AND valid_to IS NULL
       RETURNING data_product_id, deprecated_at`,
      [installationId, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data: result.rows[0] });
  } catch (err) {
    console.error("[POST /api/data-products/[id]/deprecate]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/data-products/[id]/deprecate
 * Heft de deprecated-status op (deprecated_at = NULL).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try {
    const session = await requireSession(request);
    installationId = session.active_installation_id as string;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const pool = getPgPool();

  try {
    const result = await pool.query(
      `UPDATE meta.data_products
       SET deprecated_at = NULL,
           updated_at    = now()
       WHERE installation_id = $1 AND data_product_id = $2
         AND valid_to IS NULL
       RETURNING data_product_id, deprecated_at`,
      [installationId, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data: result.rows[0] });
  } catch (err) {
    console.error("[DELETE /api/data-products/[id]/deprecate]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
