/**
 * GET /api/v1/admin/installations
 * List all installations with health snapshot
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, getRequestMetadata } from "@/lib/admin-auth";
import { getPgPool } from "@/lib/insights-saas-db";

export async function GET(request: NextRequest) {
  try {
    const adminResult = await requireAdminSession(request);
    if (adminResult.error) {
      return NextResponse.json({ error: adminResult.message }, { status: adminResult.status });
    }
    const session = adminResult.session;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pool = getPgPool();
    const url = new URL(request.url);
    const skip = parseInt(url.searchParams.get("skip") ?? "0", 10);
    const take = parseInt(url.searchParams.get("take") ?? "50", 10);
    const statusFilter = url.searchParams.get("status");

    let query = `
      WITH latest_health AS (
        SELECT DISTINCT ON (h.installation_id)
          h.installation_id,
          h.status,
          h.message_count_24h,
          h.error_rate_pct
        FROM insights_installation_health h
        ORDER BY h.installation_id, h.created_at DESC, h.id DESC
      ),
      run_metrics AS (
        SELECT
          r.installation_id,
          COUNT(*) FILTER (WHERE r.started_at >= NOW() - INTERVAL '24 hours')::int AS runs_24h,
          COUNT(*)::int AS runs_total,
          COUNT(*) FILTER (WHERE r.status IN ('FAILED', 'WARNING', 'RUNNING'))::int AS runs_non_success
        FROM meta.runs r
        GROUP BY r.installation_id
      ),
      dq_metrics AS (
        SELECT
          q.installation_id,
          COUNT(*) FILTER (WHERE q.executed_at >= NOW() - INTERVAL '24 hours')::int AS dq_24h,
          COUNT(*)::int AS dq_total,
          COUNT(*) FILTER (WHERE q.status IN ('FAILED', 'WARNING'))::int AS dq_non_success
        FROM meta.quality_results q
        GROUP BY q.installation_id
      ),
      dataset_metrics AS (
        SELECT d.installation_id, COUNT(*)::int AS datasets_total
        FROM meta.datasets d
        GROUP BY d.installation_id
      ),
      user_counts AS (
        SELECT ui.installation_id, COUNT(DISTINCT ui.user_id)::int AS user_count
        FROM insights_user_installations ui
        GROUP BY ui.installation_id
      )
      SELECT
        i.installation_id,
        i.label,
        i.environment,
        i.tier,
        i.contact_email,
        i.active,
        CASE
          WHEN i.active = FALSE THEN 'inactive'
          WHEN lh.status IN ('connected', 'healthy') THEN 'connected'
          WHEN lh.status IN ('degraded', 'offline') THEN lh.status
          WHEN COALESCE(rm.runs_total, 0) > 0 OR COALESCE(dq.dq_total, 0) > 0 OR COALESCE(dm.datasets_total, 0) > 0 THEN 'connected'
          ELSE 'unknown'
        END as status,
        CASE
          WHEN lh.installation_id IS NOT NULL THEN COALESCE(lh.message_count_24h, 0)
          ELSE COALESCE(rm.runs_24h, 0) + COALESCE(dq.dq_24h, 0)
        END as message_count_24h,
        CASE
          WHEN lh.installation_id IS NOT NULL THEN COALESCE(lh.error_rate_pct, 0)
          WHEN COALESCE(rm.runs_total, 0) + COALESCE(dq.dq_total, 0) > 0 THEN
            ROUND(
              (
                (COALESCE(rm.runs_non_success, 0) + COALESCE(dq.dq_non_success, 0))::numeric
                / NULLIF((COALESCE(rm.runs_total, 0) + COALESCE(dq.dq_total, 0))::numeric, 0)
              ) * 100,
              2
            )
          ELSE 0
        END as error_rate_pct,
        i.last_synced_at,
        COALESCE(uc.user_count, 0) as user_count
      FROM insights_installations i
      LEFT JOIN latest_health lh ON lh.installation_id = i.installation_id
      LEFT JOIN run_metrics rm ON rm.installation_id = i.installation_id
      LEFT JOIN dq_metrics dq ON dq.installation_id = i.installation_id
      LEFT JOIN dataset_metrics dm ON dm.installation_id = i.installation_id
      LEFT JOIN user_counts uc ON uc.installation_id = i.installation_id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (statusFilter) {
      query += ` AND (
        CASE
          WHEN i.active = FALSE THEN 'inactive'
          WHEN lh.status IN ('connected', 'healthy') THEN 'connected'
          WHEN lh.status IN ('degraded', 'offline') THEN lh.status
          WHEN COALESCE(rm.runs_total, 0) > 0 OR COALESCE(dq.dq_total, 0) > 0 OR COALESCE(dm.datasets_total, 0) > 0 THEN 'connected'
          ELSE 'unknown'
        END
      ) = $${params.length + 1}`;
      params.push(statusFilter);
    }

    query += ` ORDER BY i.installation_id
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(take, skip);

    const result = await pool.query(query, params);

    const installations = result.rows.map((row) => ({
      ...row,
      message_count_24h: Number(row.message_count_24h ?? 0),
      error_rate_pct: Number(row.error_rate_pct ?? 0),
      user_count: Number(row.user_count ?? 0),
    }));

    return NextResponse.json({
      installations,
      count: installations.length,
    });
  } catch (error) {
    console.error("[admin] GET /api/v1/admin/installations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/admin/installations
 * Create new installation
 */
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdminSession(request);
    if (adminResult.error) {
      return NextResponse.json({ error: adminResult.message }, { status: adminResult.status });
    }
    const session = adminResult.session;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const label = String(body.label ?? "").trim();
    const environment = String(body.environment ?? "prod").trim() || "prod";
    const tier = String(body.tier ?? "pro").trim() || "pro";
    const contact_email = String(body.contact_email ?? "").trim();

    if (!label) {
      return NextResponse.json(
        { error: "label is required" },
        { status: 400 },
      );
    }

    const pool = getPgPool();

    // Generate installation
    const installationId = `${environment}_${Math.random().toString(36).substr(2, 9)}`;
    const apiKey = `sk_live_${Math.random().toString(36).substr(2, 32)}`;
    const tokenHash = require("crypto").createHash("sha256").update(apiKey).digest("hex");

    const result = await pool.query(
      `INSERT INTO insights_installations (installation_id, label, environment, tier, contact_email, token_hash)
       VALUES ($1, $2, $3, $4, $5, crypt($6, gen_salt('bf')))
       RETURNING installation_id, label, environment, tier, contact_email`,
      [installationId, label, environment, tier, contact_email || null, apiKey],
    );

    const { ip, userAgent } = getRequestMetadata(request);

    // Log admin action
    await (await import("@/lib/session-auth")).logAdminAction(
      session.user_id,
      "CREATE_INSTALLATION",
      "installation",
      installationId,
      { label, environment, tier },
      ip,
      userAgent,
    );

    return NextResponse.json(
      {
        ...result.rows[0],
        api_key: apiKey,
        message: "Installation created. Save the API key now — it will not be shown again.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[admin] POST /api/v1/admin/installations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
