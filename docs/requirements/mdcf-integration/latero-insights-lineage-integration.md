# Latero Insights — Lineage Integration Guide

**Audience:** Developers building connectors or dashboards in Latero Insights against Latero meta-tables.  
**Schema version covered:** `meta.data_lineage` v1.2  
**Related ADR:** [LADR-003 — End-to-end lineage state](decisions/20260420-end-to-end-lineage-state.md)

---

## Overview

Latero writes one row per source→target hop into `meta.data_lineage`. Since schema v1.2, each row carries enough context to reconstruct the full pipeline chain without joining against `meta.pipeline_runs` for basic queries.

The key additions are:

- **`lineage_group_id`** — a SHA-256 key that is identical across all hops belonging to the same end-to-end pipeline execution for a dataset/entity. Use this to group landing→raw→bronze→silver→gold into one chain.
- **`source_layer` / `target_layer`** — explicit medallion layer labels on every hop.
- **`lineage_scope`** — whether the row describes a `file`, `dataset`, or `attribute` transition.
- **`relation_type`** — the semantic relationship: `copied_to`, `parsed_to`, or `transformed_to`.

There is no separate database. All Latero meta-tables remain in `meta` (Databricks: `workspace.meta`, Snowflake: `LATERO.META`).

For productized onboarding and reduced developer dependency, use this guide together with:

- [LADR-008 — Self-service onboarding boundary](decisions/20260424-self-service-insights-onboarding.md)
- [Insights self-service integration requirements](requirements/insights-self-service-integration.md)
- [Insights self-service delivery backlog](latero-insights-self-service-backlog.md)
- [Databricks self-service onboarding guide](insights-self-service-databricks.md) — practical workflow and Python API

---

## Schema reference: `meta.data_lineage` v1.2

### Stable columns (since v1.0)

| Column | Type | Description |
|---|---|---|
| `event_type` | STRING | Always `"lineage"` |
| `timestamp_utc` | STRING | ISO-8601 event timestamp |
| `event_date` | STRING | Date partition key (YYYY-MM-DD) |
| `dataset_id` | STRING | Dataset identifier (e.g. `cbsenergie`) |
| `source_system` | STRING | Source system / supplier |
| `step` | STRING | Pipeline step name (e.g. `landing_to_raw`) |
| `run_id` | STRING | Unique step execution ID |
| `installation_id` | STRING | Latero installation identifier |
| `environment` | STRING | Runtime environment (e.g. `dev`, `prod`) |
| `schema_version` | STRING | Schema version — `"1.2"` for lineage rows from this release |
| `parent_run_id` | STRING | Orchestrator/job run ID (shared across all steps in one job run) |
| `source_entity` | STRING | Source entity or dataset name |
| `source_type` | STRING | Source type label (e.g. `landing_file`, `bronze_attribute`) |
| `source_ref` | STRING | Fully qualified source reference |
| `source_attribute` | STRING | Source attribute name (attribute-scope rows only) |
| `target_entity` | STRING | Target entity or dataset name |
| `target_type` | STRING | Target type label (e.g. `silver_table`, `gold_attribute`) |
| `target_ref` | STRING | Fully qualified target reference |
| `target_attribute` | STRING | Target attribute name (attribute-scope rows only) |
| `lineage_evidence` | MAP / VARIANT | Free-form evidence dict (mode, sha256, dbt model, mapping details) |

### New columns in v1.2

| Column | Type | Description |
|---|---|---|
| `lineage_group_id` | STRING | SHA-256 chain key — same value for all hops in one end-to-end run |
| `source_layer` | STRING | Source medallion layer (`landing`, `raw`, `bronze`, `silver`, `gold`) |
| `target_layer` | STRING | Target medallion layer |
| `lineage_scope` | STRING | Granularity of this hop: `file`, `dataset`, or `attribute` |
| `relation_type` | STRING | Semantic relation: `copied_to`, `parsed_to`, `transformed_to` |
| `target_run_status` | STRING | Reserved — will carry producing step status in a future release |
| `hop_kind` | STRING | Role of this hop: `data_flow` (real data transition) or `context` (framework/evidence reference). `NULL` = `data_flow` for historical rows. See LMETA-017. |

---

## Layer and scope reference

Every pipeline step writes lineage rows with a fixed layer/scope/relation combination:

| Step | `source_layer` | `target_layer` | `lineage_scope` | `relation_type` |
|---|---|---|---|---|
| `landing_to_raw` | `landing` | `raw` | `file` | `copied_to` |
| `raw_to_bronze` | `raw` | `bronze` | `file` | `parsed_to` |
| `bronze_to_silver` | `bronze` | `silver` | `dataset` (one row) + `attribute` (one row per mapping) | `transformed_to` |
| `silver_to_gold` | `silver` | `gold` | `dataset` (one row) + `attribute` (one row per mapping) | `transformed_to` |

