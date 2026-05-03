/**
 * POST /api/auth/password-reset/confirm
 * Confirm password reset with token
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, AUTH_MAX_REQUESTS } from "@/lib/rate-limit";
import { getPgPool } from "@/lib/insights-saas-db";
import { createHash } from "crypto";

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(`auth:password-reset-confirm:${clientIp}`, AUTH_MAX_REQUESTS);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = String(body.token ?? "").trim();
  const newPassword = String(body.password ?? "").trim();

  if (!token || !newPassword || newPassword.length < 8) {
    return NextResponse.json(
      { error: "token and password (min 8 chars) are required" },
      { status: 400 },
    );
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const pool = getPgPool();

  // Find valid reset token
  const resetResult = await pool.query(
    `SELECT user_id FROM insights_password_resets
     WHERE token_hash = $1 AND expires_at > NOW()`,
    [tokenHash],
  );

  if (resetResult.rows.length === 0) {
    return NextResponse.json(
      { error: "Invalid or expired reset token" },
      { status: 401 },
    );
  }

  const userId = resetResult.rows[0].user_id;

  // Update password
  await pool.query(`BEGIN`);
  try {
    await pool.query(
      `UPDATE insights_users SET password_hash = crypt($1, gen_salt('bf')) WHERE user_id = $2`,
      [newPassword, userId],
    );

    // Delete used reset token
    await pool.query(`DELETE FROM insights_password_resets WHERE user_id = $1`, [userId]);

    await pool.query(`COMMIT`);

    return NextResponse.json({
      message: "Password updated successfully",
      authenticated: false, // User needs to login again
    });
  } catch (error) {
    await pool.query(`ROLLBACK`);
    throw error;
  }
}
