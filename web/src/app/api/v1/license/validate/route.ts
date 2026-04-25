// WP-5.1 — License validation endpoint (LLIC-001 through LLIC-005)
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getBearerToken, requireString, validateLicense } from "@/lib/insights-saas-db";

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(`v1:license:${clientIp}`);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const bearerToken = getBearerToken(request);
  if (!bearerToken) {
    return NextResponse.json({ error: "Missing Bearer token" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // LLIC-005 — all four fields are required
  const missing: string[] = [];
  for (const field of ["installation_id", "api_key", "adapter_package", "adapter_version"]) {
    if (!body[field] || String(body[field]).trim() === "") missing.push(field);
  }
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "Missing required fields", fields: missing },
      { status: 400 },
    );
  }

  try {
    const installationId = requireString(body.installation_id, "installation_id");
    const apiKey = requireString(body.api_key, "api_key");
    const adapterPackage = requireString(body.adapter_package, "adapter_package");
    const adapterVersion = requireString(body.adapter_version, "adapter_version");

    const result = await validateLicense(installationId, apiKey, adapterPackage, adapterVersion);

    if (result.status === 401) {
      return NextResponse.json({ error: "Unknown or revoked api_key" }, { status: 401 });
    }
    if (result.status === 403) {
      return NextResponse.json({ error: "License expired or subscription downgraded" }, { status: 403 });
    }

    return NextResponse.json({
      installation_id: installationId,
      subscription_tier: result.subscription_tier,
      valid_until: result.valid_until ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
