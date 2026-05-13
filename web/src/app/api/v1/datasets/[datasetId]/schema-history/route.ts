import { NextRequest, NextResponse } from "next/server";
import { getPgPool } from "@/lib/insights-saas-db";
import { requireSession } from "@/lib/session-auth";

/**
 * GET /api/v1/datasets/[datasetId]/schema-history
 *
 * Returns schema change history for a dataset.
 * Supports layer-scoped queries and time-based filtering.
 *
 * Query params:
 *   - layer?: string — filter by layer (silver, gold, etc.)
 *   - limit?: number — max snapshots (default 50, max 200)
 *   - from?: ISO8601 — snapshots captured after this date
 *   - to?: ISO8601 — snapshots captured before this date
 *
 * Response: { snapshots: SnapshotRow[] }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { datasetId: string } }
) {
  try {
    const session = await requireSession(req);
    const installationId = session.active_installation_id;

    if (!installationId) {
      return NextResponse.json({ error: "No active installation" }, { status: 400 });
    }

    const url = new URL(req.url);
    const layer = url.searchParams.get("layer") || null;
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
    const fromDate = url.searchParams.get("from") || null;
    const toDate = url.searchParams.get("to") || null;

    const pool = getPgPool();

    // Query schema history with optional filters
    let query = `
      SELECT
        snapshot_id,
        dataset_id,
        installation_id,
        layer,
        object_name,
        column_count,
        platform,
        captured_at,
        captured_by,
        payload
      FROM meta.dataset_snapshots
      WHERE installation_id = $1
        AND dataset_id = $2
    `;

    const params_: any[] = [installationId, params.datasetId];

    if (layer) {
      query += ` AND layer = $${params_.length + 1}`;
      params_.push(layer);
    }

    if (fromDate) {
      query += ` AND captured_at >= $${params_.length + 1}`;
      params_.push(new Date(fromDate).toISOString());
    }

    if (toDate) {
      query += ` AND captured_at <= $${params_.length + 1}`;
      params_.push(new Date(toDate).toISOString());
    }

    query += ` ORDER BY captured_at DESC LIMIT $${params_.length + 1}`;
    params_.push(limit);

    const result = await pool.query(query, params_);

    return NextResponse.json({
      dataset_id: params.datasetId,
      installation_id: installationId,
      layer: layer || null,
      snapshots: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    console.error("Error fetching schema history:", err);
    return NextResponse.json(
      { error: "Failed to fetch schema history" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/datasets/[datasetId]/schema-history (manual snapshot)
 *
 * Manually trigger a snapshot capture for audit purposes.
 * Body: { captured_by: string } — reason for manual snapshot
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { datasetId: string } }
) {
  try {
    const session = await requireSession(req);
    const installationId = session.active_installation_id;

    if (!installationId) {
      return NextResponse.json({ error: "No active installation" }, { status: 400 });
    }

    const body = await req.json();
    const capturedBy = body.captured_by || "api";

    const pool = getPgPool();

    // Get current dataset state
    const datasetRes = await pool.query(
      `SELECT object_name, platform FROM meta.datasets
       WHERE installation_id = $1 AND dataset_id = $2`,
      [installationId, params.datasetId]
    );

    if (datasetRes.rows.length === 0) {
      return NextResponse.json(
        { error: "Dataset not found" },
        { status: 404 }
      );
    }

    const dataset = datasetRes.rows[0];

    // Insert snapshot
    const snapshotRes = await pool.query(
      `INSERT INTO meta.dataset_snapshots
       (dataset_id, installation_id, layer, object_name, platform, captured_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING snapshot_id, captured_at`,
      [
        params.datasetId,
        installationId,
        "unknown", // Layer not specified for manual capture
        dataset.object_name,
        dataset.platform,
        capturedBy,
      ]
    );

    return NextResponse.json(
      {
        snapshot_id: snapshotRes.rows[0].snapshot_id,
        captured_at: snapshotRes.rows[0].captured_at,
        message: "Schema snapshot captured",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error creating schema snapshot:", err);
    return NextResponse.json(
      { error: "Failed to create snapshot" },
      { status: 500 }
    );
  }
}
