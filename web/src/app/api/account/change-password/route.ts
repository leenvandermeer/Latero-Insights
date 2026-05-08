/**
 * POST /api/account/change-password
 * Change password for the authenticated user.
 * Not available to SSO-only users (they have no local password).
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, AUTH_MAX_REQUESTS } from "@/lib/rate-limit";
import { getPgPool } from "@/lib/insights-saas-db";
import { getSessionFromRequest, verifyUserPassword } from "@/lib/session-auth";

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(`account:change-password:${clientIp}`, AUTH_MAX_REQUESTS);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const currentPassword = String(body.currentPassword ?? "").trim();
  const newPassword = String(body.newPassword ?? "").trim();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "currentPassword and newPassword are required" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "New password must differ from current password" }, { status: 400 });
  }

  // Verify current password
  const verified = await verifyUserPassword(session.email, currentPassword);
  if (!verified) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  const pool = getPgPool();
  await pool.query(
    `UPDATE insights_users
     SET password_hash = crypt($1, gen_salt('bf')), updated_at = NOW()
     WHERE user_id = $2`,
    [newPassword, session.user_id],
  );

  return NextResponse.json({ message: "Password updated successfully" });
}
