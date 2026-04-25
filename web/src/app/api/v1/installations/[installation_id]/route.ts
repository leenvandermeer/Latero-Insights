// Admin PATCH and DELETE for a single installation.
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { revokeInstallation, updateInstallation } from "@/lib/insights-saas-db";

function verifyAdminToken(request: NextRequest): boolean {
  const adminToken = process.env.INSIGHTS_ADMIN_TOKEN;
  if (!adminToken) return false;
  const header = request.headers.get("authorization") ?? "";
  const [, token] = header.split(" ");
  return token?.trim() === adminToken;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ installation_id: string }> },
) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(`admin:installations:${clientIp}`);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  if (!verifyAdminToken(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { installation_id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fields: Parameters<typeof updateInstallation>[1] = {};
  if (body.label !== undefined) fields.label = String(body.label).trim();
  if (body.active !== undefined) fields.active = Boolean(body.active);
  if (body.valid_until !== undefined) fields.valid_until = body.valid_until ? String(body.valid_until) : null;
  if (body.subscription_tier !== undefined) fields.subscription_tier = String(body.subscription_tier).trim();

  const updated = await updateInstallation(installation_id, fields);
  if (!updated) {
    return NextResponse.json({ error: "Installation not found" }, { status: 404 });
  }

  return NextResponse.json({ updated: true, installation_id });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ installation_id: string }> },
) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(`admin:installations:${clientIp}`);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  if (!verifyAdminToken(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { installation_id } = await params;
  const revoked = await revokeInstallation(installation_id);
  if (!revoked) {
    return NextResponse.json({ error: "Installation not found" }, { status: 404 });
  }

  return NextResponse.json({ revoked: true, installation_id });
}
