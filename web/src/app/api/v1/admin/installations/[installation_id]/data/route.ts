/**
 * DELETE /api/v1/admin/installations/[installation_id]/data
 * LINS-018 — Wis alle operationele data voor een installatie.
 * De installatie-definitie (insights_installations, gebruikers, SSO-config) blijft intact.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, getRequestMetadata } from "@/lib/admin-auth";
import { getPgPool } from "@/lib/insights-saas-db";
import { logAdminAction } from "@/lib/session-auth";

export async function DELETE(
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

    // Bevestigingstoken uit body: client stuurt { confirm: "<installation_id>" }
    let body: Record<string, unknown> = {};
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (body.confirm !== installation_id) {
      return NextResponse.json(
        { error: "Confirmation mismatch — body.confirm must equal the installation_id" },
        { status: 422 },
      );
    }

    const pool = getPgPool();

    // Controleer of installatie bestaat
    const checkResult = await pool.query(
      "SELECT installation_id FROM insights_installations WHERE installation_id = $1",
      [installation_id],
    );
    if (checkResult.rows.length === 0) {
      return NextResponse.json({ error: "Installation not found" }, { status: 404 });
    }

    // Verwijder operationele data in de correcte volgorde (FK-constraints respecteren)
    // Volgorde: leaf-tabellen eerst, dan parent-tabellen
    const deletions: Record<string, number> = {};

    const tables: Array<{ table: string; key?: string }> = [
      { table: "meta.quality_results" },
      { table: "meta.run_io" },
      { table: "meta.lineage_columns" },
      { table: "meta.lineage_edges" },
      { table: "meta.runs" },
      { table: "meta.jobs" },
      { table: "meta.datasets" },
      { table: "meta.entities" },
      { table: "meta.data_products" },
    ];

    for (const { table } of tables) {
      const result = await pool.query(
        `DELETE FROM ${table} WHERE installation_id = $1`,
        [installation_id],
      );
      deletions[table] = result.rowCount ?? 0;
    }

    const totalDeleted = Object.values(deletions).reduce((s, n) => s + n, 0);

    // Audit log
    const { ip, userAgent } = getRequestMetadata(request);
    await logAdminAction(
      session.user_id,
      "CLEAR_INSTALLATION_DATA",
      "installation",
      installation_id,
      { deleted_counts: deletions, total: totalDeleted },
      ip,
      userAgent,
    );

    return NextResponse.json({
      success: true,
      installation_id,
      deleted: deletions,
      total_deleted: totalDeleted,
    });
  } catch (error) {
    console.error("[admin] DELETE /api/v1/admin/installations/[id]/data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
