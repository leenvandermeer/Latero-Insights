import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ result_id: string }> }
) {
  let session;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { result_id } = await params;
  if (!result_id) {
    return NextResponse.json({ error: "Missing result_id" }, { status: 400 });
  }

  const pool = getPgPool();
  const result = await pool.query(
    `
    SELECT
      qr.result_id::text,
      qr.check_id,
      COALESCE(qru.check_name, qr.check_id)   AS check_name,
      qr.status                                AS check_status,
      qru.check_category,
      qru.severity,
      qru.check_mode,
      qru.policy_version,
      COALESCE(qru.dataset_id, qr.check_id)   AS dataset_id,
      qr.result_value,
      qr.threshold_value,
      qr.message,
      qr.check_result,
      qr.executed_at                           AS timestamp_utc,
      '' AS step,
      COALESCE(r.external_run_id, qr.run_id::text, '') AS run_id,
      r.run_id::text                           AS internal_run_id
    FROM meta.quality_results qr
    JOIN meta.quality_rules qru
      ON qru.installation_id = qr.installation_id
     AND qru.check_id        = qr.check_id
    LEFT JOIN meta.runs r ON r.run_id = qr.run_id
    WHERE qr.result_id = $1
      AND qr.installation_id = $2
    LIMIT 1
    `,
    [result_id, session.active_installation_id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: result.rows[0] });
}
