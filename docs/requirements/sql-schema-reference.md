# Latero Insights SQL Schema Reference

This document describes the bootstrap SQL schema used by Latero Insights in
local and development environments.

Authoritative SQL source:

- [infra/sql/init/001_insights_saas_init.sql](/Users/leenvandermeer/Git/Latero%20Insights/infra/sql/init/001_insights_saas_init.sql)

## Purpose

The bootstrap schema initializes the Insights read and ingest store in
PostgreSQL.

It currently creates:
- installation registry
- event tables
- ingest audit table
- supporting indexes

## Tables

### `insights_installations`

Purpose:
- registry of known installations and their API token hash

Columns:
- `installation_id` primary key
- `environment`
- `token_hash`
- `active`
- `created_at`
- `updated_at`

Used for:
- installation-bound Bearer token validation on `/api/v1/*`

### `pipeline_runs`

Purpose:
- store pipeline execution events

Key columns:
- `id`
- `event_type`
- `timestamp_utc`
- `event_date`
- `dataset_id`
- `source_system`
- `step`
- `run_id`
- `run_status`
- `duration_ms`
- `installation_id`
- `environment`
- `payload`
- `created_at`

Notes:
- `event_date` is generated from `timestamp_utc`
- `payload` stores the raw event body as `JSONB`

Read usage:
- `/api/pipelines`

Write usage:
- `/api/v1/pipeline-runs`
- Databricks sync

### `data_quality_checks`

Purpose:
- store data-quality evaluation events

Key columns:
- `id`
- `event_type`
- `timestamp_utc`
- `event_date`
- `dataset_id`
- `step`
- `run_id`
- `check_id`
- `check_name`
- `check_status`
- `severity`
- `check_category`
- `policy_version`
- `message`
- `installation_id`
- `environment`
- `payload`
- `created_at`

Notes:
- `event_date` is generated from `timestamp_utc`
- `payload` stores the raw event body as `JSONB`

Read usage:
- `/api/quality`

Write usage:
- `/api/v1/dq-checks`
- Databricks sync

### `data_lineage`

Purpose:
- store lineage hops and evidence events

Key columns:
- `id`
- `event_type`
- `timestamp_utc`
- `event_date`
- `dataset_id`
- `step`
- `run_id`
- `source_entity`
- `source_type`
- `source_ref`
- `source_attribute`
- `target_entity`
- `target_type`
- `target_ref`
- `target_attribute`
- `hop_kind`
- `source_system`
- `installation_id`
- `environment`
- `schema_version`
- `lineage_evidence`
- `payload`
- `created_at`

Important semantics:
- `source_ref` and `target_ref` are the canonical references used to identify
  assets more reliably than display names alone
- `hop_kind` distinguishes meaningful data movement from context
  - `data_flow`
  - `context`

Read usage:
- `/api/lineage`
- `/api/lineage/entities`
- `/api/lineage/attributes`

Write usage:
- `/api/v1/lineage`
- Databricks sync

### `ingest_audit`

Purpose:
- simple audit trail for ingest requests and responses

Columns:
- `id`
- `endpoint`
- `installation_id`
- `status_code`
- `request_body`
- `response_body`
- `created_at`

Used for:
- basic ingest observability and troubleshooting

## Indexes

The bootstrap script creates the following important indexes.

### `pipeline_runs`

- `idx_pipeline_runs_installation_date`
- `idx_pipeline_runs_dataset_date`

### `data_quality_checks`

- `idx_dq_installation_date`
- `idx_dq_dataset_date`

### `data_lineage`

- `idx_lineage_installation_date`
- `idx_lineage_dataset_date`
- `idx_lineage_hop_kind`

## Sync-Specific Unique Indexes

The schema also creates partial unique indexes for records imported through the
Databricks sync path, where `installation_id = 'databricks-sync'`.

These are:
- `uq_pipeline_runs_sync_key`
- `uq_dq_checks_sync_key`
- `uq_lineage_sync_key`

Purpose:
- prevent duplicate sync inserts for the same logical event key

## How This Maps To The App

In the current product:

- the ingest API writes into these tables
- the read API reads from these tables
- local Docker infra initializes them on first Postgres startup

Bootstrap location:
- [infra/sql/init/001_insights_saas_init.sql](/Users/leenvandermeer/Git/Latero%20Insights/infra/sql/init/001_insights_saas_init.sql)

Docker mount:
- [infra/docker/docker-compose.local.yml](/Users/leenvandermeer/Git/Latero%20Insights/infra/docker/docker-compose.local.yml)

## Related Documents

- [Current API Reference](./current-api-reference.md)
- [Current Architecture](./current-architecture.md)
- [Insights SaaS API Contract](./mdcf-integration/INSIGHTS_SAAS_API_CONTRACT.yml)
