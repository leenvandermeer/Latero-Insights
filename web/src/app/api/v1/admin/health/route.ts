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
    // Fallback to the real meta.* activity model when no snapshot is available.
    const result = await pool.query(`
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
      resolved AS (
        SELECT
          i.installation_id,
          i.active,
          CASE
            WHEN i.active = FALSE THEN 'inactive'
            WHEN lh.status IN ('connected', 'healthy') THEN 'connected'
            WHEN lh.status IN ('degraded', 'offline') THEN lh.status
            WHEN COALESCE(rm.runs_total, 0) > 0 OR COALESCE(dq.dq_total, 0) > 0 OR COALESCE(dm.datasets_total, 0) > 0 THEN 'connected'
            ELSE 'unknown'
          END AS resolved_status,
          CASE
            WHEN lh.installation_id IS NOT NULL THEN COALESCE(lh.message_count_24h, 0)
            ELSE COALESCE(rm.runs_24h, 0) + COALESCE(dq.dq_24h, 0)
          END AS resolved_messages_24h,
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
          END AS resolved_error_rate
        FROM insights_installations i
        LEFT JOIN latest_health lh ON lh.installation_id = i.installation_id
        LEFT JOIN run_metrics rm ON rm.installation_id = i.installation_id
        LEFT JOIN dq_metrics dq ON dq.installation_id = i.installation_id
        LEFT JOIN dataset_metrics dm ON dm.installation_id = i.installation_id
      )
      SELECT
        COUNT(*)::int as total_installations,
        COUNT(*) FILTER (WHERE active = true)::int as active_installations,
        COUNT(*) FILTER (WHERE active = false)::int as inactive_installations,
        COUNT(*) FILTER (WHERE active = true AND resolved_status = 'connected')::int as connected,
        COUNT(*) FILTER (WHERE active = true AND resolved_status = 'degraded')::int as degraded,
        COUNT(*) FILTER (WHERE active = true AND resolved_status = 'offline')::int as offline,
        COUNT(*) FILTER (WHERE active = true AND resolved_status = 'unknown')::int as unknown,
        COALESCE(SUM(resolved_messages_24h) FILTER (WHERE active = true), 0)::int as total_messages_24h,
        COALESCE(AVG(resolved_error_rate) FILTER (WHERE active = true), 0)::numeric as avg_error_rate
      FROM resolved
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
