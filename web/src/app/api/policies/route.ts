import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";
import { randomUUID } from "crypto";

const VALID_ACTIONS = new Set(["warn", "block", "notify"]);

function ip(r: NextRequest) {
  return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function resolveInstallation(request: NextRequest): Promise<string> {
  const session = await requireSession(request);
  return session.active_installation_id as string;
}

/**
 * GET /api/policies
 * Retourneert alle policies per installatie, gegroepeerd per pack.
 */
export async function GET(request: NextRequest) {
  const { allowed, remaining } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPgPool();
  try {
    const [policiesRes, packsRes] = await Promise.all([
      pool.query(
        `SELECT p.*,
                COUNT(v.id) FILTER (WHERE v.verdict = 'fail')::int AS fail_count,
                COUNT(v.id) FILTER (WHERE v.verdict = 'pass')::int AS pass_count,
                MAX(v.evaluated_at) AS last_evaluated_at
         FROM meta.policies p
         LEFT JOIN meta.policy_verdicts v ON v.installation_id = p.installation_id AND v.policy_id = p.id
           AND v.evaluated_at = (
             SELECT MAX(v2.evaluated_at) FROM meta.policy_verdicts v2
             WHERE v2.installation_id = p.installation_id AND v2.policy_id = p.id
           )
         WHERE p.installation_id = $1
         GROUP BY p.installation_id, p.id
         ORDER BY p.pack_id, p.name`,
        [installationId]
      ),
      pool.query(
        `SELECT * FROM meta.policy_packs WHERE installation_id = $1 ORDER BY name`,
        [installationId]
      ),
    ]);

    const response = NextResponse.json({ data: { policies: policiesRes.rows, packs: packsRes.rows } });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    console.error("[GET /api/policies]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/policies
 * Body: { name, rule, scope, action, pack_id?, description?, active? }
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

  const { name, rule, scope, action, pack_id, description, active } = body as {
    name?: string; rule?: unknown; scope?: unknown; action?: string;
    pack_id?: string; description?: string; active?: boolean;
  };

  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!rule || typeof rule !== "object") return NextResponse.json({ error: "rule must be an object" }, { status: 400 });
  if (!action || !VALID_ACTIONS.has(action)) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const pool = getPgPool();
  try {
    const id = randomUUID();
    const result = await pool.query(
      `INSERT INTO meta.policies (id, installation_id, pack_id, name, description, rule, scope, action, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id, installationId, pack_id ?? null, name.trim(),
        description?.trim() ?? null,
        JSON.stringify(rule),
        scope ? JSON.stringify(scope) : '{"all":true}',
        action,
        active !== false,
      ]
    );
    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/policies]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
