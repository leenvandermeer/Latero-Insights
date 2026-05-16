import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";

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
  // Default: last 30 days
  const defaultTo = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const rawFrom = params.get("from");
  const rawTo = params.get("to");
  const from = rawFrom && /^\d{4}-\d{2}-\d{2}$/.test(rawFrom) ? rawFrom : defaultFrom;
  const to   = rawTo   && /^\d{4}-\d{2}-\d{2}$/.test(rawTo)   ? rawTo   : defaultTo;

  const status = params.get("status");
  const step = params.get("step");
  const product_id = params.get("product_id");
  const entity = params.get("entity");
  const cursor = params.get("cursor"); // ISO timestamp for cursor-based pagination
  const limit = Math.min(parseInt(params.get("limit") ?? "100"), 500);

  const pool = getPgPool();
  const values: (string | number)[] = [installationId!, from, to];
  let idx = 4;

  let filters = "";
  if (status) { filters += ` AND r.status = $${idx++}`; values.push(status.toUpperCase()); }
  if (step) {
    filters += ` AND (j.job_name ILIKE $${idx} OR COALESCE(r.task_key, '') ILIKE $${idx} OR COALESCE(r.step, '') ILIKE $${idx})`;
    values.push(`%${step}%`);
    idx++;
  }
  if (entity) { filters += ` AND j.dataset_id = $${idx++}`; values.push(entity); }
  if (product_id) { filters += ` AND j.dataset_id = $${idx++}`; values.push(product_id); }
  if (cursor) { filters += ` AND r.started_at < $${idx++}`; values.push(cursor); }
  values.push(limit + 1);
  const limitIdx = idx++;

  try {
    const result = await pool.query(
       `SELECT
         r.run_id,
         r.external_run_id,
         j.job_name,
         j.dataset_id,
         r.step,
         r.task_key,
         r.status,
         r.environment,
         r.started_at,
         r.ended_at,
         r.duration_ms,
         r.attempt_number,
         r.queue_duration_ms,
         r.setup_duration_ms,
         r.trigger,
         r.run_page_url,
         r.dbx_job_run_id,
         r.dbx_task_run_id,
         r.parent_run_id,
         (SELECT COUNT(*) FROM meta.run_io io WHERE io.run_id = r.run_id) AS io_count,
         (SELECT COUNT(*) FROM meta.quality_results qr
            JOIN meta.quality_rules qru ON qru.check_id = qr.check_id AND qru.installation_id = qr.installation_id
           WHERE qr.run_id = r.run_id) AS dq_count
       FROM meta.runs r
       JOIN meta.jobs j USING (job_id)
       WHERE r.installation_id = $1
         AND r.run_date BETWEEN $2::date AND $3::date
         ${filters}
       ORDER BY r.started_at DESC
       LIMIT $${limitIdx}`,
      values
    );

    const rows = result.rows;
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1]?.started_at : null;

    const response = NextResponse.json({ data, source: "insights-saas", next_cursor: nextCursor ?? null });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    console.error("[GET /api/runs]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
