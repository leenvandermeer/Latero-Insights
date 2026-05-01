/**
 * GET /api/v1/admin/health
 * System-wide health metrics
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getPgPool } from "@/lib/insights-saas-db";

export async function GET(request: NextRequest) {
  try {
    const adminResult = await requireAdminSession(request);
    if (adminResult.error) {
      return NextResponse.json({ error: adminResult.message }, { status: adminResult.status });
    }

    const pool = getPgPool();

    // Test Postgres connection
    const startTime = Date.now();
    const connTest = await pool.query("SELECT 1");
    const postgresLatency = Date.now() - startTime;

    // Aggregate health metrics from the latest snapshot per installation.
    const result = await pool.query(`
      SELECT
        COUNT(*)::int as total_installations,
        COUNT(*) FILTER (WHERE i.active = true)::int as active_installations,
        COUNT(*) FILTER (WHERE i.active = false)::int as inactive_installations,
        COUNT(*) FILTER (WHERE i.active = true AND lh.status = 'connected')::int as connected,
        COUNT(*) FILTER (WHERE i.active = true AND lh.status = 'degraded')::int as degraded,
        COUNT(*) FILTER (WHERE i.active = true AND lh.status = 'offline')::int as offline,
        COUNT(*) FILTER (WHERE i.active = true AND (lh.status IS NULL OR lh.status = 'unknown'))::int as unknown,
        COALESCE(SUM(COALESCE(lh.message_count_24h, 0)), 0)::int as total_messages_24h,
        COALESCE(AVG(COALESCE(lh.error_rate_pct, 0)), 0)::numeric as avg_error_rate
      FROM insights_installations i
      LEFT JOIN LATERAL (
        SELECT status, message_count_24h, error_rate_pct
        FROM insights_installation_health h
        WHERE h.installation_id = i.installation_id
        ORDER BY h.created_at DESC, h.id DESC
        LIMIT 1
      ) lh ON TRUE
    `);

    const stats = result.rows[0];

    return NextResponse.json({
      total_installations: parseInt(stats.total_installations, 10) || 0,
      active_installations: parseInt(stats.active_installations, 10) || 0,
      inactive_installations: parseInt(stats.inactive_installations, 10) || 0,
      connected: parseInt(stats.connected, 10) || 0,
      degraded: parseInt(stats.degraded, 10) || 0,
      offline: parseInt(stats.offline, 10) || 0,
      unknown: parseInt(stats.unknown, 10) || 0,
      total_messages_24h: parseInt(stats.total_messages_24h, 10) || 0,
      avg_error_rate: parseFloat(stats.avg_error_rate) || 0,
      postgres_connection_ok: connTest.rows.length > 0,
      postgres_latency_ms: postgresLatency,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[admin] GET /api/v1/admin/health:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
