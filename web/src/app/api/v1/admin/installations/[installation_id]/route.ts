/**
 * GET/PATCH /api/v1/admin/installations/[installation_id]
 * View and update single installation
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, getRequestMetadata } from "@/lib/admin-auth";
import { getPgPool } from "@/lib/insights-saas-db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ installation_id: string }> },
) {
  try {
    const adminResult = await requireAdminSession(request);
    if (adminResult.error) {
      return NextResponse.json({ error: adminResult.message }, { status: adminResult.status });
    }
    const session = adminResult.session;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { installation_id } = await params;
    const pool = getPgPool();

    const result = await pool.query(
      `SELECT installation_id, label, environment, tier, contact_email, active, created_at, last_synced_at, last_token_used_at
       FROM insights_installations
       WHERE installation_id = $1`,
      [installation_id],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Installation not found" }, { status: 404 });
    }

    // Get recent health metrics
    const healthResult = await pool.query(
      `SELECT status, message_count_24h, error_rate_pct, postgres_latency_ms, api_response_time_p95_ms, cache_hit_ratio, created_at
       FROM insights_installation_health
       WHERE installation_id = $1
       ORDER BY created_at DESC
       LIMIT 24`,
      [installation_id],
    );

    return NextResponse.json({
      installation: result.rows[0],
      health_timeline: healthResult.rows,
    });
  } catch (error) {
    console.error("[admin] GET /api/v1/admin/installations/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ installation_id: string }> },
) {
  try {
    const adminResult = await requireAdminSession(request);
    if (adminResult.error) {
      return NextResponse.json({ error: adminResult.message }, { status: adminResult.status });
    }
    const session = adminResult.session;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { installation_id } = await params;
    const body = await request.json();
    const { label, environment, tier, contact_email, active } = body;

    const pool = getPgPool();

    // Build dynamic update
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (label !== undefined) {
      updates.push(`label = $${paramCount}`);
      values.push(label);
      paramCount++;
    }

    if (environment !== undefined) {
      updates.push(`environment = $${paramCount}`);
      values.push(environment);
      paramCount++;
    }

    if (tier !== undefined) {
      updates.push(`tier = $${paramCount}`);
      values.push(tier);
      paramCount++;
    }

    if (contact_email !== undefined) {
      updates.push(`contact_email = $${paramCount}`);
      values.push(contact_email);
      paramCount++;
    }

    if (active !== undefined) {
      updates.push(`active = $${paramCount}`);
      values.push(active);
      paramCount++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    updates.push(`updated_at = NOW()`);
    values.push(installation_id);

    const result = await pool.query(
      `UPDATE insights_installations
       SET ${updates.join(", ")}
       WHERE installation_id = $${paramCount}
       RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Installation not found" }, { status: 404 });
    }

    const { ip, userAgent } = getRequestMetadata(request);

    // Log admin action
    await (await import("@/lib/session-auth")).logAdminAction(
      session.user_id,
      "UPDATE_INSTALLATION",
      "installation",
      installation_id,
      body,
      ip,
      userAgent,
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("[admin] PATCH /api/v1/admin/installations/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
