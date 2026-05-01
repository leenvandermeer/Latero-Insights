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
      SELECT 
        i.installation_id,
        i.label,
        i.environment,
        i.tier,
        i.contact_email,
        i.active,
        CASE
          WHEN i.active = FALSE THEN 'inactive'
          ELSE COALESCE(lh.status, 'unknown')
        END as status,
        COALESCE(lh.message_count_24h, 0) as message_count_24h,
        COALESCE(lh.error_rate_pct, 0) as error_rate_pct,
        i.last_synced_at,
        COUNT(DISTINCT ui.user_id) as user_count
      FROM insights_installations i
      LEFT JOIN LATERAL (
        SELECT status, message_count_24h, error_rate_pct
        FROM insights_installation_health h
        WHERE h.installation_id = i.installation_id
        ORDER BY h.created_at DESC, h.id DESC
        LIMIT 1
      ) lh ON TRUE
      LEFT JOIN insights_user_installations ui ON i.installation_id = ui.installation_id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (statusFilter) {
      query += ` AND (CASE WHEN i.active = FALSE THEN 'inactive' ELSE COALESCE(lh.status, 'unknown') END) = $${params.length + 1}`;
      params.push(statusFilter);
    }

    query += ` GROUP BY i.installation_id, i.label, i.environment, i.tier, i.contact_email, i.active, i.last_synced_at, lh.status, lh.message_count_24h, lh.error_rate_pct LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(take, skip);

    const result = await pool.query(query, params);

    return NextResponse.json({
      installations: result.rows,
      count: result.rows.length,
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
