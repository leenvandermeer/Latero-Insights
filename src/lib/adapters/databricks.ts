import type { DataAdapter, DateRange, PipelineRun, DataQualityCheck, LineageHop } from "./types";
import { loadSettings } from "@/lib/settings";

interface StatementResponse {
  statement_id: string;
  status: { state: string; error?: { message: string } };
  manifest?: { schema: { columns: Array<{ name: string; type_name: string }> } };
  result?: { data_array: string[][] };
}

async function executeStatement(sql: string, params?: Array<{ name: string; value: string; type?: string }>): Promise<StatementResponse> {
  const settings = loadSettings();

  if (!settings.databricksHost || !settings.databricksToken || !settings.databricksWarehouseId) {
    throw new Error("Missing Databricks configuration. Configure via Settings page or set DATABRICKS_HOST, DATABRICKS_TOKEN, and DATABRICKS_WAREHOUSE_ID.");
  }

  const url = `https://${settings.databricksHost}/api/2.0/sql/statements`;
  const body: Record<string, unknown> = {
    warehouse_id: settings.databricksWarehouseId,
    statement: sql,
    wait_timeout: "30s",
    disposition: "INLINE",
    format: "JSON_ARRAY",
  };
  if (params && params.length > 0) {
    body.parameters = params;
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.databricksToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Databricks API error ${resp.status}: ${text}`);
  }

  const data: StatementResponse = await resp.json();

  if (data.status.state === "FAILED") {
    throw new Error(`Statement failed: ${data.status.error?.message ?? "unknown error"}`);
  }

  return data;
}

function mapRows<T>(response: StatementResponse, mapper: (row: string[], columns: string[]) => T): T[] {
  const columns = response.manifest?.schema.columns.map((c) => c.name) ?? [];
  const rows = response.result?.data_array ?? [];
  return rows.map((row) => mapper(row, columns));
}

function col(row: string[], columns: string[], name: string): string | null {
  const idx = columns.indexOf(name);
  return idx >= 0 ? row[idx] ?? null : null;
}

function fqTable(table: string): string {
  const settings = loadSettings();
  return `${settings.databricksCatalog}.${settings.databricksSchema}.${table}`;
}

export class DatabricksAdapter implements DataAdapter {
  async getPipelineRuns(range: DateRange): Promise<PipelineRun[]> {
    const sql = `SELECT event_type, timestamp_utc, event_date, dataset_id, source_system, step, run_id, run_status, duration_ms, environment FROM ${fqTable("pipeline_runs")} WHERE event_date >= :date_from AND event_date <= :date_to ORDER BY timestamp_utc DESC`;
    const resp = await executeStatement(sql, [
      { name: "date_from", value: range.from, type: "STRING" },
      { name: "date_to", value: range.to, type: "STRING" },
    ]);
    return mapRows(resp, (row, cols) => ({
      event_type: col(row, cols, "event_type") ?? "",
      timestamp_utc: col(row, cols, "timestamp_utc") ?? "",
      event_date: col(row, cols, "event_date") ?? "",
      dataset_id: col(row, cols, "dataset_id") ?? "",
      source_system: col(row, cols, "source_system") ?? "",
      step: col(row, cols, "step") ?? "",
      run_id: col(row, cols, "run_id") ?? "",
      run_status: col(row, cols, "run_status") ?? "",
      duration_ms: col(row, cols, "duration_ms") ? Number(col(row, cols, "duration_ms")) : null,
      environment: col(row, cols, "environment"),
    }));
  }

  async getDataQualityChecks(range: DateRange): Promise<DataQualityCheck[]> {
    const sql = `SELECT event_type, timestamp_utc, event_date, dataset_id, step, run_id, check_id, check_status, check_category, policy_version FROM ${fqTable("data_quality_checks")} WHERE event_date >= :date_from AND event_date <= :date_to ORDER BY timestamp_utc DESC`;
    const resp = await executeStatement(sql, [
      { name: "date_from", value: range.from, type: "STRING" },
      { name: "date_to", value: range.to, type: "STRING" },
    ]);
    return mapRows(resp, (row, cols) => ({
      event_type: col(row, cols, "event_type") ?? "",
      timestamp_utc: col(row, cols, "timestamp_utc") ?? "",
      event_date: col(row, cols, "event_date") ?? "",
      dataset_id: col(row, cols, "dataset_id") ?? "",
      step: col(row, cols, "step") ?? "",
      run_id: col(row, cols, "run_id") ?? "",
      check_id: col(row, cols, "check_id") ?? "",
      check_status: col(row, cols, "check_status") ?? "",
      check_category: col(row, cols, "check_category"),
      policy_version: col(row, cols, "policy_version"),
    }));
  }

  async getLineageHops(range: DateRange): Promise<LineageHop[]> {
    const sql = `SELECT event_type, timestamp_utc, event_date, dataset_id, step, run_id, source_entity, source_type, source_ref, source_attribute, target_entity, target_type, target_ref, target_attribute FROM ${fqTable("data_lineage")} WHERE event_date >= :date_from AND event_date <= :date_to ORDER BY timestamp_utc DESC`;
    const resp = await executeStatement(sql, [
      { name: "date_from", value: range.from, type: "STRING" },
      { name: "date_to", value: range.to, type: "STRING" },
    ]);
    return mapRows(resp, (row, cols) => ({
      event_type: col(row, cols, "event_type") ?? "",
      timestamp_utc: col(row, cols, "timestamp_utc") ?? "",
      event_date: col(row, cols, "event_date") ?? "",
      dataset_id: col(row, cols, "dataset_id") ?? "",
      step: col(row, cols, "step") ?? "",
      run_id: col(row, cols, "run_id") ?? "",
      source_entity: col(row, cols, "source_entity") ?? "",
      source_type: col(row, cols, "source_type") ?? "",
      source_ref: col(row, cols, "source_ref") ?? "",
      source_attribute: col(row, cols, "source_attribute"),
      target_entity: col(row, cols, "target_entity") ?? "",
      target_type: col(row, cols, "target_type") ?? "",
      target_ref: col(row, cols, "target_ref") ?? "",
      target_attribute: col(row, cols, "target_attribute"),
    }));
  }

  async testConnection(): Promise<boolean> {
    try {
      const sql = `SELECT 1 AS ok FROM ${fqTable("pipeline_runs")} LIMIT 1`;
      const resp = await executeStatement(sql);
      return resp.status.state === "SUCCEEDED";
    } catch {
      return false;
    }
  }
}
