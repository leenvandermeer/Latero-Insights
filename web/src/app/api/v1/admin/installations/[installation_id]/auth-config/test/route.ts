/**
 * POST /api/v1/admin/installations/[installation_id]/auth-config/test
 *
 * Tests OIDC discovery by fetching `{issuer}/.well-known/openid-configuration`.
 * Returns the key endpoints from the discovery document on success.
 * Does NOT test token exchange or client credentials.
 *
 * Body: { issuer: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { validateOrigin } from "@/lib/auth-audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ installation_id: string }> },
) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminResult = await requireAdminSession(request);
  if (adminResult.error) {
    return NextResponse.json({ error: adminResult.message }, { status: adminResult.status });
  }

  // Params is resolved to satisfy Next.js dynamic route typing but
  // the test uses the issuer from the request body (not from the DB),
  // so operators can test before saving.
  await params;

  let body: { issuer?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const issuer = body.issuer?.trim();
  if (!issuer) {
    return NextResponse.json({ error: "issuer is required" }, { status: 400 });
  }

  let issuerUrl: URL;
  try {
    issuerUrl = new URL(issuer);
  } catch {
    return NextResponse.json({ ok: false, error: "Issuer is not a valid URL." });
  }

  // Construct discovery URL: issuer may or may not end with /
  const discoveryUrl = `${issuerUrl.origin}${issuerUrl.pathname.replace(/\/$/, "")}/.well-known/openid-configuration`;

  try {
    const response = await fetch(discoveryUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        error: `Discovery endpoint returned HTTP ${response.status}. Check the Issuer URL.`,
      });
    }

    const doc = await response.json() as Record<string, unknown>;

    return NextResponse.json({
      ok: true,
      issuer: doc.issuer,
      authorization_endpoint: doc.authorization_endpoint,
      token_endpoint: doc.token_endpoint,
      jwks_uri: doc.jwks_uri,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({
      ok: false,
      error: `Could not reach discovery endpoint: ${message}`,
    });
  }
}