For `bronze_to_silver` and `silver_to_gold`, two types of rows exist per execution:

- One `lineage_scope = 'dataset'` row describing the table-level hop.
- N `lineage_scope = 'attribute'` rows describing individual column mappings.

---

## lineage_group_id — chaining hops into a pipeline run

`lineage_group_id` is a SHA-256 hash computed from `source_system`, `dataset_id`, an entity or business key, and the orchestrator run ID. It is **the same value across all hops** that belong to one end-to-end execution for a given dataset/entity.

Use it to reconstruct a full pipeline chain:

```sql
-- All hops for one end-to-end chain
SELECT
    source_layer,
    target_layer,
    lineage_scope,
    relation_type,
    source_entity,
    target_entity,
    step,
    timestamp_utc
FROM meta.data_lineage
WHERE lineage_group_id = '<group_id>'
ORDER BY timestamp_utc;
```

To find the `lineage_group_id` for a specific entity and run:

```sql
SELECT DISTINCT lineage_group_id
FROM meta.data_lineage
WHERE dataset_id    = 'cbsenergie'
  AND target_entity = 'gold_api_emission'
  AND target_layer  = 'gold'
  AND event_date    = '2026-04-20'
LIMIT 1;
```

---

## Query patterns for Latero Insights

### 1. Latest successful layer per entity

```sql
SELECT
    dataset_id,
    target_entity,
    target_layer,
    MAX(timestamp_utc) AS latest_hop_at
FROM meta.data_lineage
WHERE lineage_scope IN ('dataset', 'file')
  AND schema_version = '1.2'
GROUP BY dataset_id, target_entity, target_layer;
```

### 2. End-to-end chain status per dataset

Join against `meta.pipeline_runs` for the authoritative `run_status`. Use `lineage_group_id` to find which runs are part of the same chain.

```sql
SELECT
    l.lineage_group_id,
    l.dataset_id,
    l.target_entity,
    l.target_layer,
    l.timestamp_utc AS hop_at,
    r.run_status
FROM meta.data_lineage l
JOIN meta.pipeline_runs r
    ON l.run_id = r.run_id
WHERE l.lineage_scope IN ('dataset', 'file')
  AND l.schema_version = '1.2'
ORDER BY l.lineage_group_id, l.timestamp_utc;
```

To determine `end_to_end_status` for a chain:

- `SUCCESS` — all expected layers reached with `run_status = 'SUCCESS'`
- `PARTIAL` — some layers reached, gold not yet present
- `FAILED` — any layer has `run_status = 'FAILED'`
- `IN_PROGRESS` — highest layer not yet written

### 3. Attribute lineage for a target column

```sql
SELECT
    source_entity,
    source_attribute,
    source_layer,
    target_entity,
    target_attribute,
    target_layer,
    relation_type,
    timestamp_utc
FROM meta.data_lineage
WHERE target_entity   = 'gold_api_emission'
  AND target_attribute = 'RegionCode'
  AND lineage_scope   = 'attribute'
ORDER BY timestamp_utc DESC
LIMIT 10;
```

### 4. Upstream entities for a gold entity

```sql
SELECT DISTINCT
    source_layer,
    source_entity,
    target_layer,
    target_entity
FROM meta.data_lineage
WHERE lineage_group_id = '<group_id>'
  AND lineage_scope    = 'dataset'
ORDER BY source_layer;
```

---

## Filtering recommendations

For Insights dashboards, always filter on:

- `schema_version = '1.2'` to exclude rows without layer context
- `lineage_scope` to separate file hops from entity and attribute hops
- `event_date` for partition pruning on large tables
- `hop_kind IN ('data_flow') OR hop_kind IS NULL` for any calculation that counts inputs, outputs, sources, targets, or lineage depth — this excludes framework-internal context hops that are not real data transitions. Rows where `hop_kind IS NULL` are historical rows written before LMETA-017 and must be treated as `data_flow`.

Avoid reading all rows and computing chain state in memory. Use `lineage_group_id` as the primary grouping key and push aggregation to SQL.

---

## Read-model tables (LADR-003)

The following tables are maintained by the `lineage_projector` notebook. They are the preferred query target for Latero Insights — do not build permanent dashboard queries on raw `meta.data_lineage` aggregations that duplicate this logic.

### `meta.lineage_entities_current`

One row per entity per layer, maintained by a projector job.

Key fields:

