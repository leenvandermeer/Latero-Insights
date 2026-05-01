import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getBearerToken, getPgPool } from "@/lib/insights-saas-db";
import { noteInstallationTokenUsed } from "@/lib/session-auth";

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(`v1:me:${clientIp}`);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing Bearer token" }, { status: 401 });
  }

  try {
    const pool = getPgPool();

    const result = await pool.query(
      `SELECT installation_id, label, environment, active
       FROM insights_installations
       WHERE crypt($1, token_hash) = token_hash AND active = TRUE
       LIMIT 1`,
      [token],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const row = result.rows[0];
    await noteInstallationTokenUsed(String(row.installation_id));
    const response = NextResponse.json({
      installation_id: row.installation_id,
      label: row.label,
      environment: row.environment,
      active: row.active,
    });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
