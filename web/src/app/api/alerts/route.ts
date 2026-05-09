import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { listAlerts } from "@/lib/alert-routing";
import { getPgPool } from "@/lib/insights-saas-db";

function ip(r: NextRequest) {
  return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function resolveInstallation(request: NextRequest): Promise<string> {
  const session = await requireSession(request);
  return session.active_installation_id as string;
}

/**
 * GET /api/alerts
 * Alle alerts voor de installatie, inclusief routing trace.
 */
export async function GET(request: NextRequest) {
  const { allowed, remaining } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const p = request.nextUrl.searchParams;
  const status = p.get("status") ?? undefined;
  const severity = p.get("severity") ?? undefined;
  const limit = p.get("limit") ? parseInt(p.get("limit")!, 10) : 50;

  try {
    const alerts = await listAlerts(installationId, { status, severity, limit });
    const res = NextResponse.json({ data: alerts });
    res.headers.set("X-RateLimit-Remaining", String(remaining));
    return res;
  } catch (err) {
    console.error("[GET /api/alerts]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/alerts
 * Handmatig een alert aanmaken (voor testing / ingest).
 */
export async function POST(request: NextRequest) {
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

  const { type, severity = "medium", title, message, source_id, domain, product_id } = body;
  if (!type || !title) {
    return NextResponse.json({ error: "type and title are required" }, { status: 400 });
  }

  const VALID_SEVERITY = new Set(["low", "medium", "high", "critical"]);
  if (!VALID_SEVERITY.has(String(severity))) {
    return NextResponse.json({ error: "Invalid severity" }, { status: 400 });
  }

  const pool = getPgPool();
  try {
    const result = await pool.query(
      `INSERT INTO meta.alerts
         (installation_id, type, severity, title, message, source_id, domain, product_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [installationId, type, severity, title, message ?? null, source_id ?? null, domain ?? null, product_id ?? null]
    );
    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/alerts]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
