import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getBearerToken, getPgPool, verifyInstallationToken } from "@/lib/insights-saas-db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ installation_id: string }> },
) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(`v1:installation-status:${clientIp}`);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } },
    );
  }

  const token = getBearerToken(request);
  if (!token && process.env.INSIGHTS_AUTH_DISABLED !== "true") {
    return NextResponse.json({ error: "Missing Bearer token" }, { status: 401 });
  }

  const { installation_id: installationId } = await params;
  if (!installationId) {
    return NextResponse.json({ error: "installation_id is required" }, { status: 400 });
  }

  if (token) {
    const authorized = await verifyInstallationToken(installationId, token);
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized installation/token" }, { status: 401 });
    }
  }

  const pool = getPgPool();
  const [pipelineRuns, dqChecks, lineageRows] = await Promise.all([
    pool.query(
      "SELECT COUNT(*)::bigint AS count, MAX(timestamp_utc) AS last_event FROM pipeline_runs WHERE installation_id = $1",
      [installationId],
    ),
    pool.query(
      "SELECT COUNT(*)::bigint AS count, MAX(timestamp_utc) AS last_event FROM data_quality_checks WHERE installation_id = $1",
      [installationId],
    ),
    pool.query(
      "SELECT COUNT(*)::bigint AS count, MAX(timestamp_utc) AS last_event FROM data_lineage WHERE installation_id = $1",
      [installationId],
    ),
  ]);

  const response = NextResponse.json({
    installation_id: installationId,
    status: "ok",
    events: {
      pipeline_runs: {
        count: Number(pipelineRuns.rows[0]?.count ?? 0),
        last_event: pipelineRuns.rows[0]?.last_event ?? null,
      },
      dq_checks: {
        count: Number(dqChecks.rows[0]?.count ?? 0),
        last_event: dqChecks.rows[0]?.last_event ?? null,
      },
      lineage: {
        count: Number(lineageRows.rows[0]?.count ?? 0),
        last_event: lineageRows.rows[0]?.last_event ?? null,
      },
    },
    timestamp: new Date().toISOString(),
  });
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}
