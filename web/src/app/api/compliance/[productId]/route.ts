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
 * GET /api/compliance/[productId]
 * Alle verdicts voor één product (meest recente per policy).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { allowed } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productId } = await params;
  const pool = getPgPool();

  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (v.policy_id)
         v.policy_id, v.verdict, v.detail, v.evaluated_at,
         p.name AS policy_name, p.description AS policy_description,
         p.action, p.pack_id, pp.name AS pack_name
       FROM meta.policy_verdicts v
       JOIN meta.policies p ON p.installation_id = v.installation_id AND p.id = v.policy_id
       LEFT JOIN meta.policy_packs pp ON pp.installation_id = p.installation_id AND pp.id = p.pack_id
       WHERE v.installation_id = $1 AND v.product_id = $2
       ORDER BY v.policy_id, v.evaluated_at DESC`,
      [installationId, productId]
    );

    return NextResponse.json({ data: result.rows });
  } catch (err) {
    console.error("[GET /api/compliance/[productId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
