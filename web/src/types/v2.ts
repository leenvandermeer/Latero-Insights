/**
 * V2 TypeScript types — Data Products, Entities, Run Detail
 * LADR-059, LADR-060
 */

// ---------------------------------------------------------------------------
// Data Products
// ---------------------------------------------------------------------------

export interface DataProduct {
  data_product_id: string;
  installation_id: string;
  display_name: string;
  description?: string | null;
  owner?: string | null;
  domain?: string | null;
  tags: Record<string, string>;
  created_at: string;
  updated_at: string;
  // Computed on read
  entity_count?: number;
  health_status?: "SUCCESS" | "FAILED" | "WARNING" | "UNKNOWN";
  dq_pass_rate?: number | null;
  latest_run_at?: string | null;
}

// ---------------------------------------------------------------------------
// Entities (cross-layer concept)
// ---------------------------------------------------------------------------

export interface Entity {
  entity_id: string;
  installation_id: string;
  data_product_id?: string | null;
  display_name?: string | null;
  description?: string | null;
  source_system?: string | null;
  owner?: string | null;
  tags: Record<string, string>;
  created_at: string;
  updated_at: string;
  // Computed layer status (from meta.datasets JOIN meta.runs)
  layer_statuses?: Record<string, LayerStatus>;
  // Aggregated
  health_status?: "SUCCESS" | "FAILED" | "WARNING" | "UNKNOWN";
  dq_pass_rate?: number | null;
  latest_run_at?: string | null;
}

export interface LayerStatus {
  layer: string;
  dataset_id: string;
  latest_run_id?: string | null;
  latest_status: "SUCCESS" | "FAILED" | "WARNING" | "UNKNOWN";
  latest_run_at?: string | null;
  dq_pass_rate?: number | null;
}

// ---------------------------------------------------------------------------
// Run Detail (V2)
// ---------------------------------------------------------------------------

export interface RunDetail {
  run_id: string;
  external_run_id: string;
  job_name: string;
  dataset_id?: string | null;
  entity_fqn?: string | null;
  task_key?: string | null;
  status: "SUCCESS" | "FAILED" | "WARNING" | "UNKNOWN";
  environment?: string | null;
  started_at: string;
  ended_at?: string | null;
  duration_ms?: number | null;
  attempt_number?: number | null;
  queue_duration_ms?: number | null;
  setup_duration_ms?: number | null;
  trigger?: string | null;
  run_page_url?: string | null;
  dbx_job_run_id?: string | null;
  dbx_task_run_id?: string | null;
  parent_run_id?: string | null;
  run_facets?: Record<string, unknown> | null;
  // Relations
  io_datasets?: RunIODataset[];
  dq_checks?: RunDQCheck[];
  lineage_edges?: RunLineageEdge[];
  child_runs?: RunDetail[];
}

export interface RunSummary {
  run_id: string;
  external_run_id: string;
  job_name: string;
  dataset_id?: string | null;
  task_key?: string | null;
  status: "SUCCESS" | "FAILED" | "WARNING" | "RUNNING" | "UNKNOWN";
  environment?: string | null;
  started_at: string;
  ended_at?: string | null;
  duration_ms?: number | null;
  attempt_number?: number | null;
  queue_duration_ms?: number | null;
  setup_duration_ms?: number | null;
  trigger?: string | null;
  run_page_url?: string | null;
  dbx_job_run_id?: string | null;
  dbx_task_run_id?: string | null;
  parent_run_id?: string | null;
  dq_count?: number;
  io_count?: number;
}

export interface RunIODataset {
  dataset_id: string;
  entity_fqn?: string | null;
  layer?: string | null;
  role: "INPUT" | "OUTPUT";
  observed_at: string;
}

export interface RunDQCheck {
  check_id: string;
  check_name?: string | null;
  check_category?: string | null;
  severity?: string | null;
  status: "SUCCESS" | "FAILED" | "WARNING";
  check_result?: string | null;
  executed_at: string;
}

export interface RunLineageEdge {
  source_dataset_id: string;
  target_dataset_id: string;
  source_fqn?: string | null;
  target_fqn?: string | null;
  observation_count?: number;
}

// ---------------------------------------------------------------------------
// Estate Health (for health overview)
// ---------------------------------------------------------------------------

export interface EstateHealth {
  installation_id: string;
  data_product_count: number;
  entity_count: number;
  issue_count: number;
  dq_pass_rate: number | null;
  last_sync_at: string | null;
  last_run_at: string | null;
}

// ---------------------------------------------------------------------------
// OpenLineage types (WP-V2-007)
// ---------------------------------------------------------------------------

export interface OLRunEvent {
  eventType: "START" | "COMPLETE" | "FAIL" | "ABORT" | "OTHER" | "RUNNING";
  eventTime: string;           // ISO 8601
  run: OLRun;
  job: OLJob;
  inputs?: OLDataset[];
  outputs?: OLDataset[];
  producer: string;
  schemaURL: string;
}

export interface OLRun {
  runId: string;
  facets?: Record<string, unknown>;
}

export interface OLJob {
  namespace: string;
  name: string;
  facets?: Record<string, unknown>;
}

export interface OLDataset {
  namespace: string;
  name: string;
  facets?: Record<string, unknown>;
}
