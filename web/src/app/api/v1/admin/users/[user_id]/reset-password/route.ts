/**
 * POST /api/v1/admin/users/[user_id]/reset-password
 * Admin-initiated password reset for a user
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, getRequestMetadata } from "@/lib/admin-auth";
import { getPgPool } from "@/lib/insights-saas-db";
import { logAdminAction } from "@/lib/session-auth";
import { randomBytes } from "crypto";

function generateTemporaryPassword(length: number = 16): string {
  // URL-safe random + required classes for predictable policy compliance.
  const randomPart = randomBytes(Math.max(8, length)).toString("base64url").slice(0, length - 4);
  return `A9!${randomPart}z`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ user_id: string }> },
) {
  try {
    const adminResult = await requireAdminSession(request);
    if (adminResult.error) {
      return NextResponse.json({ error: adminResult.message }, { status: adminResult.status });
    }
    const session = adminResult.session;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user_id } = await params;
    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const requestedPassword = String(body.password ?? "").trim();
    const generatedPassword = requestedPassword ? "" : generateTemporaryPassword();
    const newPassword = requestedPassword || generatedPassword;

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: "password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const pool = getPgPool();

    // Get user email for logging
    const userResult = await pool.query(
      `SELECT email FROM insights_users WHERE user_id = $1`,
      [user_id],
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userEmail = userResult.rows[0].email;

    // Update password
    const updateResult = await pool.query(
      `UPDATE insights_users
       SET password_hash = crypt($1, gen_salt('bf')), updated_at = NOW()
       WHERE user_id = $2
       RETURNING user_id, email`,
      [newPassword, user_id],
    );

    const { ip, userAgent } = getRequestMetadata(request);

    // Log admin action
    await logAdminAction(
      session.user_id,
      "RESET_USER_PASSWORD",
      "user",
      user_id,
      { email: userEmail },
      ip,
      userAgent,
    );

    return NextResponse.json({
      message: `Password for ${userEmail} has been reset successfully`,
      user_id: updateResult.rows[0].user_id,
      email: updateResult.rows[0].email,
      temporary_password: generatedPassword || undefined,
      password_generated: !requestedPassword,
    });
  } catch (error) {
    console.error("[admin] POST /api/v1/admin/users/[user_id]/reset-password:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
