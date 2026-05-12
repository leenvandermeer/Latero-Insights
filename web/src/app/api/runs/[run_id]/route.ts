import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ run_id: string }> }
) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(clientIp);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string | null = null;
  try {
    const session = await requireSession(request);
    installationId = session.active_installation_id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { run_id } = await params;
  if (!run_id) return NextResponse.json({ error: "Missing run_id" }, { status: 400 });

  const pool = getPgPool();
  try {
    // Run + job
    const runRes = await pool.query(
      `SELECT r.run_id, r.external_run_id, j.job_name, j.dataset_id,
              r.status, r.environment,
              r.started_at, r.ended_at, r.duration_ms, r.parent_run_id, r.run_facets
       FROM meta.runs r
       JOIN meta.jobs j USING (job_id)
       WHERE r.run_id = $1 AND r.installation_id = $2`,
      [run_id, installationId]
    );
    if (runRes.rows.length === 0) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    const run = runRes.rows[0];

    // I/O datasets
    const ioRes = await pool.query(
      `SELECT io.dataset_id,
              COALESCE(
                NULLIF(CONCAT_WS('.', NULLIF(d.namespace, ''), NULLIF(d.object_name, '')), ''),
                NULLIF(d.dataset_name, ''),
                d.dataset_id,
                io.dataset_id
              ) AS entity_fqn,
              COALESCE(io.layer, d.layer) AS layer,
              io.role,
              io.observed_at
       FROM meta.run_io io
       LEFT JOIN meta.datasets d
         ON d.installation_id = io.installation_id AND d.dataset_id = io.dataset_id
       WHERE io.run_id = $1 AND io.installation_id = $2
       ORDER BY io.role, io.observed_at`,
      [run_id, installationId]
    );

    // DQ checks
    const dqRes = await pool.query(
      `SELECT qr.check_id, qru.check_name, qru.check_category, qru.severity,
              qr.status, qr.check_result, qr.executed_at
       FROM meta.quality_results qr
       JOIN meta.quality_rules qru
         ON qru.check_id = qr.check_id AND qru.installation_id = qr.installation_id
       WHERE qr.run_id = $1 AND qr.installation_id = $2
       ORDER BY qr.executed_at`,
      [run_id, installationId]
    );

    // Lineage edges observed in this run
    const edgesRes = await pool.query(
      `SELECT e.source_dataset_id, e.target_dataset_id,
              COALESCE(
                NULLIF(CONCAT_WS('.', NULLIF(src.namespace, ''), NULLIF(src.object_name, '')), ''),
                NULLIF(src.dataset_name, ''),
                src.dataset_id,
                e.source_dataset_id
              ) AS source_fqn,
              COALESCE(
                NULLIF(CONCAT_WS('.', NULLIF(tgt.namespace, ''), NULLIF(tgt.object_name, '')), ''),
                NULLIF(tgt.dataset_name, ''),
                tgt.dataset_id,
                e.target_dataset_id
              ) AS target_fqn,
              e.observation_count
       FROM meta.lineage_edges e
       LEFT JOIN meta.datasets src
         ON src.installation_id = e.installation_id AND src.dataset_id = e.source_dataset_id
       LEFT JOIN meta.datasets tgt
         ON tgt.installation_id = e.installation_id AND tgt.dataset_id = e.target_dataset_id
       WHERE e.last_observed_run = $1 AND e.installation_id = $2`,
      [run_id, installationId]
    );

    // Child runs
    const childrenRes = await pool.query(
      `SELECT r.run_id, r.external_run_id, j.job_name, j.dataset_id,
              r.status, r.started_at, r.ended_at, r.duration_ms
       FROM meta.runs r
       JOIN meta.jobs j USING (job_id)
       WHERE r.parent_run_id = $1 AND r.installation_id = $2
       ORDER BY r.started_at`,
      [run_id, installationId]
    );

    return NextResponse.json({
      data: {
        ...run,
        io_datasets: ioRes.rows,
        dq_checks: dqRes.rows,
        lineage_edges: edgesRes.rows,
        child_runs: childrenRes.rows,
      },
      source: "insights-saas",
    });
  } catch (err) {
    console.error("[GET /api/runs/[run_id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
