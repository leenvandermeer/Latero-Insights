import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { listInstallations } from "@/lib/insights-saas-db";

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(clientIp);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const rows = await listInstallations();
    const response = NextResponse.json({
      installations: rows.map((i) => ({
        installation_id: i.installation_id,
        label: i.label,
        environment: i.environment,
        active: i.active,
      })),
    });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch {
    // Postgres not available (cache-only mode or misconfigured)
    const response = NextResponse.json({ installations: [] });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  }
}
