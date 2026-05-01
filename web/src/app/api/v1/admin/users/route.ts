/**
 * GET /api/v1/admin/users
 * List all users with their installation memberships
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAdminSession, getRequestMetadata } from "@/lib/admin-auth";
import { getPgPool } from "@/lib/insights-saas-db";
import {
  createOrUpdateUserWithInstallations,
  ensureAuthSchema,
  grantAdminRole,
  logAdminAction,
  revokeAdminRole,
} from "@/lib/session-auth";

function generateTemporaryPassword(length: number = 16): string {
  const randomPart = randomBytes(Math.max(8, length)).toString("base64url").slice(0, length - 4);
  return `A9!${randomPart}z`;
}

export async function GET(request: NextRequest) {
  try {
    const adminResult = await requireAdminSession(request);
    if (adminResult.error) {
      return NextResponse.json({ error: adminResult.message }, { status: adminResult.status });
    }

    const pool = getPgPool();

    const result = await pool.query(`
      SELECT 
        u.user_id,
        u.email,
        u.is_admin,
        u.created_at,
        COALESCE(json_agg(
          json_build_object(
            'installation_id', ui.installation_id,
            'role', ui.role
          )
        ) FILTER (WHERE ui.installation_id IS NOT NULL), '[]'::json) as installations
      FROM insights_users u
      LEFT JOIN insights_user_installations ui ON u.user_id = ui.user_id
      WHERE u.active = TRUE
      GROUP BY u.user_id, u.email, u.is_admin, u.created_at
      ORDER BY u.created_at DESC
    `);

    return NextResponse.json({
      users: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("[admin] GET /api/v1/admin/users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/admin/users
 * Create or update a user and assign tenant memberships
 */
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdminSession(request);
    if (adminResult.error) {
      return NextResponse.json({ error: adminResult.message }, { status: adminResult.status });
    }

    const session = adminResult.session;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const email = String(body.email ?? "").trim().toLowerCase();
    const requestedPassword = String(body.password ?? "").trim();
    const generatePassword = body.generate_password === true || !requestedPassword;
    const password = generatePassword ? generateTemporaryPassword() : requestedPassword;
    const setAdmin = body.is_admin === true;

    const installationIdsFromArray = Array.isArray(body.installation_ids)
      ? body.installation_ids.map((value) => String(value).trim()).filter(Boolean)
      : [];
    const installationId = String(body.installation_id ?? "").trim();
    const mergedInstallationIds = Array.from(new Set([
      ...installationIdsFromArray,
      ...(installationId ? [installationId] : []),
    ]));

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    if (!password || password.length < 8) {
      return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
    }

    if (mergedInstallationIds.length === 0) {
      return NextResponse.json({ error: "installation_ids must include at least one installation" }, { status: 400 });
    }

    await ensureAuthSchema();
    await createOrUpdateUserWithInstallations(email, password, mergedInstallationIds);

    const pool = getPgPool();
    const userResult = await pool.query(
      `SELECT user_id, email FROM insights_users WHERE email = $1 LIMIT 1`,
      [email],
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    const userId = String(userResult.rows[0].user_id);
    if (setAdmin) {
      await grantAdminRole(userId);
    } else {
      await revokeAdminRole(userId);
    }

    const profileResult = await pool.query(
      `SELECT
         u.user_id,
         u.email,
         u.is_admin,
         u.created_at,
         COALESCE(json_agg(
           json_build_object('installation_id', ui.installation_id, 'role', ui.role)
         ) FILTER (WHERE ui.installation_id IS NOT NULL), '[]'::json) as installations
       FROM insights_users u
       LEFT JOIN insights_user_installations ui ON u.user_id = ui.user_id
       WHERE u.user_id = $1
       GROUP BY u.user_id, u.email, u.is_admin, u.created_at`,
      [userId],
    );

    const { ip, userAgent } = getRequestMetadata(request);
    await logAdminAction(
      session.user_id,
      "UPSERT_USER",
      "user",
      userId,
      {
        email,
        installation_ids: mergedInstallationIds,
        is_admin: setAdmin,
      },
      ip,
      userAgent,
    );

    return NextResponse.json({
      user: profileResult.rows[0],
      password_generated: generatePassword,
      temporary_password: generatePassword ? password : undefined,
      message: "User provisioning completed",
    });
  } catch (error) {
    console.error("[admin] POST /api/v1/admin/users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
