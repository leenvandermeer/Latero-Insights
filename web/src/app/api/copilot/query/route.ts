import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session-auth";
import { parseIntent, executeIntent } from "@/lib/copilot-intents";

function ip(r: NextRequest) {
  return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function resolveInstallation(request: NextRequest): Promise<string> {
  const session = await requireSession(request);
  return session.active_installation_id as string;
}

/**
 * POST /api/copilot/query
 * Accepts { query: string }, returns { answer, citations, navigation_links }.
 * Classification is rule-based; no raw data is sent to any LLM.
 */
export async function POST(request: NextRequest) {
  const { allowed, remaining } = rateLimit(ip(request));
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let installationId: string;
  try { installationId = await resolveInstallation(request); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const query = body["query"];
  if (typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  if (query.length > 1000) {
    return NextResponse.json({ error: "query too long" }, { status: 400 });
  }

  try {
    const intent = parseIntent(query);
    const result = await executeIntent(intent, installationId);

    const response = NextResponse.json({
      data: {
        ...result,
        intent_type: intent.type,
        confidence: intent.confidence,
      },
    });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    console.error("[POST /api/copilot/query]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
