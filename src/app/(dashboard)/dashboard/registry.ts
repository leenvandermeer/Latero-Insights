import type { ComponentType } from "react";
import { TotalRunsWidget } from "./widgets/total-runs-widget";
import { PassRateWidget } from "./widgets/pass-rate-widget";
import { DqTrendWidget } from "./widgets/dq-trend-widget";
import { PipelineStatusWidget } from "./widgets/pipeline-status-widget";
import { SeverityCategoryWidget } from "./widgets/severity-category-widget";
import { StepDurationWidget } from "./widgets/step-duration-widget";
import { Bcbs239ScoreWidget } from "./widgets/bcbs239-score-widget";
import { FailedRunsWidget } from "./widgets/failed-runs-widget";
import { SuccessRunsWidget } from "./widgets/success-runs-widget";
import { WarningRunsWidget } from "./widgets/warning-runs-widget";
import { TotalDqChecksWidget } from "./widgets/total-dq-checks-widget";
import { FailedDqChecksWidget } from "./widgets/failed-dq-checks-widget";
import { WarningDqChecksWidget } from "./widgets/warning-dq-checks-widget";
import { SuccessDqChecksWidget } from "./widgets/success-dq-checks-widget";
import { AvgRunDurationWidget } from "./widgets/avg-run-duration-widget";
import { UniquePipelinesWidget } from "./widgets/unique-pipelines-widget";
import { UniqueCheckTypesWidget } from "./widgets/unique-check-types-widget";
import { RunsByPipelineWidget } from "./widgets/runs-by-pipeline-widget";
import { DqByCategoryWidget } from "./widgets/dq-by-category-widget";
import { PipelineRunsTableWidget } from "./widgets/pipeline-runs-table-widget";
import { DqChecksTableWidget } from "./widgets/dq-checks-table-widget";
import { EventLogWidget } from "./widgets/event-log-widget";
import { DatasetOverviewWidget } from "./widgets/dataset-overview-widget";

export interface WidgetProps {
  from: string;
  to: string;
  titleOverride?: string;
}

export type WidgetCategory = "counter" | "chart" | "table" | "overview";

export interface WidgetDef {
  type: string;
  label: string;
  description: string;
  category: WidgetCategory;
  defaultSize: { w: number; h: number; minW: number; minH: number };
  component: ComponentType<WidgetProps>;
}

