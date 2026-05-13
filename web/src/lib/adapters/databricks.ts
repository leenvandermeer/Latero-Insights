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

type EnvironmentScopeCacheEntry = {
  value: string | null;
  expiresAt: number;
};

const schemaCache = new Map<string, SchemaCacheEntry>();
const environmentScopeCache = new Map<string, EnvironmentScopeCacheEntry>();

interface StatementResponse {
  statement_id: string;
  status: { state: string; error?: { message: string } };
  manifest?: { schema: { columns: Array<{ name: string; type_name: string }> } };
  result?: { data_array: string[][] };
}

async function executeStatement(sql: string, params?: Array<{ name: string; value: string; type?: string }>, installationId?: string): Promise<StatementResponse> {
  const settings = loadSettings(installationId);

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

function fqTable(table: string, installationId?: string): string {
  const settings = loadSettings(installationId);
  return `${settings.databricksCatalog}.${settings.databricksSchema}.${table}`;
}

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try { return JSON.parse(value) as string[]; } catch { return []; }
}

function parseBoolean(value: string | null): boolean {
  return value?.toLowerCase() === "true" || value === "1";
}

async function describeColumns(table: string, installationId?: string): Promise<string[]> {
  const key = fqTable(table, installationId);
  const now = Date.now();
  const cached = schemaCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.columns;
  }

  const resp = await executeStatement(`DESCRIBE TABLE ${key}`, undefined, installationId);
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

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

async function resolveEnvironmentScope(table: string, columns: string[], installationId?: string): Promise<string | null> {
  if (!hasColumn(columns, "environment")) {
    return null;
  }

  const settings = loadSettings(installationId);
  const configured = settings.databricksEnvironment.trim();
  if (configured) {
    return configured;
  }

  const key = fqTable(table, installationId);
  const now = Date.now();
  const cached = environmentScopeCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const resp = await executeStatement(
    `SELECT DISTINCT environment FROM ${key} WHERE environment IS NOT NULL AND trim(environment) <> '' AND lower(environment) <> 'demo_dashboard' LIMIT 2`,
    undefined,
    installationId,
  );
  const values = (resp.result?.data_array ?? [])
    .map((row) => row[0]?.trim() ?? "")
    .filter((value) => value.length > 0);
  const resolved = values.length === 1 ? values[0] : null;

  environmentScopeCache.set(key, { value: resolved, expiresAt: now + SCHEMA_CACHE_TTL_MS });
  return resolved;
}

async function liveDataPredicate(table: string, columns: string[], installationId?: string): Promise<string> {
  const predicates: string[] = [];
  const environmentScope = await resolveEnvironmentScope(table, columns, installationId);

  if (environmentScope) {
    predicates.push(`environment = '${escapeSqlString(environmentScope)}'`);
  }

  if (hasColumn(columns, "environment")) {
    predicates.push("(environment IS NULL OR lower(environment) <> 'demo_dashboard')");
  }
  if (hasColumn(columns, "run_id")) {
    predicates.push("(run_id IS NULL OR lower(run_id) NOT LIKE 'demo_meta_%')");
  }

  return predicates.length > 0 ? ` AND ${predicates.join(" AND ")}` : "";
}

async function scopedWhereClause(table: string, columns: string[], basePredicates: string[] = [], installationId?: string): Promise<string> {
  const predicates = [...basePredicates];
  const environmentScope = await resolveEnvironmentScope(table, columns, installationId);

  if (environmentScope) {
    predicates.push(`environment = '${escapeSqlString(environmentScope)}'`);
  }

  return predicates.length > 0 ? ` WHERE ${predicates.join(" AND ")}` : "";
}

export class DatabricksAdapter implements DataAdapter {
  constructor(private installationId?: string) {}

  async getActiveEnvironmentScope(): Promise<string | null> {
    const columns = await describeColumns("runs", this.installationId);
    return resolveEnvironmentScope("runs", columns, this.installationId);
  }

  async getLineageSchemaInventory(): Promise<LineageSchemaInventory> {
    const id = this.installationId;
    const [entities, attributes, hops] = await Promise.all([
      describeColumns("lineage_entities_current", id),
      describeColumns("lineage_attributes_current", id),
      describeColumns("lineage_dataset", id),
    ]);

    return {
      lineage_entities_current: entities,
      lineage_attributes_current: attributes,
      lineage_dataset: hops,
    };
  }

