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
 * GET /api/glossary/conflicts
 * Detecteert termen met hetzelfde (case-insensitive) naam maar verschillende definities.
 * Retourneert groepen conflicterende termen.
 */
export async function GET(request: NextRequest) {
  const { allowed } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPgPool();
  try {
    const result = await pool.query(
      `WITH duplicates AS (
         SELECT lower(name) AS normalized_name
         FROM meta.glossary_terms
         WHERE installation_id = $1 AND valid_to IS NULL
         GROUP BY lower(name)
         HAVING COUNT(DISTINCT definition) > 1
       )
       SELECT t.id, t.name, t.definition, t.owner_team, t.valid_from
       FROM meta.glossary_terms t
       JOIN duplicates d ON lower(t.name) = d.normalized_name
       WHERE t.installation_id = $1 AND t.valid_to IS NULL
       ORDER BY lower(t.name), t.id`,
      [installationId]
    );

    // Group by normalized name
    const groups: Record<string, typeof result.rows> = {};
    for (const row of result.rows) {
      const key = row.name.toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }

    const conflicts = Object.entries(groups).map(([normalized_name, terms]) => ({
      normalized_name,
      terms,
    }));

    return NextResponse.json({ data: conflicts });
  } catch (err) {
    console.error("[GET /api/glossary/conflicts]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