export const WIDGET_REGISTRY: WidgetDef[] = [
  {
    type: "total-runs",
    label: "Total Runs",
    description: "Count of pipeline runs in the selected period",
    category: "counter",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: TotalRunsWidget,
  },
  {
    type: "failed-runs",
    label: "Failed Runs",
    description: "Count of FAILED pipeline runs in the selected period",
    category: "counter",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: FailedRunsWidget,
  },
  {
    type: "success-runs",
    label: "Successful Runs",
    description: "Count of SUCCESS pipeline runs in the selected period",
    category: "counter",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: SuccessRunsWidget,
  },
  {
    type: "warning-runs",
    label: "Warning Runs",
    description: "Count of WARNING pipeline runs in the selected period",
    category: "counter",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: WarningRunsWidget,
  },
  {
    type: "avg-run-duration",
    label: "Avg Run Duration",
    description: "Average duration of pipeline runs in the selected period",
    category: "counter",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: AvgRunDurationWidget,
  },
  {
    type: "unique-pipelines",
    label: "Unique Pipelines",
    description: "Number of distinct pipelines active in the selected period",
    category: "counter",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: UniquePipelinesWidget,
  },
  {
    type: "total-dq-checks",
    label: "Total DQ Checks",
    description: "Total number of data quality checks in the selected period",
    category: "counter",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: TotalDqChecksWidget,
  },
  {
    type: "success-dq-checks",
    label: "Passed DQ Checks",
    description: "Count of PASSED data quality checks in the selected period",
    category: "counter",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: SuccessDqChecksWidget,
  },
  {
    type: "warning-dq-checks",
    label: "Warning DQ Checks",
    description: "Count of WARNING data quality checks in the selected period",
    category: "counter",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: WarningDqChecksWidget,
  },
  {
    type: "failed-dq-checks",
    label: "Failed DQ Checks",
    description: "Count of FAILED data quality checks in the selected period",
    category: "counter",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: FailedDqChecksWidget,
  },
  {
    type: "unique-check-types",
    label: "Unique Check Types",
    description: "Number of distinct DQ check IDs active in the selected period",
    category: "counter",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: UniqueCheckTypesWidget,
  },
  {
    type: "pass-rate",
    label: "DQ Pass Rate",
    description: "Data quality check pass rate percentage",
    category: "counter",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: PassRateWidget,
  },
  {
    type: "bcbs239-score",
    label: "BCBS239 Score",
    description: "Overall BCBS239 compliance score",
    category: "counter",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: Bcbs239ScoreWidget,
  },
  {
    type: "pipeline-status",
    label: "Run Status Trend",
    description: "Stacked bar chart of SUCCESS / WARNING / FAILED runs per day",
    category: "chart",
    defaultSize: { w: 6, h: 4, minW: 4, minH: 3 },
    component: PipelineStatusWidget,
  },
  {
    type: "dq-trend",
    label: "DQ Pass Rate Trend",
    description: "Line chart of data quality pass rate over time",
    category: "chart",
    defaultSize: { w: 6, h: 4, minW: 4, minH: 3 },
    component: DqTrendWidget,
  },
  {
    type: "severity-category",
    label: "Results by Category",
    description: "Bar chart of DQ check results grouped by category",
    category: "chart",
    defaultSize: { w: 6, h: 4, minW: 4, minH: 3 },
    component: SeverityCategoryWidget,
  },
  {
    type: "step-duration",
    label: "Avg Duration by Step",
    description: "Horizontal bar chart of average pipeline step duration",
    category: "chart",
    defaultSize: { w: 6, h: 4, minW: 4, minH: 3 },
    component: StepDurationWidget,
  },
  {
    type: "runs-by-pipeline",
    label: "Runs by Pipeline",
    description: "Horizontal bar chart of run counts per pipeline (top 10)",
    category: "chart",
    defaultSize: { w: 6, h: 4, minW: 4, minH: 3 },
    component: RunsByPipelineWidget,
  },
  {
    type: "dq-by-category",
    label: "DQ Checks by Category",
    description: "Donut chart of data quality check distribution by category",
    category: "chart",
    defaultSize: { w: 4, h: 4, minW: 3, minH: 3 },
    component: DqByCategoryWidget,
  },
  {
    type: "pipeline-runs-table",
    label: "Recent Pipeline Runs",
    description: "Table of latest pipeline run results with status and duration",
    category: "table",
    defaultSize: { w: 12, h: 4, minW: 6, minH: 3 },
    component: PipelineRunsTableWidget,
  },
  {
    type: "dq-checks-table",
    label: "DQ Check Results",
    description: "Table of latest data quality check results per check ID",
    category: "table",
    defaultSize: { w: 12, h: 4, minW: 6, minH: 3 },
    component: DqChecksTableWidget,
  },
  {
    type: "event-log",
    label: "Event Log",
    description: "Timeline of recent pipeline run events with status and duration",
    category: "chart",
    defaultSize: { w: 4, h: 4, minW: 3, minH: 3 },
    component: EventLogWidget,
  },
  {
    type: "dataset-overview",
    label: "Dataset Health",
    description: "Compact scrollable overview of all datasets with DQ status, lineage depth and last run time",
    category: "overview",
    defaultSize: { w: 4, h: 4, minW: 3, minH: 2 },
    component: DatasetOverviewWidget,
  },
];

export function getWidgetDef(type: string): WidgetDef | undefined {
  return WIDGET_REGISTRY.find((w) => w.type === type);
}
