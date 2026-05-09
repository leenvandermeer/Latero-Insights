import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";
import { randomUUID } from "crypto";

const VALID_SEVERITY = new Set(["low", "medium", "high", "critical"]);
const VALID_STATUS = new Set(["open", "in_progress", "resolved"]);
const VALID_SOURCE_TYPE = new Set(["alert", "policy_violation", "manual"]);

function ip(r: NextRequest) {
  return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function resolveInstallation(request: NextRequest): Promise<string> {
  const session = await requireSession(request);
  return session.active_installation_id as string;
}

/**
 * GET /api/incidents
 * Query params: status, severity, product_id
 */
export async function GET(request: NextRequest) {
  const { allowed, remaining } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const severity = params.get("severity");
  const product_id = params.get("product_id");

  const pool = getPgPool();
  const values: unknown[] = [installationId];
  let idx = 2;
  const filters: string[] = [];

  if (status && VALID_STATUS.has(status)) { filters.push(`i.status = $${idx++}`); values.push(status); }
  if (severity && VALID_SEVERITY.has(severity)) { filters.push(`i.severity = $${idx++}`); values.push(severity); }
  if (product_id) { filters.push(`i.product_id = $${idx++}`); values.push(product_id); }

  const where = filters.length > 0 ? " AND " + filters.join(" AND ") : "";

  try {
    const result = await pool.query(
      `SELECT i.id, i.installation_id, i.product_id, i.title, i.severity, i.status,
              i.assignee, i.created_at, i.updated_at, i.resolved_at, i.source_type, i.source_id,
              EXTRACT(EPOCH FROM (COALESCE(i.resolved_at, now()) - i.created_at))::int AS duration_seconds,
              COUNT(s.id)::int AS step_count,
              COUNT(s.id) FILTER (WHERE s.completed_at IS NOT NULL)::int AS steps_completed
       FROM meta.incidents i
       LEFT JOIN meta.incident_steps s ON s.incident_id = i.id
       WHERE i.installation_id = $1${where}
       GROUP BY i.id
       ORDER BY i.created_at DESC`,
      values
    );
    const response = NextResponse.json({ data: result.rows });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    console.error("[GET /api/incidents]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/incidents
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

  const { title, severity, product_id, assignee, source_type, source_id } = body as {
    title?: string; severity?: string; product_id?: string;
    assignee?: string; source_type?: string; source_id?: string;
  };

  if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (severity && !VALID_SEVERITY.has(severity)) return NextResponse.json({ error: "Invalid severity" }, { status: 400 });
  if (source_type && !VALID_SOURCE_TYPE.has(source_type)) return NextResponse.json({ error: "Invalid source_type" }, { status: 400 });

  const pool = getPgPool();
  try {
    const result = await pool.query(
      `INSERT INTO meta.incidents
         (installation_id, product_id, title, severity, assignee, source_type, source_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [installationId, product_id ?? null, title.trim(),
       severity ?? "medium", assignee ?? null, source_type ?? "manual", source_id ?? null]
    );
    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/incidents]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
