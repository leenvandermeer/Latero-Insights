import { NextRequest, NextResponse } from "next/server";
import { dbHealthCheck, getSaaSReadStoreCounts } from "@/lib/insights-saas-db";
import { getAutoSyncState } from "@/lib/databricks-auto-sync";

function parsePostgresTarget(postgresUrl: string | undefined): {
  configured: boolean;
  host: string | null;
  port: number | null;
  database: string | null;
  ssl: boolean | null;
} {
  if (!postgresUrl) {
    return {
      configured: false,
      host: null,
      port: null,
      database: null,
      ssl: null,
    };
  }

  try {
    const parsed = new URL(postgresUrl);
    const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
    return {
      configured: true,
      host: parsed.hostname || null,
      port: parsed.port ? parseInt(parsed.port, 10) : 5432,
      database: parsed.pathname?.replace(/^\//, "") || null,
      ssl: sslMode ? sslMode !== "disable" : null,
    };
  } catch {
    return {
      configured: true,
      host: null,
      port: null,
      database: null,
      ssl: null,
    };
  }
}

export async function GET(_request: NextRequest) {
  const target = parsePostgresTarget(process.env.POSTGRES_URL);
  const autoSyncState = getAutoSyncState();
  const autoSync = {
    enabled: process.env.INSIGHTS_AUTO_SYNC_ENABLED !== "false",
    intervalMinutes: parseInt(process.env.INSIGHTS_AUTO_SYNC_INTERVAL_MINUTES ?? "15", 10) || 15,
    windowDays: parseInt(process.env.INSIGHTS_AUTO_SYNC_WINDOW_DAYS ?? "7", 10) || 7,
    ...autoSyncState,
  };
  try {
    const database = await dbHealthCheck();
    const readStore = database
      ? await getSaaSReadStoreCounts()
      : { pipeline_runs: 0, dq_checks: 0, lineage: 0 };

    return NextResponse.json(
      {
        status: database ? "ok" : "error",
        database,
        databaseType: "postgres",
        role: "insights-saas-internal",
        configured: target.configured,
        target,
        readStore,
        autoSync,
        timestamp: new Date().toISOString(),
      },
      { status: database ? 200 : 503 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        status: "error",
        database: false,
        databaseType: "postgres",
        role: "insights-saas-internal",
        configured: target.configured,
        target,
        readStore: { pipeline_runs: 0, dq_checks: 0, lineage: 0 },
        autoSync,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
