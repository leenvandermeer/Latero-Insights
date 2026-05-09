import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getPgPool } from "@/lib/insights-saas-db";

const VALID_ACTIONS = new Set(["warn", "block", "notify"]);

function ip(r: NextRequest) {
  return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function resolveInstallation(request: NextRequest): Promise<string> {
  const session = await requireSession(request);
  return session.active_installation_id as string;
}

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
  const pool = getPgPool();
  try {
    const result = await pool.query(
      `SELECT p.*,
              COALESCE(json_agg(
                json_build_object('verdict', v.verdict, 'product_id', v.product_id,
                  'detail', v.detail, 'evaluated_at', v.evaluated_at)
                ORDER BY v.evaluated_at DESC
              ) FILTER (WHERE v.id IS NOT NULL), '[]') AS latest_verdicts
       FROM meta.policies p
       LEFT JOIN meta.policy_verdicts v ON v.installation_id = p.installation_id AND v.policy_id = p.id
         AND v.evaluated_at >= now() - INTERVAL '24 hours'
       WHERE p.installation_id = $1 AND p.id = $2
       GROUP BY p.installation_id, p.id`,
      [installationId, id]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: result.rows[0] });
  } catch (err) {
    console.error("[GET /api/policies/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, rule, scope, action, description, active, pack_id } = body as {
    name?: string; rule?: unknown; scope?: unknown; action?: string;
    description?: string; active?: boolean; pack_id?: string | null;
  };

  if (action && !VALID_ACTIONS.has(action)) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const pool = getPgPool();
  try {
    const result = await pool.query(
      `UPDATE meta.policies SET
         name        = COALESCE($3, name),
         description = CASE WHEN $4::text IS NULL THEN description ELSE $4 END,
         rule        = CASE WHEN $5::text IS NULL THEN rule ELSE $5::jsonb END,
         scope       = CASE WHEN $6::text IS NULL THEN scope ELSE $6::jsonb END,
         action      = COALESCE($7, action),
         active      = COALESCE($8, active),
         pack_id     = CASE WHEN $9::text IS NULL THEN pack_id ELSE $9 END
       WHERE installation_id = $1 AND id = $2
       RETURNING *`,
      [
        installationId, id,
        name?.trim() ?? null,
        description ?? null,
        rule ? JSON.stringify(rule) : null,
        scope ? JSON.stringify(scope) : null,
        action ?? null,
        active ?? null,
        pack_id ?? null,
      ]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: result.rows[0] });
  } catch (err) {
    console.error("[PUT /api/policies/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
