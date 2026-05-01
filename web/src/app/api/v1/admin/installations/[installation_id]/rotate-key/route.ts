import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, getRequestMetadata } from "@/lib/admin-auth";
import { rotateInstallationKey } from "@/lib/insights-saas-db";

// POST /api/v1/admin/installations/[installation_id]/rotate-key
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ installation_id: string }> },
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
    const { installation_id } = await params;
    const { new_token } = await request.json();
    if (!new_token || typeof new_token !== "string") {
      return NextResponse.json({ error: "Missing or invalid new_token" }, { status: 400 });
    }
    const ok = await rotateInstallationKey(installation_id, new_token);
    if (!ok) {
      return NextResponse.json({ error: "Installation not found or update failed" }, { status: 404 });
    }
    const { ip, userAgent } = getRequestMetadata(request);
    await (await import("@/lib/session-auth")).logAdminAction(
      session.user_id,
      "ROTATE_INSTALLATION_KEY",
      "installation",
      installation_id,
      { new_token: "***" },
      ip,
      userAgent,
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin] POST /api/v1/admin/installations/[id]/rotate-key:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
