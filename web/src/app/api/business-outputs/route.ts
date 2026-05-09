import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";
import { randomUUID } from "crypto";

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
 * GET /api/business-outputs
 * Query params: output_type, criticality
 */
export async function GET(request: NextRequest) {
  const { allowed, remaining } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const output_type = params.get("output_type");
  const criticality = params.get("criticality");

  const values: unknown[] = [installationId];
  let idx = 2;
  const filters: string[] = [];

  if (output_type && VALID_OUTPUT_TYPES.has(output_type)) {
    filters.push(`bo.output_type = $${idx++}`); values.push(output_type);
  }
  if (criticality && VALID_CRITICALITY.has(criticality)) {
    filters.push(`bo.criticality = $${idx++}`); values.push(criticality);
  }

  const where = filters.length > 0 ? " AND " + filters.join(" AND ") : "";

  const pool = getPgPool();
  try {
    const result = await pool.query(
      `SELECT bo.*,
              COUNT(pol.product_id)::int AS linked_product_count
       FROM meta.business_outputs bo
       LEFT JOIN meta.product_output_links pol
         ON pol.installation_id = bo.installation_id AND pol.output_id = bo.id
       WHERE bo.installation_id = $1${where}
       GROUP BY bo.installation_id, bo.id
       ORDER BY bo.criticality DESC, bo.name`,
      values
    );
    const response = NextResponse.json({ data: result.rows });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    console.error("[GET /api/business-outputs]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/business-outputs
 */
export async function POST(request: NextRequest) {
  const { allowed } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, output_type, owner_team, criticality, description } = body as {
    name?: string; output_type?: string; owner_team?: string;
    criticality?: string; description?: string;
  };

  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!output_type || !VALID_OUTPUT_TYPES.has(output_type))
    return NextResponse.json({ error: "Invalid output_type" }, { status: 400 });
  if (criticality && !VALID_CRITICALITY.has(criticality))
    return NextResponse.json({ error: "Invalid criticality" }, { status: 400 });

  const pool = getPgPool();
  try {
    const id = randomUUID();
    const result = await pool.query(
      `INSERT INTO meta.business_outputs
         (id, installation_id, name, output_type, owner_team, criticality, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, installationId, name.trim(), output_type, owner_team ?? null,
       criticality ?? "medium", description ?? null]
    );
    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/business-outputs]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
