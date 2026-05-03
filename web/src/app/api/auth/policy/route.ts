/**
 * GET /api/auth/policy?hint=<email-domein>
 *
 * Unauthenticated endpoint. Retourneert de auth-mode voor een installatie op
 * basis van een e-maildomein-hint. Nooit gebruikt voor installatie-enumeratie:
 * zowel "geen match" als "local_only" geven dezelfde response.
 *
 * Response bevat geen gevoelige config (client_id, issuer, installation_id).
 * Rate limit: 20/min per IP.
 *
 * Zie: ux/sso-auth-ux.md §5 voor het volledige architectuurcontract.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getAuthPolicyByDomain } from "@/lib/auth-policy";

const FALLBACK_RESPONSE = {
  auth_mode: "local_only",
  sso_available: false,
  sso_label: null,
} as const;

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(`auth:policy:${clientIp}`, 20);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const hint = request.nextUrl.searchParams.get("hint")?.trim().toLowerCase();
  if (!hint) {
    return NextResponse.json(FALLBACK_RESPONSE);
  }

  // Extraheer het domein uit een volledig e-mailadres indien meegegeven
  const domain = hint.includes("@") ? hint.split("@")[1] : hint;
  if (!domain || domain.length < 3 || !domain.includes(".")) {
    return NextResponse.json(FALLBACK_RESPONSE);
  }

  try {
    const policy = await getAuthPolicyByDomain(domain);

    // Geef nooit de installation_id terug aan de browser
    return NextResponse.json({
      auth_mode: policy.auth_mode,
      sso_available: policy.sso_available,
      sso_label: policy.sso_label,
    });
  } catch {
    // Bij een onverwachte fout: graceful fallback, geen info-lekkage
    return NextResponse.json(FALLBACK_RESPONSE);
  }
}
