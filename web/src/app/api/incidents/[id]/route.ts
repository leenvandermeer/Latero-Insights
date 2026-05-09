import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";

const VALID_STATUS = new Set(["open", "in_progress", "resolved"]);
const VALID_SEVERITY = new Set(["low", "medium", "high", "critical"]);

function ip(r: NextRequest) {
  return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function resolveInstallation(request: NextRequest): Promise<string> {
  const session = await requireSession(request);
  return session.active_installation_id as string;
}

/**
 * GET /api/incidents/[id]
 * Retourneert incident detail incl. steps en evidence.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const pool = getPgPool();
  try {
    const [incidentRes, stepsRes, evidenceRes] = await Promise.all([
      pool.query(
        `SELECT * FROM meta.incidents WHERE installation_id = $1 AND id = $2`,
        [installationId, numId]
      ),
      pool.query(
        `SELECT * FROM meta.incident_steps WHERE incident_id = $1 ORDER BY id`,
        [numId]
      ),
      pool.query(
        `SELECT * FROM meta.incident_evidence WHERE incident_id = $1 ORDER BY attached_at DESC`,
        [numId]
      ),
    ]);

    if (incidentRes.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        ...incidentRes.rows[0],
        steps: stepsRes.rows,
        evidence: evidenceRes.rows,
      },
    });
  } catch (err) {
    console.error("[GET /api/incidents/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/incidents/[id]
 * Update: status, assignee, severity, title.
 * Zet resolved_at automatisch bij status=resolved.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { status, assignee, severity, title } = body as {
    status?: string; assignee?: string; severity?: string; title?: string;
  };

  if (status && !VALID_STATUS.has(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  if (severity && !VALID_SEVERITY.has(severity)) return NextResponse.json({ error: "Invalid severity" }, { status: 400 });

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const exists = await client.query(
      `SELECT status FROM meta.incidents WHERE installation_id = $1 AND id = $2`,
      [installationId, numId]
    );
    if (exists.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await client.query(
      `UPDATE meta.incidents SET
         status      = COALESCE($3, status),
         assignee    = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE assignee END,
         severity    = COALESCE($5, severity),
         title       = COALESCE($6, title),
         resolved_at = CASE
           WHEN $3 = 'resolved' AND resolved_at IS NULL THEN now()
           WHEN $3 != 'resolved' THEN NULL
           ELSE resolved_at
         END,
         updated_at  = now()
       WHERE installation_id = $1 AND id = $2
       RETURNING *`,
      [installationId, numId, status ?? null, assignee ?? null, severity ?? null, title?.trim() ?? null]
    );

    await client.query("COMMIT");
    return NextResponse.json({ data: result.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[PUT /api/incidents/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    client.release();
  }
}
