import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";
import { evaluatePolicy } from "@/lib/policy-engine";
import type { Policy } from "@/lib/policy-engine";

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

/**
 * POST /api/compliance/[productId]
 * Voert een enkele policy-check uit voor dit product en slaat het verdict op.
 * Body: { policy_id: string }
 */
export async function POST(
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

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { policy_id } = body as { policy_id?: string };
  if (!policy_id?.trim()) {
    return NextResponse.json({ error: "policy_id is required" }, { status: 400 });
  }

  const pool = getPgPool();

  try {
    // Load the policy
    const policyRes = await pool.query(
      `SELECT * FROM meta.policies WHERE installation_id = $1 AND id = $2`,
      [installationId, policy_id.trim()]
    );
    if (policyRes.rows.length === 0) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    // Check product exists
    const productRes = await pool.query(
      `SELECT 1 FROM meta.data_products WHERE installation_id = $1 AND data_product_id = $2 AND valid_to IS NULL`,
      [installationId, productId]
    );
    if (productRes.rows.length === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const policy = policyRes.rows[0] as Policy;
    const { verdict, detail } = await evaluatePolicy(policy, productId, installationId);

    // Persist verdict
    await pool.query(
      `INSERT INTO meta.policy_verdicts (policy_id, installation_id, product_id, verdict, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [policy.id, installationId, productId, verdict, detail ? JSON.stringify(detail) : null]
    );

    return NextResponse.json({ data: { verdict, detail: detail ?? {} } });
  } catch (err) {
    console.error("[POST /api/compliance/[productId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