  async getPipelineRuns(range: DateRange): Promise<PipelineRun[]> {
    const id = this.installationId;
    const columns = await describeColumns("runs", id);
    // source_layer/target_layer: LMETA-015 — aanwezig in Databricks workspace.meta.runs
    const optional = ["job_name", "parent_run_id", "source_layer", "target_layer"]
      .filter((name) => hasColumn(columns, name));
    const sql = `SELECT event_type, timestamp_utc, event_date, dataset_id, source_system, run_id, run_status, duration_ms, environment${optional.length > 0 ? `, ${optional.join(", ")}` : ""} FROM ${fqTable("runs", id)} WHERE event_date >= '${escapeSqlString(range.from)}' AND event_date <= '${escapeSqlString(range.to)}'${await liveDataPredicate("runs", columns, id)} ORDER BY timestamp_utc DESC`;
    const resp = await executeStatement(sql, undefined, id);
    return mapRows(resp, (row, cols) => ({
      event_type: col(row, cols, "event_type") ?? "",
      timestamp_utc: col(row, cols, "timestamp_utc") ?? "",
      event_date: col(row, cols, "event_date") ?? "",
      dataset_id: col(row, cols, "dataset_id") ?? "",
      source_system: col(row, cols, "source_system") ?? "",
      run_id: col(row, cols, "run_id") ?? "",
      run_status: col(row, cols, "run_status") ?? "",
      duration_ms: col(row, cols, "duration_ms") ? Number(col(row, cols, "duration_ms")) : null,
      environment: col(row, cols, "environment"),
      job_name: col(row, cols, "job_name"),
      parent_run_id: col(row, cols, "parent_run_id"),
      source_layer: col(row, cols, "source_layer"),
      target_layer: col(row, cols, "target_layer"),
    }));
  }

  async getDataQualityChecks(range: DateRange): Promise<DataQualityCheck[]> {
    const id = this.installationId;
    const columns = await describeColumns("dq_results", id);
    // Databricks heeft 'check_facets' (nieuwere schema) of 'check_result' (oudere schema)
    const checkResultCol = preferredColumn(columns, "check_result", "check_facets");
    const optional = ["environment", "severity", "check_mode", "parent_run_id"]
      .filter((name) => hasColumn(columns, name));
    const checkResultExpr = checkResultCol ? `, ${checkResultCol} AS check_result` : "";
    const sql = `SELECT event_type, timestamp_utc, event_date, dataset_id, run_id, check_id, check_status, check_category, policy_version${optional.length > 0 ? `, ${optional.join(", ")}` : ""}${checkResultExpr} FROM ${fqTable("dq_results", id)} WHERE event_date >= '${escapeSqlString(range.from)}' AND event_date <= '${escapeSqlString(range.to)}'${await liveDataPredicate("dq_results", columns, id)} ORDER BY timestamp_utc DESC`;
    const resp = await executeStatement(sql, undefined, id);
    return mapRows(resp, (row, cols) => ({
      event_type: col(row, cols, "event_type") ?? "",
      timestamp_utc: col(row, cols, "timestamp_utc") ?? "",
      event_date: col(row, cols, "event_date") ?? "",
      dataset_id: col(row, cols, "dataset_id") ?? "",
      run_id: col(row, cols, "run_id") ?? "",
      check_id: col(row, cols, "check_id") ?? "",
      check_status: col(row, cols, "check_status") ?? "",
      check_category: col(row, cols, "check_category"),
      policy_version: col(row, cols, "policy_version"),
      severity: col(row, cols, "severity"),
      environment: col(row, cols, "environment"),
      check_mode: col(row, cols, "check_mode"),
      check_result: col(row, cols, "check_result"),
      parent_run_id: col(row, cols, "parent_run_id"),
    }));
  }

  async getLineageHops(range: DateRange): Promise<LineageHop[]> {
    const id = this.installationId;
    const columns = await describeColumns("lineage_dataset", id);
    // source_attribute/target_attribute: bestaan niet in de huidige Databricks-tabel
    const sourceAttributeExpr = hasColumn(columns, "source_attribute") ? "source_attribute" : "CAST(NULL AS STRING) AS source_attribute";
    const targetAttributeExpr = hasColumn(columns, "target_attribute") ? "target_attribute" : "CAST(NULL AS STRING) AS target_attribute";
    // source_layer/target_layer: aanwezig in workspace.meta.lineage_dataset (LMETA-014)
    const optional = [
      "source_system", "installation_id", "environment", "schema_version",
      "hop_kind", "source_layer", "target_layer", "lineage_group_id",
    ].filter((name) => hasColumn(columns, name));
    const sql = `SELECT event_type, timestamp_utc, event_date, dataset_id, run_id, source_entity, source_type, source_ref, ${sourceAttributeExpr}, target_entity, target_type, target_ref, ${targetAttributeExpr}${optional.length > 0 ? `, ${optional.join(", ")}` : ""} FROM ${fqTable("lineage_dataset", id)} WHERE event_date >= '${escapeSqlString(range.from)}' AND event_date <= '${escapeSqlString(range.to)}'${await liveDataPredicate("lineage_dataset", columns, id)} ORDER BY timestamp_utc DESC`;
    const resp = await executeStatement(sql, undefined, id);
    return mapRows(resp, (row, cols) => ({
      event_type: col(row, cols, "event_type") ?? "",
      timestamp_utc: col(row, cols, "timestamp_utc") ?? "",
      event_date: col(row, cols, "event_date") ?? "",
      dataset_id: col(row, cols, "dataset_id") ?? "",
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
      hop_kind: col(row, cols, "hop_kind"),
      source_layer: col(row, cols, "source_layer"),
      target_layer: col(row, cols, "target_layer"),
      lineage_group_id: col(row, cols, "lineage_group_id"),
    }));
  }

