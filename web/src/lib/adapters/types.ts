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
  job_name?: string | null;
  parent_run_id?: string | null;
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
  environment?: string | null;
  check_mode?: string | null;
  check_result?: string | null;
  parent_run_id?: string | null;
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
  source_system?: string | null;
  installation_id?: string | null;
  environment?: string | null;
  schema_version?: string | null;
  lineage_evidence?: string | null;
  hop_kind?: string | null;
}

export interface LineageEntity {
  dataset_id?: string | null;
  entity_fqn: string;
  layer: string;
  latest_status: string;          // "SUCCESS" | "FAILED" | "WARNING" | "UNKNOWN"
  end_to_end_status: string;      // "SUCCESS" | "PARTIAL" | "FAILED" | "UNKNOWN"
  latest_success_at: string | null;
  upstream_entity_fqns: string[];
  downstream_entity_fqns: string[];
  lineage_group_id: string | null;
  last_completed_layer: string | null;
}

export interface LineageAttribute {
  dataset_id?: string | null;
  source_entity_fqn: string;
  source_attribute: string;
  target_entity_fqn: string;
  target_attribute: string;
  source_layer?: string | null;
  target_layer?: string | null;
  is_current: boolean;
  provenance?: "lineage_attributes_current";
  evidence?: string | null;
}

export interface LineageSchemaInventory {
  lineage_entities_current: string[];
  lineage_attributes_current: string[];
  data_lineage: string[];
}

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;
}

export interface DataAdapter {
  getPipelineRuns(range: DateRange): Promise<PipelineRun[]>;
  getDataQualityChecks(range: DateRange): Promise<DataQualityCheck[]>;
  getLineageHops(range: DateRange): Promise<LineageHop[]>;
  getLineageEntities(): Promise<LineageEntity[]>;
  getLineageAttributes(): Promise<LineageAttribute[]>;
  getLineageSchemaInventory(): Promise<LineageSchemaInventory>;
  getFieldValueReferences(): Promise<import("@/lib/widget-field-reference").FieldReference[]>;
  testConnection(): Promise<boolean>;
}
