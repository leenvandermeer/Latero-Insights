import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";

const VALID_OUTPUT_TYPES = new Set(["kpi", "dashboard", "process", "report", "risk"]);
const VALID_CRITICALITY = new Set(["low", "medium", "high", "critical"]);

function ip(r: NextRequest) {
  return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function resolveInstallation(request: NextRequest): Promise<string> {
  const session = await requireSession(request);
  return session.active_installation_id as string;
}

/**
 * GET /api/products/[id]/business-outputs
 * Alle business outputs gekoppeld aan dit data product.
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
    const result = await pool.query(
      `SELECT bo.*, pol.description AS link_description
       FROM meta.product_output_links pol
       JOIN meta.business_outputs bo
         ON bo.installation_id = pol.installation_id AND bo.id = pol.output_id
       WHERE pol.installation_id = $1 AND pol.product_id = $2
       ORDER BY bo.criticality DESC, bo.name`,
      [installationId, id]
    );
    return NextResponse.json({ data: result.rows });
  } catch (err) {
    console.error("[GET /api/products/[id]/business-outputs]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/products/[id]/business-outputs
 * Koppel een bestaande business output aan dit data product.
 * Body: { output_id: string, description?: string }
 */
export async function POST(
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

  const { output_id, description } = body as { output_id?: string; description?: string };
  if (!output_id?.trim()) return NextResponse.json({ error: "output_id is required" }, { status: 400 });

  const pool = getPgPool();
  try {
    // Verify output belongs to this installation
    const exists = await pool.query(
      `SELECT 1 FROM meta.business_outputs WHERE installation_id = $1 AND id = $2`,
      [installationId, output_id]
    );
    if (exists.rows.length === 0) return NextResponse.json({ error: "Business output not found" }, { status: 404 });

    await pool.query(
      `INSERT INTO meta.product_output_links (installation_id, product_id, output_id, description)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (installation_id, product_id, output_id) DO UPDATE
         SET description = EXCLUDED.description`,
      [installationId, id, output_id.trim(), description ?? null]
    );
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/products/[id]/business-outputs]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
