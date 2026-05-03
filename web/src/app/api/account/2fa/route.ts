/**
 * DELETE /api/account/2fa
 *
 * Allows an authenticated user to disable their own 2FA.
 * Requires the current TOTP code or a backup code to confirm.
 *
 * Request body:
 *  - code: string  (current TOTP token or backup code)
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getSessionFromRequest,
  getTotpSecretEnc,
  resetTotpForUser,
  consumeBackupCode,
} from "@/lib/session-auth";
import { decryptTotpSecret, verifyTotpToken, hashBackupCode } from "@/lib/totp";
import { rateLimit, AUTH_MAX_REQUESTS } from "@/lib/rate-limit";

export async function DELETE(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(`account:2fa:disable:${clientIp}`, AUTH_MAX_REQUESTS);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.two_factor_enabled) {
    return NextResponse.json({ error: "2FA is not enabled" }, { status: 400 });
  }

  let body: { code?: string };
  try {
    body = (await request.json()) as { code?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const code = body.code?.trim().replace(/\s/g, "");
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const secretEnc = await getTotpSecretEnc(session.user_id);
  if (!secretEnc) {
    return NextResponse.json({ error: "2FA configuration not found" }, { status: 400 });
  }

  const plainSecret = decryptTotpSecret(secretEnc);
  if (!plainSecret) {
    return NextResponse.json({ error: "2FA configuration is invalid. Contact support." }, { status: 500 });
  }
  const validTotp = verifyTotpToken(plainSecret, code);
  const validBackup = !validTotp && (await consumeBackupCode(session.user_id, hashBackupCode(code)));

  if (!validTotp && !validBackup) {
    return NextResponse.json({ error: "Invalid code" }, { status: 422 });
  }

  await resetTotpForUser(session.user_id);
  return NextResponse.json({ disabled: true });
}
