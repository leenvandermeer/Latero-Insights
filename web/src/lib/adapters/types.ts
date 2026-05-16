export interface PipelineRun {
  event_type: string;
  timestamp_utc: string;
  event_date: string;
  dataset_id: string;
  source_system: string;
  run_id: string;
  run_status: string;
  duration_ms: number | null;
  environment: string | null;
  job_name?: string | null;
  parent_run_id?: string | null;
  // LMETA-015: logische pipelinelagen (landing/raw/bronze/silver/gold)
  source_layer?: string | null;
  target_layer?: string | null;
  // Databricks multi-task job context
  dbx_job_run_id?: string | null;
  dbx_task_run_id?: string | null;
  task_key?: string | null;
}

export interface DataQualityCheck {
  event_type: string;
  timestamp_utc: string;
  event_date: string;
  dataset_id: string;
  run_id: string;
  result_id?: string | null;
  check_id: string;
  check_name?: string | null;
  check_status: string; // MDCF: PASS|FAIL|WARN|ERROR — normalize before writing to meta.*
  check_category: string | null;
  policy_version: string | null;
  severity?: string | null;
  environment?: string | null;
  check_mode?: string | null;
  check_result?: string | null;
  result_value?: number | null;
  threshold_value?: number | null;
  message?: string | null;
  parent_run_id?: string | null;
}

export interface LineageHop {
  event_type: string;
  timestamp_utc: string;
  event_date: string;
  dataset_id: string;
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
  // LMETA-014: logische pipelinelagen, aanwezig in workspace.meta.lineage_dataset
  source_layer?: string | null;
  target_layer?: string | null;
  lineage_group_id?: string | null;
}

export interface LineageEntity {
  entity_guid: string;                       // LADR-079: stable UUID for URL-safe identification (required, always present)
  dataset_id?: string | null;
  name: string;
  layer: string;
  latest_status: string;          // "SUCCESS" | "FAILED" | "WARNING" | "UNKNOWN"
  end_to_end_status: string;      // "SUCCESS" | "PARTIAL" | "FAILED" | "UNKNOWN"
  latest_success_at: string | null;
  upstream_keys: string[];
  downstream_keys: string[];
  lineage_group_id: string | null;
  last_completed_layer: string | null;
  // LADR-064: dataset vs entity split
  node_kind?: "dataset" | "entity";          // dataset = landing/raw/bronze, entity = silver/gold
  entity_name?: string | null;               // leesbare entiteitsnaam (silver/gold)
  source_datasets?: string[];                // bronze dataset_ids die deze entiteit voeden (1-to-many)
}

export interface LineageAttribute {
  dataset_id?: string | null;
  // Layer-scoped dataset_id keys (bijv. "cbsenergie::bronze") — exacte graph node identifiers.
  // Aanwezig wanneer data uit meta.lineage_columns komt; null voor legacy/cache payloads.
  source_dataset_id?: string | null;
  target_dataset_id?: string | null;
  source_name: string;
  source_attribute: string;
  target_name: string;
  target_attribute: string;
  source_layer?: string | null;
  target_layer?: string | null;
  is_current: boolean;
  // SCD2 validity window (LADR-014). Null when table predates schema migration.
  valid_from?: string | null;
  valid_to?: string | null;
  // OpenLineage ColumnLineageFacet — afgeleid van is_direct + transformation_mode in Databricks
  transformation_type?: "DIRECT" | "INDIRECT" | "UNKNOWN" | null;
  transformation_subtype?: string | null;
  provenance?: "lineage_attributes_current";
  evidence?: string | null;
}

export interface LineageSchemaInventory {
  lineage_entities_current: string[];
  lineage_attributes_current: string[];
  lineage_dataset: string[];
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
  getLineageAttributes(asOf?: string): Promise<LineageAttribute[]>;
  // LADR-014: returns all SCD2 versions (current + historical) from the raw lineage_attribute table.
  // Optional — only implemented by adapters whose source carries SCD2 history.
  // Falls back to getLineageAttributes() in sync when absent.
  getLineageAttributeHistory?(): Promise<LineageAttribute[]>;
  getLineageSchemaInventory(): Promise<LineageSchemaInventory>;
  getFieldValueReferences(): Promise<import("@/lib/widget-field-reference").FieldReference[]>;
  testConnection(): Promise<boolean>;
}
