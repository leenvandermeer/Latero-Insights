import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";

function ip(r: NextRequest) {
  return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function resolveInstallation(request: NextRequest): Promise<string> {
  const session = await requireSession(request);
  return session.active_installation_id as string;
}

/**
 * POST /api/incidents/[id]/evidence
 * Voeg evidence toe aan een incident.
 * Body: { evidence_type: string, payload: object }
 */
export async function POST(
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

  const { evidence_type, payload } = body as {
    evidence_type?: string; payload?: Record<string, unknown>;
  };

  if (!evidence_type?.trim()) return NextResponse.json({ error: "evidence_type is required" }, { status: 400 });
  if (!payload || typeof payload !== "object") return NextResponse.json({ error: "payload must be an object" }, { status: 400 });

  const pool = getPgPool();
  try {
    const exists = await pool.query(
      `SELECT 1 FROM meta.incidents WHERE installation_id = $1 AND id = $2`,
      [installationId, numId]
    );
    if (exists.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const result = await pool.query(
      `INSERT INTO meta.incident_evidence (incident_id, evidence_type, payload)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [numId, evidence_type.trim(), JSON.stringify(payload)]
    );
    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/incidents/[id]/evidence]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