  async getLineageEntities(): Promise<LineageEntity[]> {
    // LADR-079: DEPRECATED - This method reads directly from Databricks without entity_guid.
    // Production must use getLineageEntitiesFromSaaS() which reads from Postgres meta.datasets
    // with stable entity_guid. Use POST /api/sync/databricks to sync Databricks → Postgres first.
    throw new Error(
      "DatabricksAdapter.getLineageEntities() is deprecated (LADR-079). " +
      "Use getLineageEntitiesFromSaaS() to read from Postgres meta.datasets with entity_guid. " +
      "Run POST /api/sync/databricks to sync Databricks data first."
    );
  }

  async getLineageAttributes(asOf?: string): Promise<LineageAttribute[]> {
    const id = this.installationId;
    const columns = await describeColumns("lineage_attributes_current", id);
    const hasIsCurrent = hasColumn(columns, "is_current");
    const hasValidFrom = hasColumn(columns, "valid_from");
    const datasetColumn = preferredColumn(columns, "dataset_id");
    const sourceLayerColumn = preferredColumn(columns, "source_layer");
    const targetLayerColumn = preferredColumn(columns, "target_layer");
    // OpenLineage ColumnLineageFacet: Databricks heeft is_direct (boolean) + transformation_mode (string)
    // is_direct=true → DIRECT, is_direct=false → INDIRECT (OL standaard)
    const hasIsDirectCol = hasColumn(columns, "is_direct");
    const hasTransformationMode = hasColumn(columns, "transformation_mode");
    const isDirectExpr = hasIsDirectCol
      ? ", CASE WHEN is_direct = true THEN 'DIRECT' WHEN is_direct = false THEN 'INDIRECT' ELSE 'UNKNOWN' END AS transformation_type"
      : ", CAST('UNKNOWN' AS STRING) AS transformation_type";
    const transformationModeExpr = hasTransformationMode
      ? ", transformation_mode AS transformation_subtype"
      : ", CAST(NULL AS STRING) AS transformation_subtype";
    const validFromExpr = hasValidFrom ? ", valid_from, valid_to" : ", CAST(NULL AS STRING) AS valid_from, CAST(NULL AS STRING) AS valid_to";

    // Point-in-time filter: when asOf is provided and the table has SCD2 columns, filter
    // to rows whose validity window covers the requested date. Falls back to is_current=true
    // when the column is absent (pre-migration instances).
    let whereConditions: string[];
    if (asOf && hasValidFrom) {
      whereConditions = [`'${asOf}' >= valid_from`, `(valid_to IS NULL OR '${asOf}' < valid_to)`];
    } else {
      whereConditions = hasIsCurrent ? ["is_current = true"] : [];
    }

    const sql = `SELECT ${datasetColumn ? `${datasetColumn} AS dataset_id, ` : "CAST(NULL AS STRING) AS dataset_id, "}source_entity_fqn AS source_name, source_attribute, target_entity_fqn AS target_name, target_attribute${sourceLayerColumn ? `, ${sourceLayerColumn} AS source_layer` : ", CAST(NULL AS STRING) AS source_layer"}${targetLayerColumn ? `, ${targetLayerColumn} AS target_layer` : ", CAST(NULL AS STRING) AS target_layer"}${hasIsCurrent ? ", is_current" : ", true AS is_current"}${validFromExpr}${isDirectExpr}${transformationModeExpr} FROM ${fqTable("lineage_attributes_current", id)}${await scopedWhereClause("lineage_attributes_current", columns, whereConditions, id)}`;
    const resp = await executeStatement(sql, undefined, id);
    return mapRows(resp, (row, cols) => ({
      dataset_id: col(row, cols, "dataset_id"),
      source_name: col(row, cols, "source_name") ?? "",
      source_attribute: col(row, cols, "source_attribute") ?? "",
      target_name: col(row, cols, "target_name") ?? "",
      target_attribute: col(row, cols, "target_attribute") ?? "",
      source_layer: col(row, cols, "source_layer"),
      target_layer: col(row, cols, "target_layer"),
      is_current: parseBoolean(col(row, cols, "is_current")),
      valid_from: col(row, cols, "valid_from") ?? null,
      valid_to: col(row, cols, "valid_to") ?? null,
      transformation_type: (col(row, cols, "transformation_type") as "DIRECT" | "INDIRECT" | "UNKNOWN" | null) ?? "UNKNOWN",
      transformation_subtype: col(row, cols, "transformation_subtype"),
      provenance: "lineage_attributes_current",
    }));
  }

