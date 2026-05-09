import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";

const VALID_TYPES = new Set([
  "schema_drift", "contract_drift", "ownership_drift", "statistical_drift", "lineage_drift",
]);
const VALID_SEVERITY = new Set(["informational", "significant", "breaking"]);

function ip(r: NextRequest) {
  return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function resolveInstallation(request: NextRequest): Promise<string> {
  const session = await requireSession(request);
  return session.active_installation_id as string;
}

/**
 * GET /api/changes
 * Query params: type, severity, entity_id, from, to, limit (max 100)
 */
export async function GET(request: NextRequest) {
  const { allowed, remaining } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const p = request.nextUrl.searchParams;
  const type = p.get("type");
  const severity = p.get("severity");
  const entity_id = p.get("entity_id");
  const from = p.get("from");
  const to = p.get("to");
  const limitParam = p.get("limit");
  const limit = Math.min(parseInt(limitParam ?? "100", 10) || 100, 200);

  const values: unknown[] = [installationId];
  let idx = 2;
  const filters: string[] = [];

  if (type && VALID_TYPES.has(type)) { filters.push(`change_type = $${idx++}`); values.push(type); }
  if (severity && VALID_SEVERITY.has(severity)) { filters.push(`severity = $${idx++}`); values.push(severity); }
  if (entity_id) { filters.push(`entity_id = $${idx++}`); values.push(entity_id); }
  if (from) { filters.push(`detected_at >= $${idx++}`); values.push(from); }
  if (to) { filters.push(`detected_at <= $${idx++}`); values.push(to); }

  const where = filters.length > 0 ? " AND " + filters.join(" AND ") : "";
  values.push(limit);

  const pool = getPgPool();
  try {
    const result = await pool.query(
      `SELECT id, change_type, severity, entity_type, entity_id, diff, risk_assessment, detected_at
       FROM meta.change_events
       WHERE installation_id = $1${where}
       ORDER BY detected_at DESC
       LIMIT $${idx}`,
      values
    );

    const response = NextResponse.json({ data: result.rows });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    console.error("[GET /api/changes]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
