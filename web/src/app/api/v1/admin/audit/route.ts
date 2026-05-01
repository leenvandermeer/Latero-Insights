/**
 * GET /api/v1/admin/audit
 * Paginated audit log
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getAuditLog } from "@/lib/session-auth";

export async function GET(request: NextRequest) {
  try {
    const adminResult = await requireAdminSession(request);
    if (adminResult.error) {
      return NextResponse.json({ error: adminResult.message }, { status: adminResult.status });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") ?? "100", 10);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    const auditLogs = await getAuditLog(Math.min(limit, 500), offset);

    return NextResponse.json({
      logs: auditLogs,
      count: auditLogs.length,
    });
  } catch (error) {
    console.error("[admin] GET /api/v1/admin/audit:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
