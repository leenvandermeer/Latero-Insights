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
 * DELETE /api/products/[id]/business-outputs/[outputId]
 * Verwijder een koppeling tussen product en business output.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; outputId: string }> }
) {
  const { allowed } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, outputId } = await params;
  const pool = getPgPool();
  try {
    const result = await pool.query(
      `DELETE FROM meta.product_output_links
       WHERE installation_id = $1 AND product_id = $2 AND output_id = $3`,
      [installationId, id, outputId]
    );
    if (result.rowCount === 0) return NextResponse.json({ error: "Link not found" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/products/[id]/business-outputs/[outputId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
