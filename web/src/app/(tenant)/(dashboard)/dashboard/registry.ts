import type { ComponentType } from "react";
import { TotalRunsWidget } from "./widgets/total-runs-widget";
import { PassRateWidget } from "./widgets/pass-rate-widget";
import { DqTrendWidget } from "./widgets/dq-trend-widget";
import { PipelineStatusWidget } from "./widgets/pipeline-status-widget";
import { SeverityCategoryWidget } from "./widgets/severity-category-widget";
import { StepDurationWidget } from "./widgets/step-duration-widget";
import { Bcbs239ScoreWidget } from "./widgets/bcbs239-score-widget";
import { FailedRunsWidget } from "./widgets/failed-runs-widget";
import { FailedDqChecksWidget } from "./widgets/failed-dq-checks-widget";
import { WarningDqChecksWidget } from "./widgets/warning-dq-checks-widget";
import { AvgRunDurationWidget } from "./widgets/avg-run-duration-widget";
import { RunsByPipelineWidget } from "./widgets/runs-by-pipeline-widget";
import { DqByCategoryWidget } from "./widgets/dq-by-category-widget";
import { PipelineRunsTableWidget } from "./widgets/pipeline-runs-table-widget";
import { DqChecksTableWidget } from "./widgets/dq-checks-table-widget";
import { EventLogWidget } from "./widgets/event-log-widget";
import { DatasetOverviewWidget } from "./widgets/dataset-overview-widget";
import { FailingDatasetsWidget } from "./widgets/failing-datasets-widget";
import { MonitoredEntitiesWidget } from "./widgets/monitored-entities-widget";
import { OpenIncidentsWidget } from "./widgets/open-incidents-widget";
import { OpenIncidentsTableWidget } from "./widgets/open-incidents-table-widget";
import { PipelineHealthTableWidget } from "./widgets/pipeline-health-table-widget";

export interface WidgetProps {
  from: string;
  to: string;
  titleOverride?: string;
}

export type WidgetCategory = "counter" | "charts" | "tables" | "overview";

export interface WidgetDef {
  type: string;
  label: string;
  description: string;
  category: WidgetCategory;
  timeSemantics: "snapshot" | "period" | "mixed";
  defaultSize: { w: number; h: number; minW: number; minH: number };
  component: ComponentType<WidgetProps>;
}