  async getLineageAttributeHistory(): Promise<LineageAttribute[]> {
    const id = this.installationId;
    const rawTable = "lineage_attribute";
    const columns = await describeColumns(rawTable, id);

    // Fall back to current-only if SCD2 columns not yet present on this instance.
    if (!hasColumn(columns, "valid_from")) {
      return this.getLineageAttributes();
    }

    const sourceLayerExpr = hasColumn(columns, "source_layer") ? "source_layer" : "CAST(NULL AS STRING) AS source_layer";
    const targetLayerExpr = hasColumn(columns, "target_layer") ? "target_layer" : "CAST(NULL AS STRING) AS target_layer";
    const transformationExpr = hasColumn(columns, "transformation_mode")
      ? "transformation_mode AS transformation_type"
      : "CAST('UNKNOWN' AS STRING) AS transformation_type";
    const datasetExpr = hasColumn(columns, "dataset_id") ? "dataset_id" : "CAST(NULL AS STRING) AS dataset_id";

    const basePredicates = [
      "lineage_group_id IS NOT NULL",
      "target_attribute IS NOT NULL",
      "COALESCE(hop_kind, 'data_flow') != 'context'",
    ];

    const sql = `
      SELECT
        ${datasetExpr},
        source_entity   AS source_name,
        source_attribute,
        target_entity   AS target_name,
        target_attribute,
        ${sourceLayerExpr},
        ${targetLayerExpr},
        valid_from,
        valid_to,
        is_current,
        ${transformationExpr}
      FROM ${fqTable(rawTable, id)}
      ${await scopedWhereClause(rawTable, columns, basePredicates, id)}
    `;

    const resp = await executeStatement(sql, undefined, id);
    return mapRows(resp, (row, cols) => ({
      dataset_id: col(row, cols, "dataset_id"),
      source_name: col(row, cols, "source_name") ?? "",
      source_attribute: col(row, cols, "source_attribute") ?? "",
      target_name: col(row, cols, "target_name") ?? "",
      target_attribute: col(row, cols, "target_attribute") ?? "",
      source_layer: col(row, cols, "source_layer"),
      target_layer: col(row, cols, "target_layer"),
      valid_from: col(row, cols, "valid_from"),
      valid_to: col(row, cols, "valid_to"),
      is_current: parseBoolean(col(row, cols, "is_current")),
      transformation_type: (col(row, cols, "transformation_type") as "DIRECT" | "INDIRECT" | "UNKNOWN" | null) ?? "UNKNOWN",
      provenance: "lineage_attributes_current",
    }));
  }

  async getFieldValueReferences(): Promise<import("@/lib/widget-field-reference").FieldReference[]> {
    const id = this.installationId;
    try {
      const columns = await describeColumns("widget_field_values", id);
      if (columns.length === 0) return [];
      const sql = `SELECT field_name, field_value, label FROM ${fqTable("widget_field_values", id)} ORDER BY field_name, field_value`;
      const resp = await executeStatement(sql, undefined, id);
      const rows = mapRows(resp, (row, cols) => ({
        field: col(row, cols, "field_name") ?? "",
        value: col(row, cols, "field_value") ?? "",
        label: col(row, cols, "label") ?? "",
      })).filter((r) => r.field && r.value);

      const grouped = new Map<string, { value: string; label: string }[]>();
      for (const r of rows) {
        const existing = grouped.get(r.field) ?? [];
        existing.push({ value: r.value, label: r.label || r.value });
        grouped.set(r.field, existing);
      }
      return [...grouped.entries()].map(([field, values]) => ({ field, label: field, values }));
    } catch {
      return [];
    }
  }

  async testConnection(): Promise<boolean> {
    const id = this.installationId;
    try {
      const resp = await executeStatement("SELECT 1", undefined, id);
      return resp.status.state === "SUCCEEDED";
    } catch {
      return false;
    }
  }
}
