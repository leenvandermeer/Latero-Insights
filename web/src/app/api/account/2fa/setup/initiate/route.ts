/**
 * POST /api/account/2fa/setup/initiate
 *
 * Generates a new TOTP secret for the authenticated user and returns:
 *  - a QR code data URL (for authenticator app scanning)
 *  - the raw base32 secret (for manual entry)
 *
 * The secret is NOT saved yet — it's stored in the response only.
 * The client must confirm with a valid token via /api/account/2fa/setup/confirm.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session-auth";
import {
  generateTotpSecret,
  buildTotpUri,
  encryptTotpSecret,
} from "@/lib/totp";
import { rateLimit, AUTH_MAX_REQUESTS } from "@/lib/rate-limit";
import QRCode from "qrcode";

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(`account:2fa:setup:initiate:${clientIp}`, AUTH_MAX_REQUESTS);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base32Secret = generateTotpSecret();
  const uri = buildTotpUri(base32Secret, session.email);
  const qrDataUrl = await QRCode.toDataURL(uri, { width: 200, margin: 1 });

  // Encrypt and include the encrypted secret so the confirm step can save it
  // without requiring a second decrypt round-trip
  const encryptedSecret = encryptTotpSecret(base32Secret);

  return NextResponse.json({
    qr_code: qrDataUrl,
    secret: base32Secret,
    encrypted_secret: encryptedSecret,
  });
}
