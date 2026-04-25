// Admin API for managing Latero Insights API keys.
// Protected by INSIGHTS_ADMIN_TOKEN environment variable.
import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createInstallation, listInstallations } from "@/lib/insights-saas-db";

function verifyAdminToken(request: NextRequest): boolean {
  const adminToken = process.env.INSIGHTS_ADMIN_TOKEN;
  if (!adminToken) return false; // admin token not configured → deny
  const header = request.headers.get("authorization") ?? "";
  const [, token] = header.split(" ");
  return token?.trim() === adminToken;
}

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(`admin:installations:${clientIp}`);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const installations = await listInstallations();
  return NextResponse.json({ installations });
}

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(`admin:installations:${clientIp}`);
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

  const installationId = String(body.installation_id ?? "").trim();
  if (!installationId) {
    return NextResponse.json({ error: "installation_id is required" }, { status: 400 });
  }

  const environment = String(body.environment ?? "production").trim();
  const label = body.label ? String(body.label).trim() : undefined;
  const subscriptionTier = String(body.subscription_tier ?? "trial").trim();

  // Generate a secure raw token — shown once, never stored plaintext
  const rawToken = `sk_live_${randomBytes(24).toString("base64url")}`;

  try {
    await createInstallation(installationId, environment, rawToken, label, subscriptionTier);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("duplicate key") || message.includes("unique")) {
      return NextResponse.json({ error: "installation_id already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json(
    {
      installation_id: installationId,
      environment,
      label: label ?? null,
      subscription_tier: subscriptionTier,
      // Token shown once — store it securely, cannot be retrieved later
      api_key: rawToken,
    },
    { status: 201 },
  );
}