export const WIDGET_REGISTRY: WidgetDef[] = [
  // ── Counters ────────────────────────────────────────────────────────────
  {
    type: "total-runs",
    label: "Total Runs",
    description: "Count of pipeline runs in the selected period",
    category: "counter",
    timeSemantics: "period",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: TotalRunsWidget,
  },
  {
    type: "failed-runs",
    label: "Failed Runs",
    description: "Count of FAILED pipeline runs in the selected period",
    category: "counter",
    timeSemantics: "period",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: FailedRunsWidget,
  },
  {
    type: "avg-run-duration",
    label: "Avg Run Duration",
    description: "Average duration of pipeline runs in the selected period",
    category: "counter",
    timeSemantics: "period",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: AvgRunDurationWidget,
  },
  {
    type: "warning-dq-checks",
    label: "Warning DQ Checks",
    description: "Count of WARNING data quality checks in the selected period",
    category: "counter",
    timeSemantics: "period",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: WarningDqChecksWidget,
  },
  {
    type: "failed-dq-checks",
    label: "Failed DQ Checks",
    description: "Count of FAILED data quality checks in the selected period",
    category: "counter",
    timeSemantics: "period",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: FailedDqChecksWidget,
  },
  {
    type: "pass-rate",
    label: "Quality Pass Rate",
    description: "Data quality check pass rate percentage in the selected period",
    category: "counter",
    timeSemantics: "period",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: PassRateWidget,
  },
  {
    type: "bcbs239-score",
    label: "BCBS239 Score",
    description: "Overall BCBS239 compliance score",
    category: "counter",
    timeSemantics: "period",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: Bcbs239ScoreWidget,
  },
  {
    type: "monitored-entities",
    label: "Monitored Entities",
    description: "Current number of data entities monitored in this installation",
    category: "counter",
    timeSemantics: "snapshot",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: MonitoredEntitiesWidget,
  },
  {
    type: "open-incidents",
    label: "Open Incidents",
    description: "Current number of open data incidents",
    category: "counter",
    timeSemantics: "snapshot",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: OpenIncidentsWidget,
  },
  // ── Charts ──────────────────────────────────────────────────────────────
  {
    type: "pipeline-status",
    label: "Run Status Trend",
    description: "Stacked bar chart of SUCCESS / WARNING / FAILED runs per day",
    category: "charts",
    timeSemantics: "period",
    defaultSize: { w: 6, h: 4, minW: 4, minH: 3 },
    component: PipelineStatusWidget,
  },
  {
    type: "dq-trend",
    label: "Quality Pass Rate Trend",
    description: "Line chart of data quality pass rate over time",
    category: "charts",
    timeSemantics: "period",
    defaultSize: { w: 6, h: 4, minW: 4, minH: 3 },
    component: DqTrendWidget,
  },
  {
    type: "severity-category",
    label: "Results by Category",
    description: "Bar chart of DQ check results grouped by category",
    category: "charts",
    timeSemantics: "period",
    defaultSize: { w: 6, h: 4, minW: 4, minH: 3 },
    component: SeverityCategoryWidget,
  },
  {
    type: "step-duration",
    label: "Avg Duration by Step",
    description: "Horizontal bar chart of average pipeline step duration",
    category: "charts",
    timeSemantics: "period",
    defaultSize: { w: 6, h: 4, minW: 4, minH: 3 },
    component: StepDurationWidget,
  },
  {
    type: "runs-by-pipeline",
    label: "Runs by Pipeline",
    description: "Horizontal bar chart of run counts per pipeline (top 10)",
    category: "charts",
    timeSemantics: "period",
    defaultSize: { w: 6, h: 4, minW: 4, minH: 3 },
    component: RunsByPipelineWidget,
  },
  {
    type: "dq-by-category",
    label: "DQ Checks by Category",
    description: "Donut chart of data quality check distribution by category",
    category: "charts",
    timeSemantics: "period",
    defaultSize: { w: 4, h: 4, minW: 3, minH: 3 },
    component: DqByCategoryWidget,
  },
  {
    type: "event-log",
    label: "Event Log",
    description: "Timeline of recent pipeline run events with status and duration",
    category: "charts",
    timeSemantics: "period",
    defaultSize: { w: 4, h: 4, minW: 3, minH: 3 },
    component: EventLogWidget,
  },
  {
    type: "failing-datasets",
    label: "Failing Datasets",
    description: "Top datasets ranked by DQ failure rate in the selected period",
    category: "charts",
    timeSemantics: "period",
    defaultSize: { w: 6, h: 4, minW: 4, minH: 3 },
    component: FailingDatasetsWidget,
  },
  // ── Tables ──────────────────────────────────────────────────────────────
  {
    type: "pipeline-runs-table",
    label: "Recent Pipeline Runs",
    description: "Table of pipeline run results in the selected period",
    category: "tables",
    timeSemantics: "period",
    defaultSize: { w: 12, h: 4, minW: 6, minH: 3 },
    component: PipelineRunsTableWidget,
  },
  {
    type: "dq-checks-table",
    label: "DQ Check Results",
    description: "Table of latest data quality check results per check ID",
    category: "tables",
    timeSemantics: "period",
    defaultSize: { w: 8, h: 3, minW: 4, minH: 2 },
    component: DqChecksTableWidget,
  },
  {
    type: "pipeline-health-table",
    label: "Pipeline Health",
    description: "Latest run status per pipeline within the selected period",
    category: "tables",
    timeSemantics: "period",
    defaultSize: { w: 8, h: 4, minW: 4, minH: 3 },
    component: PipelineHealthTableWidget,
  },
  {
    type: "open-incidents-table",
    label: "Open Incidents",
    description: "Current list of active data incidents with severity and status",
    category: "tables",
    timeSemantics: "snapshot",
    defaultSize: { w: 8, h: 4, minW: 4, minH: 3 },
    component: OpenIncidentsTableWidget,
  },
  // ── Overview ────────────────────────────────────────────────────────────
  {
    type: "dataset-overview",
    label: "Dataset Health",
    description: "Dataset health from selected-period runs and checks with current lineage context",
    category: "overview",
    timeSemantics: "mixed",
    defaultSize: { w: 4, h: 4, minW: 3, minH: 2 },
    component: DatasetOverviewWidget,
  },
];

export function getWidgetDef(type: string): WidgetDef | undefined {
  return WIDGET_REGISTRY.find((w) => w.type === type);
}
