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
 * POST /api/products/[id]/contract-requests
 * Dient een contract-aanvraag in.
 * Body: { consumer_id, requirements: object }
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

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { consumer_id, requirements } = body as { consumer_id?: string; requirements?: unknown };

  if (!consumer_id?.trim()) return NextResponse.json({ error: "consumer_id is required" }, { status: 400 });
  if (!requirements || typeof requirements !== "object")
    return NextResponse.json({ error: "requirements must be an object" }, { status: 400 });

  const pool = getPgPool();
  try {
    const result = await pool.query(
      `INSERT INTO meta.contract_requests (installation_id, product_id, consumer_id, requirements)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [installationId, id, consumer_id.trim(), JSON.stringify(requirements)]
    );
    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/products/[id]/contract-requests]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
