import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session-auth";
import { loadSettings } from "@/lib/settings";

// Queries the live Databricks meta tables to diagnose why sync returns 0 records.
// Returns: actual column names, environment values, and event_date coverage per table.
export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = loadSettings(session.active_installation_id ?? undefined);

  if (settings.connectionMode !== "databricks") {
    return NextResponse.json({ error: "Not in Databricks mode." }, { status: 409 });
  }
  if (!settings.databricksHost || !settings.databricksToken || !settings.databricksWarehouseId) {
    return NextResponse.json({ error: "Databricks credentials not configured." }, { status: 400 });
  }

  const catalog = settings.databricksCatalog || "workspace";
  const schema = settings.databricksSchema || "meta";
  const tables = ["pipeline_runs", "data_quality_checks", "data_lineage"];

  async function query(sql: string): Promise<{ columns: string[]; rows: string[][] }> {
    const url = `https://${settings.databricksHost}/api/2.0/sql/statements`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.databricksToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        warehouse_id: settings.databricksWarehouseId,
        statement: sql,
        wait_timeout: "30s",
        disposition: "INLINE",
        format: "JSON_ARRAY",
      }),
      signal: AbortSignal.timeout(35000),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Databricks ${resp.status}: ${text.slice(0, 200)}`);
    }
    const data = await resp.json() as {
      status: { state: string; error?: { message: string } };
      manifest?: { schema: { columns: Array<{ name: string }> } };
      result?: { data_array: string[][] };
    };
    if (data.status.state === "FAILED") {
      throw new Error(data.status.error?.message ?? "Query failed");
    }
    const columns = data.manifest?.schema.columns.map((c) => c.name) ?? [];
    const rows = data.result?.data_array ?? [];
    return { columns, rows };
  }

  const results: Record<string, unknown> = {
    catalog,
    schema,
    configuredEnvironment: settings.databricksEnvironment || "(auto-detect)",
  };

  for (const table of tables) {
    const fq = `${catalog}.${schema}.${table}`;
    const tableResult: Record<string, unknown> = {};
    try {
      // 1. Actual columns
      const desc = await query(`DESCRIBE TABLE ${fq}`);
      tableResult.columns = desc.rows
        .map((r) => r[0]?.trim())
        .filter((n): n is string => Boolean(n) && !n.startsWith("#") && !n.includes(" "));

      // 2. Environment values (if column exists)
      if ((tableResult.columns as string[]).includes("environment")) {
        const env = await query(
          `SELECT environment, COUNT(*) AS cnt FROM ${fq} GROUP BY environment ORDER BY cnt DESC LIMIT 10`
        );
        tableResult.environmentValues = env.rows.map((r) => ({ environment: r[0], count: r[1] }));
      }

      // 3. event_date coverage
      if ((tableResult.columns as string[]).includes("event_date")) {
        const cov = await query(
          `SELECT MIN(event_date) AS min_date, MAX(event_date) AS max_date, COUNT(*) AS total FROM ${fq}`
        );
        if (cov.rows[0]) {
          tableResult.eventDateRange = { min: cov.rows[0][0], max: cov.rows[0][1], total: cov.rows[0][2] };
        }
      }
    } catch (err) {
      tableResult.error = err instanceof Error ? err.message : String(err);
    }
    results[table] = tableResult;
  }

  return NextResponse.json(results);
}
