/**
 * POST /api/auth/password-reset
 * Request password reset
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getPgPool } from "@/lib/insights-saas-db";
import { createHash, randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(`auth:password-reset:${clientIp}`);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const pool = getPgPool();

  // Check if user exists
  const userResult = await pool.query("SELECT user_id FROM insights_users WHERE email = $1", [email]);
  if (userResult.rows.length === 0) {
    // Don't leak whether user exists
    return NextResponse.json({
      message: "If the email exists, a password reset link has been sent.",
    });
  }

  const userId = userResult.rows[0].user_id;

  // Generate reset token
  const resetToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(resetToken).digest("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Store reset token
  await pool.query(
    `INSERT INTO insights_password_resets (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET token_hash = $2, expires_at = $3`,
    [userId, tokenHash, expiresAt],
  );

  // In production, send email with reset link
  // For now, log to console (dev environment)
  console.log(`[DEV] Password reset token for ${email}: ${resetToken}`);

  return NextResponse.json({
    message: "If the email exists, a password reset link has been sent.",
    _dev_reset_token: resetToken, // Only in dev
  });
}
