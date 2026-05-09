import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getTrustScoreHistory } from "@/lib/trust-score";

function ip(r: NextRequest) {
  return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function resolveInstallation(request: NextRequest): Promise<string> {
  const session = await requireSession(request);
  return session.active_installation_id as string;
}

/**
 * GET /api/products/[id]/trust/history
 * Retourneert de laatste 90 snapshots (score + tijdstip).
 * Query param: ?limit=N
 */
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
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 365) : 90;

  try {
    const history = await getTrustScoreHistory(id, installationId, isNaN(limit) ? 90 : limit);
    return NextResponse.json({ data: history });
  } catch (err) {
    console.error("[GET /api/products/[id]/trust/history]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
