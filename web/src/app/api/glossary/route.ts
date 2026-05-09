import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";
import { randomUUID } from "crypto";

function ip(r: NextRequest) {
  return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function resolveInstallation(request: NextRequest): Promise<string> {
  const session = await requireSession(request);
  return session.active_installation_id as string;
}

/**
 * GET /api/glossary
 * Retourneert alle actieve (current) glossarium-termen.
 * Query params: q (naam search)
 */
export async function GET(request: NextRequest) {
  const { allowed, remaining } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q");
  const pool = getPgPool();

  try {
    const values: unknown[] = [installationId];
    let filter = "";
    if (q?.trim()) {
      filter = " AND lower(t.name) LIKE $2";
      values.push(`%${q.trim().toLowerCase()}%`);
    }

    const result = await pool.query(
      `SELECT t.id, t.installation_id, t.name, t.definition, t.owner_team, t.valid_from,
              COUNT(l.dataset_id)::int AS linked_dataset_count
       FROM meta.glossary_terms t
       LEFT JOIN meta.term_dataset_links l
         ON l.installation_id = t.installation_id AND l.term_id = t.id
       WHERE t.installation_id = $1 AND t.valid_to IS NULL${filter}
       GROUP BY t.installation_id, t.id, t.name, t.definition, t.owner_team, t.valid_from
       ORDER BY t.name`,
      values
    );

    const response = NextResponse.json({ data: result.rows });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    console.error("[GET /api/glossary]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/glossary
 * Maakt een nieuwe glossarium-term aan.
 * Body: { name, definition, owner_team? }
 */
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

  const { name, definition, owner_team } = body as {
    name?: string; definition?: string; owner_team?: string;
  };

  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!definition?.trim()) return NextResponse.json({ error: "definition is required" }, { status: 400 });

  const pool = getPgPool();
  try {
    const id = randomUUID();
    const result = await pool.query(
      `INSERT INTO meta.glossary_terms (id, installation_id, name, definition, owner_team)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, installation_id, name, definition, owner_team, valid_from`,
      [id, installationId, name.trim(), definition.trim(), owner_team?.trim() ?? null]
    );
    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/glossary]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
