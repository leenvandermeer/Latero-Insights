import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { rotateInstallationKey } from "@/lib/insights-saas-db";

function verifyAdminToken(request: NextRequest): boolean {
  const adminToken = process.env.INSIGHTS_ADMIN_TOKEN;
  if (!adminToken) return false;
  const header = request.headers.get("authorization") ?? "";
  const [, token] = header.split(" ");
  return token?.trim() === adminToken;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ installation_id: string }> },
) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(`admin:installations-rotate:${clientIp}`);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { installation_id: installationId } = await params;
  if (!installationId) {
    return NextResponse.json({ error: "installation_id is required" }, { status: 400 });
  }

  const rawToken = `sk_live_${randomBytes(24).toString("base64url")}`;
  const rotated = await rotateInstallationKey(installationId, rawToken);
  if (!rotated) {
    return NextResponse.json({ error: "Installation not found" }, { status: 404 });
  }

  return NextResponse.json({
    rotated: true,
    installation_id: installationId,
    api_key: rawToken,
  });
}
