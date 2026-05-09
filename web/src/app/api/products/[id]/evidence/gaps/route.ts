import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { getEvidenceGaps } from "@/lib/evidence-ledger";

function ip(r: NextRequest) {
  return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function resolveInstallation(request: NextRequest): Promise<string> {
  const session = await requireSession(request);
  return session.active_installation_id as string;
}

/**
 * GET /api/products/[id]/evidence/gaps
 * Ontbrekende verplichte evidence types voor dit product.
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

  try {
    const gaps = await getEvidenceGaps(id, installationId);
    return NextResponse.json({ data: gaps });
  } catch (err) {
    console.error("[GET /api/products/[id]/evidence/gaps]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
