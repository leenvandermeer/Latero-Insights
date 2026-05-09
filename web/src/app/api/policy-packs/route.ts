import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
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

/** GET /api/policy-packs — all packs for the active installation */
export async function GET(request: NextRequest) {
  const { allowed, remaining } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPgPool();
  try {
    const result = await pool.query(
      `SELECT * FROM meta.policy_packs WHERE installation_id = $1 ORDER BY name`,
      [installationId]
    );
    const response = NextResponse.json({ data: result.rows });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    console.error("[GET /api/policy-packs]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/policy-packs — create a new pack */
export async function POST(request: NextRequest) {
  const { allowed } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name as string | undefined)?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const framework = (body.framework as string | undefined)?.trim() || null;
  const description = (body.description as string | undefined)?.trim() || null;
  const id = randomUUID();

  const pool = getPgPool();
  try {
    const result = await pool.query(
      `INSERT INTO meta.policy_packs (id, installation_id, name, description, framework)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, installationId, name, description, framework]
    );
    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/policy-packs]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
