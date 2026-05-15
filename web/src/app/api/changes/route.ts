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
      `SELECT * FROM (
         SELECT DISTINCT ON (ce.id)
           ce.id,
           ce.change_type,
           ce.severity,
           ce.entity_type,
           ce.entity_id,
           COALESCE(
             dp.display_name,
             d.object_name,
             ent.entity_name,
             j.job_name
           ) AS entity_name,
           ce.diff,
           ce.risk_assessment,
           ce.detected_at
         FROM meta.change_events ce
         LEFT JOIN meta.data_products dp
           ON ce.entity_type = 'product'
          AND dp.installation_id = ce.installation_id
          AND dp.data_product_id::text = ce.entity_id
         LEFT JOIN meta.datasets d
           ON ce.entity_type = 'dataset'
          AND d.installation_id = ce.installation_id
          AND d.dataset_id = ce.entity_id
          AND d.valid_to IS NULL
         LEFT JOIN meta.entities ent
           ON ce.entity_type = 'entity'
          AND ent.installation_id = ce.installation_id
          AND ent.entity_id = ce.entity_id
         LEFT JOIN meta.runs r
           ON r.installation_id = ce.installation_id
          AND r.run_id::text = ce.entity_id
         LEFT JOIN meta.jobs j
           ON j.job_id = r.job_id
         WHERE ce.installation_id = $1${where}
         ORDER BY ce.id
       ) sub
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