| Field | Description |
|---|---|
| `entity_fqn` | Fully qualified entity name |
| `layer` | Medallion layer |
| `latest_status` | Status of the most recent producing step |
| `last_completed_layer` | Highest layer successfully reached |
| `end_to_end_status` | `SUCCESS`, `PARTIAL`, `FAILED`, `IN_PROGRESS`, or `STALE` |
| `latest_success_at` | Timestamp of last successful hop to this layer |
| `upstream_entity_fqns` | Array of upstream entity FQNs |
| `downstream_entity_fqns` | Array of downstream entity FQNs |
| `latest_lineage_group_id` | Chain key for the most recent complete run |

### `meta.lineage_attributes_current`

One row per active source→target attribute mapping.

Key fields:

| Field | Description |
|---|---|
| `source_entity_fqn` | Fully qualified source entity |
| `source_attribute` | Source column name |
| `target_entity_fqn` | Fully qualified target entity |
| `target_attribute` | Target column name |
| `source_layer` / `target_layer` | Layer labels |
| `transformation_mode` | How the mapping was derived (`config_mapping`, `dbt_run`, etc.) |
| `is_current` | True for the latest active mapping |
| `latest_success_at` | Last time this mapping was written from a successful run |

---

## Databricks deployment

Follow these four steps in order when deploying to a Databricks environment.

### Step 1 — Run bootstrap SQL

Open a Databricks SQL editor or notebook and run [`latero/adapters/databricks/bootstrap.sql`](../../latero/adapters/databricks/bootstrap.sql) in full. The script is idempotent — it uses `CREATE TABLE IF NOT EXISTS` throughout.

For **existing installations upgrading from schema v1.1**, also uncomment and run the migration block at the bottom of that file:

```sql
ALTER TABLE workspace.meta.data_lineage ADD COLUMN lineage_group_id STRING;
ALTER TABLE workspace.meta.data_lineage ADD COLUMN source_layer STRING;
ALTER TABLE workspace.meta.data_lineage ADD COLUMN target_layer STRING;
ALTER TABLE workspace.meta.data_lineage ADD COLUMN lineage_scope STRING;
ALTER TABLE workspace.meta.data_lineage ADD COLUMN relation_type STRING;
ALTER TABLE workspace.meta.data_lineage ADD COLUMN target_run_status STRING;
```

The two new current-state tables (`lineage_entities_current`, `lineage_attributes_current`) are always created fresh — no migration needed for them.

### Step 2 — Deploy notebooks

Push the repository to Databricks Repos (or sync manually). The following notebooks have changed or are new:

| Notebook | Change |
|---|---|
| `notebooks/landing_to_raw.py` | Passes `lineage_group_id`, layer, and relation context |
| `notebooks/raw_to_bronze.py` | Passes `lineage_group_id`, layer, and relation context |
| `notebooks/bronze_to_silver_logs.py` | Passes `lineage_group_id`, layer, and relation context |
| `notebooks/silver_to_gold_logs.py` | Passes `lineage_group_id`, layer, and relation context |
| `notebooks/lineage_projector.py` | **New** — materializes current-state tables |
| `notebooks/openmetadata_sync.py` | **New** — syncs to OpenMetadata (optional) |

### Step 3 — Create Databricks jobs

Create two new jobs in Databricks.

**lineage_projector** — run after every pipeline execution, or on a fixed schedule:

```text
Notebook path:  /Repos/<your-repo>/notebooks/lineage_projector.py
Cluster:        existing shared cluster
Schedule:       after silver_to_gold completes, or every N minutes
Parameters:     input_config_file = config/datasets.yml
```

**openmetadata_sync** (optional — only if you use OpenMetadata):

```text
Notebook path:  /Repos/<your-repo>/notebooks/openmetadata_sync.py
Cluster:        existing shared cluster
Schedule:       after lineage_projector completes
Parameters:     input_service_name = <your OpenMetadata service name>
```

### Step 4 — Configure OpenMetadata credentials (optional)

Skip this step if you are not using the OpenMetadata sync.

Create a Databricks secrets scope and add the two required keys:

```bash
databricks secrets create-scope latero --initial-manage-principal users

databricks secrets put --scope latero --key openmetadata_server_url
# enter value: https://openmetadata.yourdomain.com

databricks secrets put --scope latero --key openmetadata_bearer_token
# enter value: <your JWT bearer token>
```

The sync notebook reads from scope `latero` and falls back to environment variables `OM_SERVER_URL` and `OM_BEARER_TOKEN` if the secrets scope is not available.

---

## Migration note

Rows written before schema v1.2 have `NULL` in `lineage_group_id`, `source_layer`, `target_layer`, `lineage_scope`, and `relation_type`. Filter these out with `schema_version = '1.2'` or `lineage_group_id IS NOT NULL`.

For existing Latero installations upgrading from v1.1, run the migration `ALTER TABLE` statements in [`latero/adapters/databricks/bootstrap.sql`](../../latero/adapters/databricks/bootstrap.sql) (or the Snowflake equivalent) before deploying updated notebooks.
