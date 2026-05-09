import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { appendEvidence, getEvidenceRecords } from "@/lib/evidence-ledger";

const VALID_EVENT_TYPES = new Set([
  "quality_check", "transformation", "source_snapshot", "approval", "exception", "incident_resolved",
]);

function ip(r: NextRequest) {
  return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function resolveInstallation(request: NextRequest): Promise<string> {
  const session = await requireSession(request);
  return session.active_installation_id as string;
}

/**
 * GET /api/products/[id]/evidence
 * Gepagineerde evidence trail (nieuwste eerst).
 * Query params: event_type, page, page_size
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed, remaining } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const p = request.nextUrl.searchParams;
  const event_type = p.get("event_type");
  const page = parseInt(p.get("page") ?? "1", 10) || 1;
  const page_size = Math.min(parseInt(p.get("page_size") ?? "50", 10) || 50, 200);

  try {
    const { records, total } = await getEvidenceRecords({
      installationId,
      productId: id,
      event_type: event_type && VALID_EVENT_TYPES.has(event_type) ? event_type as never : undefined,
      page,
      pageSize: page_size,
    });

    const response = NextResponse.json({ data: records, meta: { total, page, page_size } });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    console.error("[GET /api/products/[id]/evidence]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/products/[id]/evidence
 * Handmatig evidence record toevoegen (voor approvals).
 * Body: { event_type, payload, run_id? }
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

  const { event_type, payload, run_id } = body as {
    event_type?: string; payload?: Record<string, unknown>; run_id?: string;
  };

  if (!event_type || !VALID_EVENT_TYPES.has(event_type))
    return NextResponse.json({ error: "Invalid event_type" }, { status: 400 });
  if (!payload || typeof payload !== "object")
    return NextResponse.json({ error: "payload must be an object" }, { status: 400 });

  try {
    const record = await appendEvidence({
      installationId,
      productId: id,
      event_type: event_type as never,
      payload,
      run_id: run_id?.trim(),
    });
    return NextResponse.json({ data: record }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/products/[id]/evidence]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
