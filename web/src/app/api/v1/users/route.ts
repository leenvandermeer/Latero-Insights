import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createOrUpdateUserWithInstallations, ensureAuthSchema } from "@/lib/session-auth";

function verifyAdminToken(request: NextRequest): boolean {
  const adminToken = process.env.INSIGHTS_ADMIN_TOKEN;
  if (!adminToken) return false;
  const header = request.headers.get("authorization") ?? "";
  const [, token] = header.split(" ");
  return token?.trim() === adminToken;
}

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(`admin:users:${clientIp}`);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "").trim();
  const installationIds = Array.isArray(body.installation_ids)
    ? body.installation_ids.map((v) => String(v).trim()).filter(Boolean)
    : [];

  if (!email || !password || installationIds.length === 0) {
    return NextResponse.json({ error: "email, password and installation_ids are required" }, { status: 400 });
  }

  await ensureAuthSchema();
  await createOrUpdateUserWithInstallations(email, password, installationIds);

  return NextResponse.json({
    upserted: true,
    email,
    installation_ids: installationIds,
    two_factor_ready: true,
  });
}
