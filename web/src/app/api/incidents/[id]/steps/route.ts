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
 * POST /api/incidents/[id]/steps
 * Markeer een stap als voltooid of voeg een nieuwe stap toe.
 * Body: { label?, step_id?, completed_by? }
 * - Zonder step_id: voegt nieuwe stap toe en markeert hem direct als voltooid
 * - Met step_id: markeert bestaande stap als voltooid
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

  const { label, step_id, completed_by } = body as {
    label?: string; step_id?: number; completed_by?: string;
  };

  const pool = getPgPool();
  try {
    // Verify incident belongs to this installation
    const exists = await pool.query(
      `SELECT 1 FROM meta.incidents WHERE installation_id = $1 AND id = $2`,
      [installationId, numId]
    );
    if (exists.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let result;
    if (step_id) {
      // Mark existing step complete
      result = await pool.query(
        `UPDATE meta.incident_steps
         SET completed_at = COALESCE(completed_at, now()),
             completed_by = COALESCE(completed_by, $2)
         WHERE incident_id = $1 AND id = $3
         RETURNING *`,
        [numId, completed_by ?? null, step_id]
      );
      if (result.rows.length === 0) return NextResponse.json({ error: "Step not found" }, { status: 404 });
    } else {
      if (!label?.trim()) return NextResponse.json({ error: "label is required for new steps" }, { status: 400 });
      result = await pool.query(
        `INSERT INTO meta.incident_steps (incident_id, label, completed_at, completed_by)
         VALUES ($1, $2, now(), $3)
         RETURNING *`,
        [numId, label.trim(), completed_by ?? null]
      );
    }

    return NextResponse.json({ data: result.rows[0] }, { status: step_id ? 200 : 201 });
  } catch (err) {
    console.error("[POST /api/incidents/[id]/steps]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
