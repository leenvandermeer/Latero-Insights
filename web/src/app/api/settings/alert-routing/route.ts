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
 * GET /api/settings/alert-routing
 * Routing rules ophalen.
 */
export async function GET(request: NextRequest) {
  const { allowed } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPgPool();
  const result = await pool.query(
    `SELECT * FROM meta.alert_routing_rules
     WHERE installation_id = $1
     ORDER BY priority ASC`,
    [installationId]
  );

  return NextResponse.json({ data: result.rows });
}

/**
 * PUT /api/settings/alert-routing
 * Volledige set routing rules opslaan (upsert per id).
 */
export async function PUT(request: NextRequest) {
  const { allowed } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rules = body["rules"];
  if (!Array.isArray(rules)) {
    return NextResponse.json({ error: "rules must be an array" }, { status: 400 });
  }

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Delete rules not in the new set
    const ids = rules.map((r: Record<string, unknown>) => r["id"]).filter(Boolean);
    if (ids.length > 0) {
      await client.query(
        `DELETE FROM meta.alert_routing_rules
         WHERE installation_id = $1 AND id != ALL($2::text[])`,
        [installationId, ids]
      );
    } else {
      await client.query(
        `DELETE FROM meta.alert_routing_rules WHERE installation_id = $1`,
        [installationId]
      );
    }
    // Upsert each rule
    for (const rule of rules as Array<Record<string, unknown>>) {
      await client.query(
        `INSERT INTO meta.alert_routing_rules (id, installation_id, name, conditions, actions, priority, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           conditions = EXCLUDED.conditions,
           actions = EXCLUDED.actions,
           priority = EXCLUDED.priority,
           active = EXCLUDED.active`,
        [
          rule["id"] ?? crypto.randomUUID(),
          installationId,
          rule["name"] ?? "",
          JSON.stringify(rule["conditions"] ?? {}),
          JSON.stringify(rule["actions"] ?? {}),
          Number(rule["priority"] ?? 0),
          rule["active"] !== false,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[PUT /api/settings/alert-routing]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({ ok: true });
}
