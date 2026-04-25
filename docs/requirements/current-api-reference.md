# Latero Insights API Reference

This document is the compact API reference for the current Latero Insights
repository.

For the full external ingest contract, also see:

- [Insights SaaS API Contract](./mdcf-integration/INSIGHTS_SAAS_API_CONTRACT.yml)
- [Insights SaaS Integration Guide](./mdcf-integration/INSIGHTS_SAAS_INTEGRATION_GUIDE.md)

## API Groups

Latero Insights currently exposes two API groups:

1. **Web read and admin APIs**
   - used by the Next.js web application
   - mostly under `web/src/app/api/*`
2. **Versioned ingest APIs**
   - used by Latero runtimes or integration clients
   - under `web/src/app/api/v1/*`

## Web Read And Admin APIs

### `GET /api/health`

Purpose:
- basic application health
- reports Databricks connectivity and snapshot status

Returns:
- `status`: `ok` or `error`
- `databricks`: boolean
- `cache`: cache/snapshot status object
- `timestamp`

Source:
- [web/src/app/api/health/route.ts](/Users/leenvandermeer/Git/Latero%20Insights/web/src/app/api/health/route.ts)

### `GET /api/settings`

Purpose:
- return masked runtime settings

Returns:
- `settings`

### `PUT /api/settings`

Purpose:
- update runtime settings in the local settings store

Accepted fields:
- `databricksHost`
- `databricksToken`
- `databricksWarehouseId`
- `databricksCatalog`
- `databricksSchema`
- `databricksEnvironment`
- `cacheTtlSeconds`
- `cacheOnly`

Validation:
- `cacheTtlSeconds` must be between `0` and `604800`

Source:
- [web/src/app/api/settings/route.ts](/Users/leenvandermeer/Git/Latero%20Insights/web/src/app/api/settings/route.ts)

### `POST /api/test-connection`

Purpose:
- test Databricks connectivity using the current runtime settings

Source:
- [web/src/app/api/test-connection/route.ts](/Users/leenvandermeer/Git/Latero%20Insights/web/src/app/api/test-connection/route.ts)

### `POST /api/sync/databricks`

Purpose:
- pull metadata from Databricks into the Latero Insights read store

Request body:
- optional JSON
- `from`: `YYYY-MM-DD`
- `to`: `YYYY-MM-DD`

Defaults:
- if omitted, the route syncs the last 7 days

Returns:
- `synced`
- `duration_ms`
- `range`

Source:
- [web/src/app/api/sync/databricks/route.ts](/Users/leenvandermeer/Git/Latero%20Insights/web/src/app/api/sync/databricks/route.ts)

### `GET /api/pipelines`

Purpose:
- read pipeline runs for the selected date range from the Insights store

Query parameters:
- `from` required, `YYYY-MM-DD`
- `to` required, `YYYY-MM-DD`
- `installation_id` optional

Behavior:
- in normal mode, reads from the Insights store and writes a fresh snapshot
- in snapshot-only mode, serves from the local snapshot
- on live read failure, falls back to the latest snapshot when available

Returns:
- `data`
- `source`: `insights-saas`, `cache`, or `fallback`
- `cachedAt` when applicable
- `warning` when applicable

Source:
- [web/src/app/api/pipelines/route.ts](/Users/leenvandermeer/Git/Latero%20Insights/web/src/app/api/pipelines/route.ts)

### `GET /api/quality`

Purpose:
- read data-quality checks for the selected date range

Query parameters:
- `from` required, `YYYY-MM-DD`
- `to` required, `YYYY-MM-DD`
- `installation_id` optional

Behavior:
- same snapshot/fallback behavior as `/api/pipelines`

Source:
- [web/src/app/api/quality/route.ts](/Users/leenvandermeer/Git/Latero%20Insights/web/src/app/api/quality/route.ts)

### `GET /api/lineage`

Purpose:
- read lineage hops for the selected date range

Query parameters:
- `from` required, `YYYY-MM-DD`
- `to` required, `YYYY-MM-DD`
- `installation_id` optional

Behavior:
- same snapshot/fallback behavior as `/api/pipelines`

Source:
- [web/src/app/api/lineage/route.ts](/Users/leenvandermeer/Git/Latero%20Insights/web/src/app/api/lineage/route.ts)

### `GET /api/lineage/entities`

Purpose:
- return the current lineage entity projection derived from `data_lineage`

Behavior:
- store-backed
- snapshot fallback supported

Returns:
- `data`
- `source`
- `meta.resolution = "data_lineage_derived"`

