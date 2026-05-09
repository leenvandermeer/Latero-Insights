import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { calculateTrustScore, getLatestTrustScore } from "@/lib/trust-score";

function ip(r: NextRequest) {
  return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function resolveInstallation(request: NextRequest): Promise<string> {
  const session = await requireSession(request);
  return session.active_installation_id as string;
}

/**
 * GET /api/products/[id]/trust
 * Retourneert de meest recente Trust Score + factor-breakdown.
 * Query param: ?refresh=true — herberekent en slaat op.
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
  const refresh = request.nextUrl.searchParams.get("refresh") === "true";

  try {
    if (refresh) {
      const result = await calculateTrustScore(id, installationId);
      return NextResponse.json({ data: result });
    }

    const snapshot = await getLatestTrustScore(id, installationId);
    if (!snapshot) {
      // Bereken on-demand als er nog geen snapshot is
      const result = await calculateTrustScore(id, installationId);
      return NextResponse.json({ data: result });
    }

    return NextResponse.json({ data: { product_id: id, installation_id: installationId, ...snapshot } });
  } catch (err) {
    console.error("[GET /api/products/[id]/trust]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
