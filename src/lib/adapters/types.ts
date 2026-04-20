export interface PipelineRun {
  event_type: string;
  timestamp_utc: string;
  event_date: string;
  dataset_id: string;
  source_system: string;
  step: string;
  run_id: string;
  run_status: string;
  duration_ms: number | null;
  environment: string | null;
}

export interface DataQualityCheck {
  event_type: string;
  timestamp_utc: string;
  event_date: string;
  dataset_id: string;
  step: string;
  run_id: string;
  check_id: string;
  check_status: string;
  check_category: string | null;
  policy_version: string | null;
}

export interface LineageHop {
  event_type: string;
  timestamp_utc: string;
  event_date: string;
  dataset_id: string;
  step: string;
  run_id: string;
  source_entity: string;
  source_type: string;
  source_ref: string;
  source_attribute: string | null;
  target_entity: string;
  target_type: string;
  target_ref: string;
  target_attribute: string | null;
}

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;
}

export interface DataAdapter {
  getPipelineRuns(range: DateRange): Promise<PipelineRun[]>;
  getDataQualityChecks(range: DateRange): Promise<DataQualityCheck[]>;
  getLineageHops(range: DateRange): Promise<LineageHop[]>;
  testConnection(): Promise<boolean>;
}
