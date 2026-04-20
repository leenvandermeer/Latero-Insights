import type { ComponentType } from "react";
import { TotalRunsWidget } from "./widgets/total-runs-widget";
import { PassRateWidget } from "./widgets/pass-rate-widget";
import { DqTrendWidget } from "./widgets/dq-trend-widget";
import { PipelineStatusWidget } from "./widgets/pipeline-status-widget";
import { SeverityCategoryWidget } from "./widgets/severity-category-widget";
import { StepDurationWidget } from "./widgets/step-duration-widget";
import { Bcbs239ScoreWidget } from "./widgets/bcbs239-score-widget";
import { FailedRunsWidget } from "./widgets/failed-runs-widget";
import { PipelineRunsTableWidget } from "./widgets/pipeline-runs-table-widget";
import { DqChecksTableWidget } from "./widgets/dq-checks-table-widget";
import { EventLogWidget } from "./widgets/event-log-widget";
import { DatasetOverviewWidget } from "./widgets/dataset-overview-widget";

export interface WidgetProps {
  from: string;
  to: string;
  titleOverride?: string;
}

export interface WidgetDef {
  type: string;
  label: string;
  description: string;
  defaultSize: { w: number; h: number; minW: number; minH: number };
  component: ComponentType<WidgetProps>;
}

export const WIDGET_REGISTRY: WidgetDef[] = [
  {
    type: "total-runs",
    label: "Total Runs",
    description: "Count of pipeline runs in the selected period",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: TotalRunsWidget,
  },
  {
    type: "failed-runs",
    label: "Failed Runs",
    description: "Count of FAILED pipeline runs in the selected period",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: FailedRunsWidget,
  },
  {
    type: "pass-rate",
    label: "DQ Pass Rate",
    description: "Data quality check pass rate percentage",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: PassRateWidget,
  },
  {
    type: "bcbs239-score",
    label: "BCBS239 Score",
    description: "Overall BCBS239 compliance score",
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    component: Bcbs239ScoreWidget,
  },
  {
    type: "pipeline-status",
    label: "Run Status Trend",
    description: "Stacked bar chart of SUCCESS / WARNING / FAILED runs per day",
    defaultSize: { w: 6, h: 4, minW: 4, minH: 3 },
    component: PipelineStatusWidget,
  },
  {
    type: "dq-trend",
    label: "DQ Pass Rate Trend",
    description: "Line chart of data quality pass rate over time",
    defaultSize: { w: 6, h: 4, minW: 4, minH: 3 },
    component: DqTrendWidget,
  },
  {
    type: "severity-category",
    label: "Results by Category",
    description: "Bar chart of DQ check results grouped by category",
    defaultSize: { w: 6, h: 4, minW: 4, minH: 3 },
    component: SeverityCategoryWidget,
  },
  {
    type: "step-duration",
    label: "Avg Duration by Step",
    description: "Horizontal bar chart of average pipeline step duration",
    defaultSize: { w: 6, h: 4, minW: 4, minH: 3 },
    component: StepDurationWidget,
  },
  {
    type: "pipeline-runs-table",
    label: "Recent Pipeline Runs",
    description: "Table of latest pipeline run results with status and duration",
    defaultSize: { w: 12, h: 4, minW: 6, minH: 3 },
    component: PipelineRunsTableWidget,
  },
  {
    type: "dq-checks-table",
    label: "DQ Check Results",
    description: "Table of latest data quality check results per check ID",
    defaultSize: { w: 12, h: 4, minW: 6, minH: 3 },
    component: DqChecksTableWidget,
  },
  {
    type: "event-log",
    label: "Event Log",
    description: "Timeline of recent pipeline run events with status and duration",
    defaultSize: { w: 4, h: 4, minW: 3, minH: 3 },
    component: EventLogWidget,
  },
  {
    type: "dataset-overview",
    label: "Dataset Health",
    description: "Compact scrollable overview of all datasets with DQ status, lineage depth and last run time",
    defaultSize: { w: 4, h: 4, minW: 3, minH: 2 },
    component: DatasetOverviewWidget,
  },
];

export function getWidgetDef(type: string): WidgetDef | undefined {
  return WIDGET_REGISTRY.find((w) => w.type === type);
}