Source:
- [web/src/app/api/lineage/entities/route.ts](/Users/leenvandermeer/Git/Latero%20Insights/web/src/app/api/lineage/entities/route.ts)

### `GET /api/lineage/attributes`

Purpose:
- return the current lineage attribute projection derived from `data_lineage`

Behavior:
- store-backed
- snapshot fallback supported

Returns:
- `data`
- `source`
- `meta.resolution = "data_lineage_derived"`

Source:
- [web/src/app/api/lineage/attributes/route.ts](/Users/leenvandermeer/Git/Latero%20Insights/web/src/app/api/lineage/attributes/route.ts)

### `GET /api/widgets/shared`
### `POST /api/widgets/shared`
### `DELETE /api/widgets/shared`

Purpose:
- manage the shared widget library

Persistence:
- JSON-backed file store
- `web/data/shared-widgets.json`

## Versioned Ingest APIs

These routes are intended for Latero runtimes and integration clients.

Common behavior:
- versioned under `/api/v1`
- rate-limited
- Bearer token authorization per installation
- writes to the Postgres Insights store

### `GET /api/v1/health`

Purpose:
- verify ingest API availability and database connectivity

Returns:
- `status`
- `database`
- `timestamp`

Source:
- [web/src/app/api/v1/health/route.ts](/Users/leenvandermeer/Git/Latero%20Insights/web/src/app/api/v1/health/route.ts)

### `POST /api/v1/pipeline-runs`

Purpose:
- ingest pipeline run events

Required request fields:
- `installation_id`
- `timestamp_utc`
- `dataset_id`
- `run_id`
- `step`
- `status`
- `environment`

Optional notable fields:
- `source_system`
- `execution_seconds`

Storage target:
- `pipeline_runs`

Source:
- [web/src/app/api/v1/pipeline-runs/route.ts](/Users/leenvandermeer/Git/Latero%20Insights/web/src/app/api/v1/pipeline-runs/route.ts)

### `POST /api/v1/dq-checks`

Purpose:
- ingest data-quality check events

Required request fields:
- `installation_id`
- `timestamp_utc`
- `dataset_id`
- `check_id`
- `status`
- `severity`
- `environment`

Optional notable fields:
- `step`
- `run_id`
- `check_name`
- `check_category`
- `policy_version`
- `message`

Validation:
- `severity` must be `high`, `medium`, or `low`

Storage target:
- `data_quality_checks`

Source:
- [web/src/app/api/v1/dq-checks/route.ts](/Users/leenvandermeer/Git/Latero%20Insights/web/src/app/api/v1/dq-checks/route.ts)

### `POST /api/v1/lineage`

Purpose:
- ingest lineage hop events

Required request fields:
- `installation_id`
- `timestamp_utc`
- `dataset_id`
- `run_id`
- `step`
- `input_entity`
- `output_entity`
- `environment`

Optional notable fields:
- `source_type`
- `source_ref`
- `source_attribute`
- `target_type`
- `target_ref`
- `target_attribute`
- `source_system`
- `schema_version`
- `lineage_evidence`
- `hop_kind`

Validation:
- `hop_kind` must be `data_flow` or `context`

Storage target:
- `data_lineage`

Source:
- [web/src/app/api/v1/lineage/route.ts](/Users/leenvandermeer/Git/Latero%20Insights/web/src/app/api/v1/lineage/route.ts)

### `GET /api/v1/installations/{installation_id}/status`

Purpose:
- return ingest status for one installation

Returns counts and last event timestamps for:
- `pipeline_runs`
- `dq_checks`
- `lineage`

Authorization:
- Bearer token required unless `INSIGHTS_AUTH_DISABLED=true`

Source:
- [web/src/app/api/v1/installations/[installation_id]/status/route.ts](/Users/leenvandermeer/Git/Latero%20Insights/web/src/app/api/v1/installations/[installation_id]/status/route.ts)

## Current Storage Model

Read side:
- web APIs read from the Latero Insights store
- the current local/dev bootstrap schema is defined in:
  - [infra/sql/init/001_insights_saas_init.sql](/Users/leenvandermeer/Git/Latero%20Insights/infra/sql/init/001_insights_saas_init.sql)

Write side:
- `/api/v1/*` writes into Postgres
- `/api/sync/databricks` pulls Databricks metadata into the same store

## Where To Start

If you want the full repo-level answer quickly:

1. Read this file for the route overview
2. Read [SQL Schema Reference](./sql-schema-reference.md) for the tables
3. Read [Insights SaaS API Contract](./mdcf-integration/INSIGHTS_SAAS_API_CONTRACT.yml) for the external ingest contract
