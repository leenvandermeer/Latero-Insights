/**
 * DELETE /api/v1/admin/users/[user_id]/2fa
 *
 * Admin-only: reset a user's 2FA. Clears TOTP secret and backup codes.
 * Does not require the user's TOTP code — admin override.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { resetTotpForUser } from "@/lib/session-auth";

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

    await resetTotpForUser(user_id);

    return NextResponse.json({ reset: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
