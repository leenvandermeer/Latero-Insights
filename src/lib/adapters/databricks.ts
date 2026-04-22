import type {
  DataAdapter,
  DateRange,
  PipelineRun,
  DataQualityCheck,
  LineageHop,
  LineageEntity,
  LineageAttribute,
  LineageSchemaInventory,
} from "./types";
import { loadSettings } from "@/lib/settings";

const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000;

type SchemaCacheEntry = {
  columns: string[];
  expiresAt: number;
};

const schemaCache = new Map<string, SchemaCacheEntry>();

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

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try { return JSON.parse(value) as string[]; } catch { return []; }
}

function parseBoolean(value: string | null): boolean {
  return value?.toLowerCase() === "true" || value === "1";
}

async function describeColumns(table: string): Promise<string[]> {
  const key = fqTable(table);
  const now = Date.now();
  const cached = schemaCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.columns;
  }

  const resp = await executeStatement(`DESCRIBE TABLE ${key}`);
  const rows = resp.result?.data_array ?? [];
  const columns = rows
    .map((row) => row[0]?.trim())
    .filter((name): name is string => Boolean(name) && !name.startsWith("#") && !name.includes(" "));

  schemaCache.set(key, { columns, expiresAt: now + SCHEMA_CACHE_TTL_MS });
  return columns;
}

function hasColumn(columns: string[], name: string): boolean {
  return columns.includes(name);
}

function preferredColumn(columns: string[], ...names: string[]): string | null {
  return names.find((name) => hasColumn(columns, name)) ?? null;
}

export class DatabricksAdapter implements DataAdapter {
  async getLineageSchemaInventory(): Promise<LineageSchemaInventory> {
    const [entities, attributes, hops] = await Promise.all([
      describeColumns("lineage_entities_current"),
      describeColumns("lineage_attributes_current"),
      describeColumns("data_lineage"),
    ]);

    return {
      lineage_entities_current: entities,
      lineage_attributes_current: attributes,
      data_lineage: hops,
    };
  }

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
    const columns = await describeColumns("data_lineage");
    const optional = ["source_system", "installation_id", "environment", "schema_version", "lineage_evidence"]
      .filter((name) => hasColumn(columns, name));
    const sql = `SELECT event_type, timestamp_utc, event_date, dataset_id, step, run_id, source_entity, source_type, source_ref, source_attribute, target_entity, target_type, target_ref, target_attribute${optional.length > 0 ? `, ${optional.join(", ")}` : ""} FROM ${fqTable("data_lineage")} WHERE event_date >= :date_from AND event_date <= :date_to ORDER BY timestamp_utc DESC`;
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
      source_system: col(row, cols, "source_system"),
      installation_id: col(row, cols, "installation_id"),
      environment: col(row, cols, "environment"),
      schema_version: col(row, cols, "schema_version"),
      lineage_evidence: col(row, cols, "lineage_evidence"),
    }));
  }

  async getLineageEntities(): Promise<LineageEntity[]> {
    const columns = await describeColumns("lineage_entities_current");
    const lineageGroupColumn = preferredColumn(columns, "lineage_group_id", "latest_lineage_group_id");
    const lastCompletedColumn = preferredColumn(columns, "last_completed_layer");
    const sql = `SELECT entity_fqn, layer, latest_status, end_to_end_status, latest_success_at, upstream_entity_fqns, downstream_entity_fqns${lineageGroupColumn ? `, ${lineageGroupColumn} AS lineage_group_id` : ", CAST(NULL AS STRING) AS lineage_group_id"}${lastCompletedColumn ? `, ${lastCompletedColumn} AS last_completed_layer` : ", CAST(NULL AS STRING) AS last_completed_layer"} FROM ${fqTable("lineage_entities_current")}`;
    const resp = await executeStatement(sql);
    return mapRows(resp, (row, cols) => ({
      entity_fqn: col(row, cols, "entity_fqn") ?? "",
      layer: col(row, cols, "layer") ?? "",
      latest_status: (col(row, cols, "latest_status") ?? "UNKNOWN").toUpperCase(),
      end_to_end_status: (col(row, cols, "end_to_end_status") ?? "UNKNOWN").toUpperCase(),
      latest_success_at: col(row, cols, "latest_success_at"),
      upstream_entity_fqns: parseJsonArray(col(row, cols, "upstream_entity_fqns")),
      downstream_entity_fqns: parseJsonArray(col(row, cols, "downstream_entity_fqns")),
      lineage_group_id: col(row, cols, "lineage_group_id"),
      last_completed_layer: col(row, cols, "last_completed_layer"),
    }));
  }

  async getLineageAttributes(): Promise<LineageAttribute[]> {
    const columns = await describeColumns("lineage_attributes_current");
    const hasIsCurrent = hasColumn(columns, "is_current");
    const sql = `SELECT source_entity_fqn, source_attribute, target_entity_fqn, target_attribute${hasIsCurrent ? ", is_current" : ", true AS is_current"} FROM ${fqTable("lineage_attributes_current")}${hasIsCurrent ? " WHERE is_current = true" : ""}`;
    const resp = await executeStatement(sql);
    return mapRows(resp, (row, cols) => ({
      source_entity_fqn: col(row, cols, "source_entity_fqn") ?? "",
      source_attribute: col(row, cols, "source_attribute") ?? "",
      target_entity_fqn: col(row, cols, "target_entity_fqn") ?? "",
      target_attribute: col(row, cols, "target_attribute") ?? "",
      is_current: parseBoolean(col(row, cols, "is_current")),
      provenance: "lineage_attributes_current",
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
