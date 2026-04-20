import type { QueryConfig, QueryFilter, GroupBy, Measure } from "@/types/dashboard";

// ─── Field accessors per data source ─────────────────────────────────────────

export const DATA_SOURCE_LABELS: Record<string, string> = {
  pipeline_runs: "Pipeline Runs",
  data_quality_checks: "DQ Checks",
  data_lineage: "Lineage Hops",
};

export const DATA_SOURCE_FIELDS: Record<string, string[]> = {
  pipeline_runs: ["dataset_id", "step", "run_status", "source_system", "event_date"],
  data_quality_checks: ["dataset_id", "check_id", "check_category", "check_status", "step", "event_date"],
  data_lineage: ["source_entity", "target_entity", "step", "event_date"],
};

export const FIELD_LABELS: Record<string, string> = {
  dataset_id: "Dataset",
  step: "Step",
  run_status: "Run Status",
  source_system: "Source System",
  event_date: "Date",
  check_id: "Check ID",
  check_category: "Category",
  check_status: "Check Status",
  source_entity: "Source Entity",
  target_entity: "Target Entity",
};

export const NUMERIC_FIELDS: Record<string, string[]> = {
  pipeline_runs: ["duration_ms"],
  data_quality_checks: [],
  data_lineage: [],
};

// ─── Query result types ───────────────────────────────────────────────────────

export type QueryRow = Record<string, string | number>;

export interface QueryResult {
  rows: QueryRow[];
  measureLabel: string;
  groupByLabel?: string;
}

// ─── Filter application ───────────────────────────────────────────────────────

function matchesFilter(record: Record<string, unknown>, filter: QueryFilter): boolean {
  const val = String(record[filter.field] ?? "").toLowerCase();
  const target = filter.value.toLowerCase();
  switch (filter.operator) {
    case "eq": return val === target;
    case "neq": return val !== target;
    case "contains": return val.includes(target);
    case "gt": return Number(val) > Number(target);
    case "lt": return Number(val) < Number(target);
    default: return true;
  }
}

function applyFilters(records: Record<string, unknown>[], filters: QueryFilter[]): Record<string, unknown>[] {
  if (!filters.length) return records;
  return records.filter((r) => filters.every((f) => matchesFilter(r, f)));
}

// ─── Date grouping ────────────────────────────────────────────────────────────

function truncateDate(dateStr: string, grain: GroupBy["timeGrain"]): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  if (grain === "week") {
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
  }
  if (grain === "month") return dateStr.slice(0, 7);
  return dateStr.slice(0, 10);
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

function computeMeasureLabel(measure: Measure): string {
  switch (measure.type) {
    case "count": return "Count";
    case "count_where": return `Count (${measure.whereValue ?? "filtered"})`;
    case "percentage": return `% ${measure.whereValue ?? ""}`;
    case "avg": return `Avg ${measure.field ?? "value"}`;
    default: return "Value";
  }
}

function aggregate(
  records: Record<string, unknown>[],
  measure: Measure,
  groupBy?: GroupBy
): QueryRow[] {
  if (!groupBy) {
    // Single value
    const value = computeSingleValue(records, measure);
    return [{ _value: value }];
  }

  const groups = new Map<string, Record<string, unknown>[]>();
  for (const r of records) {
    let key = String(r[groupBy.field] ?? "");
    if (groupBy.field === "event_date" && groupBy.timeGrain) {
      key = truncateDate(key, groupBy.timeGrain);
    }
    const bucket = groups.get(key) ?? [];
    bucket.push(r);
    groups.set(key, bucket);
  }

  return Array.from(groups.entries())
    .map(([key, bucket]) => ({
      [groupBy.field]: key,
      _value: computeSingleValue(bucket, measure),
    }))
    .sort((a, b) => String(a[groupBy.field]).localeCompare(String(b[groupBy.field])));
}

function computeSingleValue(records: Record<string, unknown>[], measure: Measure): number {
  switch (measure.type) {
    case "count":
      return records.length;
    case "count_where": {
      if (!measure.whereField || !measure.whereValue) return 0;
      return records.filter(
        (r) => String(r[measure.whereField!] ?? "").toUpperCase() === measure.whereValue!.toUpperCase()
      ).length;
    }
    case "percentage": {
      if (!measure.whereField || !measure.whereValue || !records.length) return 0;
      const passed = records.filter(
        (r) => String(r[measure.whereField!] ?? "").toUpperCase() === measure.whereValue!.toUpperCase()
      ).length;
      return Math.round((passed / records.length) * 100);
    }
    case "avg": {
      if (!measure.field || !records.length) return 0;
      const nums = records.map((r) => Number(r[measure.field!])).filter((n) => !isNaN(n));
      if (!nums.length) return 0;
      return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
    }
    default:
      return 0;
  }
}

// ─── Main query execution ─────────────────────────────────────────────────────

export function executeQuery(
  rawData: Record<string, unknown>[],
  config: QueryConfig
): QueryResult {
  const filtered = applyFilters(rawData, config.filters);
  const rows = aggregate(filtered, config.measure, config.groupBy);

  return {
    rows,
    measureLabel: computeMeasureLabel(config.measure),
    groupByLabel: config.groupBy ? (FIELD_LABELS[config.groupBy.field] ?? config.groupBy.field) : undefined,
  };
}

// ─── API endpoint resolver ────────────────────────────────────────────────────

export function getApiEndpoint(dataSource: string): string {
  switch (dataSource) {
    case "pipeline_runs": return "/api/pipelines";
    case "data_quality_checks": return "/api/quality";
    case "data_lineage": return "/api/lineage";
    default: return "/api/pipelines";
  }
}
