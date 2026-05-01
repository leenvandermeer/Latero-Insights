import type { ResponsiveLayouts } from "react-grid-layout";

// ─── Widget slot ────────────────────────────────────────────────────────────

export interface WidgetSlot {
  instanceId: string;
  type: string;              // registry key ("total-runs") or "custom" for custom widgets
  customWidgetId?: string;   // only when type === "custom"
  titleOverride?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ─── Custom widget ───────────────────────────────────────────────────────────

export type DataSource = "pipeline_runs" | "data_quality_checks" | "data_lineage";

export type MeasureType = "count" | "count_where" | "percentage" | "avg";

export type VisualType = "counter" | "bar" | "line" | "area" | "donut" | "table";

export type WidgetCategory = "counter" | "charts" | "tables" | "overview";

export interface Measure {
  type: MeasureType;
  field?: string;    // for avg: "duration_ms"
  whereField?: string;  // for count_where / percentage: e.g. "run_status"
  whereValue?: string;  // e.g. "SUCCESS"
}

export interface GroupBy {
  field: string;
  timeGrain?: "day" | "week" | "month";
}

export interface QueryFilter {
  field: string;
  operator: "eq" | "neq" | "contains" | "gt" | "lt";
  value: string;
}

export interface QueryConfig {
  dataSource: DataSource;
  measure: Measure;
  groupBy?: GroupBy;
  filters: QueryFilter[];
}

export interface CustomWidget {
  id: string;
  label: string;
  description?: string;
  queryConfig: QueryConfig;
  visualType: VisualType;
  templateType?: string;
  category?: WidgetCategory;
  createdAt: string;
}

// ─── Shared (org-level) widget ───────────────────────────────────────────────

export interface SharedWidgetDef {
  id: string;
  label: string;
  description?: string;
  // Only present for data-driven (QueryEngine) widgets; absent for template widgets.
  queryConfig?: QueryConfig;
  visualType?: VisualType;
  // Registry key for prebuilt template widgets (pipeline-status, dq-trend, etc.).
  templateType?: string;
  category?: WidgetCategory;
  defaultSize: { w: number; h: number; minW: number; minH: number };
  publishedAt: string;
  publishedBy?: string;
  // LINS-016: Tenant scope — widget belongs to this installation
  installation_id: string;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  layoutVersion?: number;
  widgets: WidgetSlot[];
  layout: ResponsiveLayouts;
  createdAt: string;
  updatedAt: string;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export interface DashboardStoreData {
  dashboards: Dashboard[];
  customWidgets: CustomWidget[];
  activeId: string | null;
}
