/**
 * POST /api/account/2fa/setup/confirm
 *
 * Verifies the first TOTP token from the user's authenticator app.
 * On success, saves the encrypted secret and backup codes, enabling 2FA.
 *
 * Request body:
 *  - encrypted_secret: string  (from initiate response)
 *  - code: string              (6-digit TOTP token)
 *
 * Response:
 *  - backup_codes: string[]    (5 single-use backup codes, shown once)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, saveTotpSecretAndEnable } from "@/lib/session-auth";
import {
  decryptTotpSecret,
  verifyTotpToken,
  generateBackupCodes,
  hashBackupCode,
} from "@/lib/totp";
import { rateLimit, AUTH_MAX_REQUESTS } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(`account:2fa:setup:confirm:${clientIp}`, AUTH_MAX_REQUESTS);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { encrypted_secret?: string; code?: string };
  try {
    body = (await request.json()) as { encrypted_secret?: string; code?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { encrypted_secret, code } = body;
  if (!encrypted_secret || !code) {
    return NextResponse.json({ error: "encrypted_secret and code are required" }, { status: 400 });
  }

  let plainSecret: string;
  try {
    const decrypted = decryptTotpSecret(encrypted_secret);
    if (!decrypted) throw new Error("decryption_failed");
    plainSecret = decrypted;
  } catch {
    return NextResponse.json({ error: "Invalid setup session. Please start over." }, { status: 400 });
  }

  const sanitizedCode = code.trim().replace(/\s/g, "");
  if (!verifyTotpToken(plainSecret, sanitizedCode)) {
    return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 422 });
  }

  const backupCodes = generateBackupCodes();
  const backupCodeHashes = backupCodes.map(hashBackupCode);

  await saveTotpSecretAndEnable(session.user_id, encrypted_secret, backupCodeHashes);

  return NextResponse.json({ backup_codes: backupCodes });
}
