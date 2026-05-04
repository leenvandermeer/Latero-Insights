import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";

const VALID_LAYERS = ["landing", "raw", "bronze", "silver", "gold"] as const;

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(clientIp);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string | null = null;
  try {
    const session = await requireSession(request);
    installationId = session.active_installation_id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const layerParam = params.get("layer");
  const q = params.get("q");

  // Validate layer param against allowlist to prevent injection
  const layer = layerParam && (VALID_LAYERS as readonly string[]).includes(layerParam)
    ? layerParam
    : null;

  const pool = getPgPool();
  const values: string[] = [installationId!];
  let idx = 2;
  let filters = "";

  if (layer) {
    filters += ` AND d.layer = $${idx++}`;
    values.push(layer);
  }
  if (q) {
    filters += ` AND (d.object_name ILIKE $${idx} OR d.fqn ILIKE $${idx} OR d.group_id ILIKE $${idx})`;
    idx++;
    values.push(`%${q}%`);
  }

  try {
    const result = await pool.query(
      `SELECT
         d.dataset_id,
         d.fqn,
         d.namespace,
         d.object_name,
         d.platform,
         d.entity_type,
         d.source_system,
         d.layer,
         d.group_id,
         d.first_seen_at,
         d.last_seen_at,
         -- Latest run status for this dataset
         (
           SELECT r.status
           FROM meta.runs r
           JOIN meta.jobs j ON j.job_id = r.job_id
           WHERE j.dataset_id = d.fqn
             AND r.installation_id = d.installation_id
           ORDER BY r.started_at DESC
           LIMIT 1
         ) AS latest_run_status,
         (
           SELECT r.started_at
           FROM meta.runs r
           JOIN meta.jobs j ON j.job_id = r.job_id
           WHERE j.dataset_id = d.fqn
             AND r.installation_id = d.installation_id
           ORDER BY r.started_at DESC
           LIMIT 1
         ) AS latest_run_at
       FROM meta.datasets d
       WHERE d.installation_id = $1
         ${filters}
       ORDER BY d.layer NULLS LAST, d.object_name`,
      values
    );

    const response = NextResponse.json({ data: result.rows, source: "insights-saas" });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    console.error("[/api/datasets] query error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
