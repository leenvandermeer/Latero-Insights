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
 * GET /api/compliance
 * Compliance matrix: producten × policy packs, met pass/fail/exception verdicts.
 * Gebruikt de meest recente verdict per policy × product.
 */
export async function GET(request: NextRequest) {
  const { allowed, remaining } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPgPool();
  try {
    // Latest verdict per policy × product
    const verdictRes = await pool.query(
      `SELECT DISTINCT ON (v.policy_id, v.product_id)
         v.policy_id, v.product_id, v.verdict, v.detail, v.evaluated_at,
         p.pack_id, p.name AS policy_name, p.action
       FROM meta.policy_verdicts v
       JOIN meta.policies p ON p.installation_id = v.installation_id AND p.id = v.policy_id
       WHERE v.installation_id = $1
       ORDER BY v.policy_id, v.product_id, v.evaluated_at DESC`,
      [installationId]
    );

    const [productsRes, packsRes] = await Promise.all([
      pool.query(
        `SELECT data_product_id, display_name, domain, owner
         FROM meta.data_products WHERE installation_id = $1 AND valid_to IS NULL AND deprecated_at IS NULL
         ORDER BY display_name`,
        [installationId]
      ),
      pool.query(
        `SELECT * FROM meta.policy_packs WHERE installation_id = $1 ORDER BY name`,
        [installationId]
      ),
    ]);

    const response = NextResponse.json({
      data: {
        verdicts: verdictRes.rows,
        products: productsRes.rows,
        packs: packsRes.rows,
      },
    });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    console.error("[GET /api/compliance]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
