/**
 * PATCH /api/v1/admin/users/[user_id]
 * Update tenant memberships and admin role for a user
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, getRequestMetadata } from "@/lib/admin-auth";
import { getPgPool } from "@/lib/insights-saas-db";
import { logAdminAction } from "@/lib/session-auth";

export async function PATCH(
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
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const installationIds = Array.isArray(body.installation_ids)
      ? body.installation_ids.map((value) => String(value).trim()).filter(Boolean)
      : null;
    const isAdmin = typeof body.is_admin === "boolean" ? body.is_admin : null;

    if (!installationIds && isAdmin === null) {
      return NextResponse.json(
        { error: "Provide installation_ids and/or is_admin" },
        { status: 400 },
      );
    }

    if (installationIds && installationIds.length === 0) {
      return NextResponse.json(
        { error: "installation_ids must include at least one installation" },
        { status: 400 },
      );
    }

    const pool = getPgPool();

    const userExists = await pool.query(
      `SELECT user_id FROM insights_users WHERE user_id = $1 LIMIT 1`,
      [user_id],
    );
    if (userExists.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await pool.query("BEGIN");
    try {
      if (installationIds) {
        await pool.query(`DELETE FROM insights_user_installations WHERE user_id = $1`, [user_id]);

        for (const installationId of installationIds) {
          await pool.query(
            `INSERT INTO insights_user_installations (user_id, installation_id, role)
             VALUES ($1, $2, 'member')
             ON CONFLICT (user_id, installation_id) DO UPDATE SET role = EXCLUDED.role`,
            [user_id, installationId],
          );
        }
      }

      if (isAdmin !== null) {
        await pool.query(
          `UPDATE insights_users SET is_admin = $1, updated_at = NOW() WHERE user_id = $2`,
          [isAdmin, user_id],
        );
      }

      await pool.query("COMMIT");
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
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
      [user_id],
    );

    const { ip, userAgent } = getRequestMetadata(request);
    await logAdminAction(
      session.user_id,
      "UPDATE_USER_ACCESS",
      "user",
      user_id,
      {
        installation_ids: installationIds ?? undefined,
        is_admin: isAdmin ?? undefined,
      },
      ip,
      userAgent,
    );

    return NextResponse.json({ user: profileResult.rows[0] });
  } catch (error) {
    console.error("[admin] PATCH /api/v1/admin/users/[user_id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    if (user_id === session.user_id) {
      return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
    }

    const pool = getPgPool();

    const userResult = await pool.query(
      `SELECT user_id, email, active FROM insights_users WHERE user_id = $1 LIMIT 1`,
      [user_id],
    );
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await pool.query("BEGIN");
    try {
      await pool.query(
        `UPDATE insights_users
         SET active = FALSE,
             is_admin = FALSE,
             updated_at = NOW()
         WHERE user_id = $1`,
        [user_id],
      );

      await pool.query(
        `UPDATE insights_sessions
         SET revoked_at = NOW()
         WHERE user_id = $1
           AND revoked_at IS NULL`,
        [user_id],
      );

      await pool.query("COMMIT");
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }

    const { ip, userAgent } = getRequestMetadata(request);
    await logAdminAction(
      session.user_id,
      "DEACTIVATE_USER",
      "user",
      user_id,
      {
        email: userResult.rows[0].email,
      },
      ip,
      userAgent,
    );

    return NextResponse.json({
      message: "User deactivated",
      user_id,
      email: userResult.rows[0].email,
      active: false,
    });
  } catch (error) {
    console.error("[admin] DELETE /api/v1/admin/users/[user_id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
