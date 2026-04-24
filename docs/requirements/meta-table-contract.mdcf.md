# Latero Meta Table Contract — Normative Requirements

Version: 1.1-draft
Status: DRAFT — pending implementation of LMETA-001 through LMETA-010
Owner: Latero product

---

## Scope

This document defines the normative requirements for the Latero meta tables:

- `meta.pipeline_runs`
- `meta.data_quality_checks`
- `meta.data_lineage`
- `meta.lineage_entities_current` (projected current state — see LMETA-012)
- `meta.lineage_attributes_current` (projected current state — see LMETA-012)

These requirements apply to every platform adapter. Adapters must implement the schema
exactly. Platform-specific columns (e.g. `dbx_job_id`, `sf_query_id`) are adapter extensions
and must not be referenced by Latero core code.

---

## Shared base columns (all three tables)

Every meta table must include the following base columns in this order:

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `event_type` | STRING | yes | Discriminator: `pipeline_run`, `data_quality_check`, `lineage` |
| `timestamp_utc` | STRING | yes | ISO 8601 UTC timestamp of the event |
| `event_date` | STRING | yes | ISO date (YYYY-MM-DD) for partitioning |
| `dataset_id` | STRING | yes | Consumer-supplied dataset identifier |
| `source_system` | STRING | yes | Producer-agnostic identifier for the data origin (replaces `supplier`) |
| `step` | STRING | yes | Pipeline step name |
| `run_id` | STRING | yes | Unique identifier for this step execution |
| `installation_id` | STRING | yes | Latero installation identifier |
| `environment` | STRING | no | Deployment environment tag: `dev`, `acc`, `prd` or consumer-defined |
| `schema_version` | STRING | yes | Meta table schema version string (e.g. `1.1`) — for schema evolution tracking |

### LMETA-001 — Rename `supplier` to `source_system`

**Requirement:** The column previously named `supplier` must be renamed to `source_system`
in all three meta tables in both adapters (Databricks and Snowflake).

**Rationale:** `supplier` is a demo-domain concept (HPT as data supplier). `source_system`
is the producer-agnostic term used by OpenLineage, DataHub, and DAMA-DMBOK. Latero must
remain consumer-agnostic.

**Breaking change:** yes — existing installations must run an ALTER TABLE migration.

**Acceptance criteria:**
- `supplier` does not appear in any bootstrap.sql
- `supplier` does not appear as a column reference in `DeltaEventLogger`, `SnowflakeEventLogger`, `build_attribute_lineage_rows`, or `build_step_logger`
- `create_event_logger()` and `build_step_logger()` accept `source_system` as parameter, not `supplier`
- All demo notebooks pass `source_system` to `build_step_logger()`
- Unit tests that assert on `supplier` are updated

**Affected files:**
- `latero/adapters/databricks/bootstrap.sql`
- `latero/adapters/snowflake/bootstrap.sql`
- `latero/adapters/databricks/__init__.py` — `DeltaEventLogger.__init__`, `_base()`, `build_step_logger()`
- `latero/adapters/snowflake/__init__.py` — `SnowflakeEventLogger`
- `latero/framework.py` — `build_attribute_lineage_rows()`, `create_event_logger()`
- `notebooks/landing_to_raw.py`, `notebooks/raw_to_bronze.py`, `notebooks/bronze_to_silver_logs.py`, `notebooks/silver_to_gold_logs.py`
- `tests/`

---

### LMETA-008 — Add `environment` column

**Requirement:** All three meta tables must include an `environment` column (STRING, nullable).
The value is supplied by the consumer at runtime via the runtime config or adapter profile.
Latero core does not validate or constrain the value.

**Breaking change:** additive — existing rows get NULL.

**Acceptance criteria:**
- Column present in DDL for both adapters
- `DeltaEventLogger._base()` includes `environment` value when provided
- `create_event_logger()` accepts optional `environment` parameter

---

### LMETA-009 — Add `schema_version` column

**Requirement:** All three meta tables must include a `schema_version` column (STRING, required).
The value is the meta table schema version string, set by the adapter at write time (not by the consumer).
Initial value: `"1.1"`.

**Breaking change:** additive, but required — adapters must always populate this field.

**Acceptance criteria:**
- Column present in DDL for both adapters
- `DeltaEventLogger._base()` always writes the schema version constant
- Version string is defined as a module-level constant in each adapter

---

## meta.pipeline_runs

Full required schema:

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| *(base columns)* | | | See above |
| `parent_run_id` | STRING | no | Job-level run ID that groups step runs — see LMETA-004 |
| `run_status` | STRING | yes | One of: `SUCCESS`, `WARNING`, `FAILED` |
| `duration_ms` | BIGINT | no | Wall-clock duration in milliseconds — see LMETA-003 |
| `input_refs` | MAP\<STRING,STRING\> | no | Input parameters and references |
| `output_refs` | MAP\<STRING,STRING\> | no | Output row counts and references |
| `run_metrics` | MAP\<STRING,STRING\> | no | Additional metrics not expressible as scalars |
| `errors` | ARRAY\<STRING\> | no | Error messages for failed runs |
| `run_context` | MAP\<STRING,STRING\> | no | Consumer-supplied contextual metadata |
| `file_events` | ARRAY\<STRUCT\> | no | File-level events — see LMETA-005 |
| *(platform columns)* | | | Adapter-specific, e.g. `dbx_job_id`, `sf_query_id` |

### LMETA-003 — Add `duration_ms` scalar column

**Requirement:** `meta.pipeline_runs` must include a `duration_ms BIGINT` column. The adapter
must compute and populate it from the difference between step start and end timestamps. It must
not be stored only inside `run_metrics`.

**Rationale:** `duration_ms` stored in `MAP<STRING,STRING>` requires string casting for every
aggregation. `AVG(duration_ms)`, `P95`, and SLA monitoring are unusable without a scalar.

**Breaking change:** additive — existing rows get NULL.

**Acceptance criteria:**
- Column present in DDL as `BIGINT` (Databricks) / `NUMBER` (Snowflake)
- Adapter computes value as `end_ts_ms - start_ts_ms`
- Value is populated on every `pipeline_run()` call where start time is known
- `run_metrics` may still contain `duration_ms` for backwards compatibility during migration, but `duration_ms` scalar takes precedence

---

### LMETA-004 — Add `parent_run_id` column

**Requirement:** `meta.pipeline_runs` must include a `parent_run_id STRING` column. When a
pipeline runs multiple steps as part of a single job execution, all step runs must share the
same `parent_run_id`. When no parent context exists (standalone run), the value is NULL.

**Rationale:** Without `parent_run_id`, there is no framework-level query that answers
"what was the end-to-end status of all steps in last night's job run?".

**Breaking change:** additive — existing rows get NULL.

**Acceptance criteria:**
- Column present in DDL for both adapters
- `create_event_logger()` and `build_step_logger()` accept optional `parent_run_id` parameter
- Databricks adapter derives `parent_run_id` from `dbx_job_run_id` when not explicitly supplied
- The framework does not generate `parent_run_id` itself; consumers supply it via the adapter factory

---

### LMETA-005 — `file_events` STRUCT evolution contract

**Requirement:** The `file_events` STRUCT must be documented as a versioned sub-schema.
New fields may only be added as nullable fields at the end of the struct. Existing field
names and types must not change. The current struct version is `1.0`.

**Rationale:** Delta Lake supports struct evolution via `UNION BY NAME` merges, but only if
existing fields are not renamed or retyped. Without an explicit contract, callers may add
fields in the middle of the struct, breaking historical reads.

**Breaking change:** governance-only, no schema change required now.

**Acceptance criteria:**
- `file_events` struct fields are documented in this file with a version tag
- A comment in `bootstrap.sql` references this contract
- `_normalize_files()` already handles schema-driven normalization — no code change required

**Current `file_events` struct v1.0:**

| Field | Type | Description |
|-------|------|-------------|
| `status` | STRING | File processing status |
| `source_ref` | STRING | Source file path |
| `target_ref` | STRING | Target file path |
| `file_sha256` | STRING | SHA-256 of the processed file |
| `landing_sha256` | STRING | SHA-256 at landing |
| `raw_sha256` | STRING | SHA-256 in raw zone |
| `record_count` | BIGINT | Record count in file |
| `reporting_year` | STRING | Reporting year (consumer-supplied) |
| `dataset_version` | STRING | Dataset version (consumer-supplied) |
| `as_of_date` | STRING | Data as-of date (consumer-supplied) |
| `source_ingestion_date` | STRING | Source ingestion date |
| `error` | STRING | Error message if status is not SUCCESS |

---

## meta.data_quality_checks

Full required schema:

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| *(base columns)* | | | See above |
| `check_id` | STRING | yes | Check identifier, must match a `check_policy` entry |
| `check_status` | STRING | yes | One of: `PASS`, `FAIL`, `WARN`, `SKIPPED`, `ERROR` — see LMETA-002 |
| `severity` | STRING | no | Severity of the check policy: `high`, `medium`, or `low` — see LMETA-013 |
| `check_mode` | STRING | no | Execution mode of the check policy: `enforce` or `observe` — see LMETA-013 |
| `policy_version` | STRING | no | Version of the check policy that was evaluated — see LMETA-006 |
| `check_result` | MAP\<STRING,STRING\> | no | Check-specific evidence |
| `run_context` | MAP\<STRING,STRING\> | no | Consumer-supplied context (entity, scope_key) |

### LMETA-002 — Add `ERROR` as valid `check_status` value

**Requirement:** The `check_status` domain must include `ERROR` as a fifth value:

| Value | Meaning |
|-------|---------|
| `PASS` | Check executed successfully, result positive |
| `FAIL` | Check executed successfully, result negative |
| `WARN` | Check executed, result borderline (observe mode with high severity) |
| `SKIPPED` | Check was registered but not executed (scope not applicable) |
| `ERROR` | Check could not be executed due to an exception |

The policy engine in `register_dq_check()` must catch exceptions during check execution
and write an `ERROR` record before re-raising. This ensures the meta table always has a
record, even when a check fails to execute.

**Rationale:** An auditor cannot distinguish a failed check from a check that crashed.
BCBS239 principle 3 (accuracy) requires that data quality governance records are complete.

**Breaking change:** additive to the value domain. Consumers who query `check_status NOT IN ('PASS')` will correctly catch `ERROR`.

**Acceptance criteria:**
- `register_dq_check()` wraps the check execution in try/except
- On exception, a record with `check_status = 'ERROR'` and `check_result = {'error': str(e)}` is written
- The exception is re-raised after logging
- Documentation of valid `check_status` values is updated

---

### LMETA-006 — Add `policy_version` column

**Requirement:** `meta.data_quality_checks` must include a `policy_version STRING` column.
The value is derived from `config_schema_version` in the runtime config at the time of
check execution. If not available, the value is NULL.

**Rationale:** If a check policy is updated after a run, it is impossible to reconstruct
which policy version governed a historical check result. This breaks reproducibility and
audit trail completeness.

**Breaking change:** additive — existing rows get NULL.

**Acceptance criteria:**
- Column present in DDL for both adapters
- `register_dq_check()` accepts optional `policy_version` parameter
- `build_step_logger()` extracts `config_schema_version` from runtime config and passes it through
- Existing calls without `policy_version` continue to work (NULL value)

---

### LMETA-013 — Add `severity` and `check_mode` as top-level columns

**Requirement:** `meta.data_quality_checks` must include `severity STRING` and
`check_mode STRING` as top-level columns. These values must be written explicitly by the
adapter on every `data_quality_check()` call. They must not be read only from `check_result`.

**Rationale:** `severity` and `check_mode` embedded inside the `check_result` MAP cannot be
used directly in SQL `WHERE` clauses, `GROUP BY` expressions, or BI tool filter widgets.
Dashboarding queries such as "count high-severity enforce-mode failures by dataset" require
scalar columns. See LADR-004.

**Valid values:**

- `severity`: `high`, `medium`, `low` — matching `CheckSeverity` constants
- `check_mode`: `enforce`, `observe` — matching `CheckMode` constants

**Breaking change:** additive DDL — existing rows get NULL. An ALTER TABLE migration is required
before deploying the updated adapter on existing installations.

**Migration SQL — Databricks:**

```sql
ALTER TABLE workspace.meta.data_quality_checks ADD COLUMN severity STRING;
ALTER TABLE workspace.meta.data_quality_checks ADD COLUMN check_mode STRING;
```

**Migration SQL — Snowflake:**

```sql
ALTER TABLE LATERO.META.DATA_QUALITY_CHECKS ADD COLUMN severity VARCHAR;
ALTER TABLE LATERO.META.DATA_QUALITY_CHECKS ADD COLUMN check_mode VARCHAR;
```

**Acceptance criteria:**

- Columns present in DDL for both adapters
- `EventLogger.data_quality_check()` abstract method includes `severity` and `check_mode` parameters
- `DeltaEventLogger.data_quality_check()` writes both columns
- `SnowflakeEventLogger.data_quality_check()` writes both columns
- `register_dq_check()` extracts `severity` and `check_mode` from the check policy and passes
  them to the logger
- Existing calls without explicit severity/check_mode write NULL (backwards compatible)

---

### LMETA-014 — Enforce `source_layer` and `target_layer` population on `data_lineage`

**Requirement:** `source_layer` and `target_layer` already exist as columns in the
`meta.data_lineage` DDL (schema v1.2). This requirement makes them **required fields**
at the caller level. Every call to `EventLogger.lineage()` must supply both values.
Allowed values are: `landing`, `raw`, `bronze`, `silver`, `gold`.

**Rationale:** Without mandatory layer population, cross-layer lineage queries (e.g.
"trace all lineage hops from landing to gold for dataset X") cannot be answered without
heuristics. Mandatory population enables deterministic layer-aware lineage traversal and
is a precondition for lineage completeness dashboards.

**This is a behavioral contract, not a schema change.** No DDL migration is required.
Historical rows with NULL values in `source_layer` and `target_layer` are valid and must
remain queryable. Consumers must implement a fallback to heuristics (e.g. inferring layer
from `source_ref` path) for rows where these columns are NULL.

**Breaking change:** behavioral — callers that omit `source_layer` or `target_layer` must
be updated. No DDL change required.

**Valid values:**

- `source_layer`: `landing`, `raw`, `bronze`, `silver`, `gold`
- `target_layer`: `landing`, `raw`, `bronze`, `silver`, `gold`

**Acceptance criteria:**

- `EventLogger.lineage()` abstract method marks `source_layer` and `target_layer` as required parameters
- `DeltaEventLogger.lineage()` and `SnowflakeEventLogger.lineage()` enforce non-null values for both
- All demo notebooks that call `EventLogger.lineage()` (directly or via `build_attribute_lineage_rows()`) supply both parameters
- Consumers querying `meta.data_lineage` must document their NULL-row fallback strategy
- No existing DDL migration is required

---

### LMETA-015 — Add `source_layer` and `target_layer` to `meta.pipeline_runs`

**Requirement:** `meta.pipeline_runs` must include `source_layer STRING` and
`target_layer STRING` columns. These columns are optional (NULL allowed) for backward
compatibility. Allowed values when populated are: `landing`, `raw`, `bronze`, `silver`, `gold`.

**Rationale:** Correlating pipeline runs with lineage hops requires a shared layer
identifier. Without layer columns on `pipeline_runs`, it is not possible to answer
"which pipeline run produced the bronze layer for dataset X?" without parsing
`step` name strings.

**Breaking change:** additive — existing rows get NULL.

**Acceptance criteria:**

- Columns present in DDL for both adapters
- `EventLogger.pipeline_run()` abstract method accepts optional `source_layer` and `target_layer` parameters
- `DeltaEventLogger.pipeline_run()` and `SnowflakeEventLogger.pipeline_run()` write both columns when supplied
- `build_step_logger()` accepts and forwards `source_layer` and `target_layer`
- Existing calls without these parameters write NULL (backwards compatible)

**Migration SQL — Databricks:**

```sql
ALTER TABLE workspace.meta.pipeline_runs ADD COLUMN source_layer STRING;
ALTER TABLE workspace.meta.pipeline_runs ADD COLUMN target_layer STRING;
```

**Migration SQL — Snowflake:**

```sql
ALTER TABLE LATERO.META.PIPELINE_RUNS ADD COLUMN source_layer VARCHAR;
ALTER TABLE LATERO.META.PIPELINE_RUNS ADD COLUMN target_layer VARCHAR;
```

---

### LMETA-016 — Add `job_name` to `meta.data_lineage` and `meta.pipeline_runs`

**Requirement:** Both `meta.data_lineage` and `meta.pipeline_runs` must include a
`job_name STRING` column. The column is optional (NULL allowed). The value stores the
Databricks job name (or equivalent scheduler job name on other platforms) that produced
the lineage hop or pipeline run.

**Rationale:** `dbx_job_id` is a numeric runtime identifier that changes between
deployments. `job_name` is the stable, human-readable key used in Databricks job
definitions and the Meta Insights navigation surface. Without `job_name`, cross-referencing
a pipeline run or lineage hop back to its job definition requires a secondary lookup
through the Databricks Jobs API.

**Consumer contract:** `job_name` in `meta.data_lineage` is a navigable key to the
corresponding Databricks job in Meta Insights. Consumers must treat it as a stable
logical identifier, not a display label.

**Breaking change:** additive — existing rows get NULL.

**Acceptance criteria:**

- Column present in DDL for both adapters in both `pipeline_runs` and `data_lineage`
- `EventLogger.pipeline_run()` and `EventLogger.lineage()` abstract methods accept optional `job_name` parameter
- `DeltaEventLogger.pipeline_run()`, `DeltaEventLogger.lineage()`, `SnowflakeEventLogger.pipeline_run()`, and `SnowflakeEventLogger.lineage()` write `job_name` when supplied
- `build_step_logger()` accepts and forwards `job_name`
- Existing calls without `job_name` write NULL (backwards compatible)

**Migration SQL — Databricks:**

```sql
ALTER TABLE workspace.meta.pipeline_runs ADD COLUMN job_name STRING;
ALTER TABLE workspace.meta.data_lineage ADD COLUMN job_name STRING;
```

**Migration SQL — Snowflake:**

```sql
ALTER TABLE LATERO.META.PIPELINE_RUNS ADD COLUMN job_name VARCHAR;
ALTER TABLE LATERO.META.DATA_LINEAGE ADD COLUMN job_name VARCHAR;
```

---

### LMETA-017 — Add `hop_kind` to `meta.data_lineage`

**Requirement:** `meta.data_lineage` must include a `hop_kind STRING` column. Every caller
of `EventLogger.lineage()` MUST pass `hop_kind`. Valid values are `data_flow` and `context`.

- `data_flow` — a real dataset transition that moves or transforms data; counts toward input/output totals and lineage coverage
- `context` — a framework-internal or evidence reference that is not a data transition; must be excluded from source/target counts, lineage depth, and end-to-end coverage

**NULL treatment (backward compatibility):** Rows written before LMETA-017 have
`hop_kind = NULL`. Consumers MUST treat `NULL` as `data_flow`. All existing medallion
pipeline hops are real data-flow transitions; no existing `context` rows exist in the store.

**Rationale:** Without this field, consumers (e.g. Latero Insights) must heuristically
infer whether a hop is a real data transition or a framework reference by combining
`source_type`, `target_type`, and `relation_type`. This heuristic breaks whenever new
step types are introduced. The producer always knows the role at write time; encoding
it once eliminates consumer-side re-derivation and prevents divergence. See LADR-007.

**Breaking change:** additive — existing rows get NULL.

**Acceptance criteria:**

- Column present in DDL for both adapters
- `EventLogger.lineage()` abstract method includes required `hop_kind` parameter
- `DeltaEventLogger.lineage()` and `SnowflakeEventLogger.lineage()` write `hop_kind`
- All demo notebooks pass `hop_kind = 'data_flow'` for all medallion step hops
- `lineage_entities_current` projector excludes `hop_kind = 'context'` rows from
  `upstream_entity_fqns` and `downstream_entity_fqns`; rows with `NULL` are included
- Latero Insights filters `hop_kind IN ('data_flow') OR hop_kind IS NULL` for all
  source/target/input/output/depth calculations
- No other `hop_kind` values are introduced without a new LMETA requirement

**Migration SQL — Databricks:**

```sql
ALTER TABLE workspace.meta.data_lineage
  ADD COLUMNS (
    hop_kind STRING COMMENT 'Role of this hop: data_flow (real data transition) or context (framework/evidence reference). NULL = data_flow for historical rows.'
  );
```

**Migration SQL — Snowflake:**

```sql
ALTER TABLE LATERO.META.DATA_LINEAGE
  ADD COLUMN hop_kind VARCHAR
    COMMENT 'Role of this hop: data_flow or context. NULL = data_flow for historical rows.';
```

---

## meta.data_lineage

Full required schema:

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| *(base columns)* | | | See above |
| `source_entity` | STRING | no | Source entity name |
| `source_type` | STRING | yes | Source type identifier |
| `source_ref` | STRING | yes | Qualified source reference (path, table, column) |
| `source_attribute` | STRING | no | Attribute name for column-level lineage |
| `target_entity` | STRING | no | Target entity name |
| `target_type` | STRING | yes | Target type identifier |
| `target_ref` | STRING | no | Qualified target reference |
| `target_attribute` | STRING | no | Attribute name for column-level lineage |
| `lineage_evidence` | MAP\<STRING,STRING\> or VARIANT | no | Evidence dict — see LMETA-007 |

### LMETA-007 — Fix Snowflake `data_lineage` missing `installation_id`

**Requirement:** The Snowflake `data_lineage` DDL must include `installation_id VARCHAR`
in the same position as the Databricks DDL. The Snowflake adapter must write the value.

**Rationale:** The Databricks and Snowflake bootstrap SQL are currently inconsistent:
`installation_id` is present in Databricks `data_lineage` but absent from the Snowflake DDL.
Cross-platform deployments produce non-comparable lineage records.

**Breaking change:** additive for new Snowflake installations. Existing Snowflake tables
require `ALTER TABLE LATERO.META.DATA_LINEAGE ADD COLUMN installation_id VARCHAR`.

**Acceptance criteria:**
- `installation_id` present in Snowflake `data_lineage` DDL
- `SnowflakeEventLogger.lineage()` writes `installation_id`

---

### LMETA-010 — `lineage_evidence` type inconsistency

**Requirement:** The inconsistency between `MAP<STRING,STRING>` (Databricks) and `VARIANT`
(Snowflake) for `lineage_evidence` must be documented as a deliberate platform-specific choice,
not as a schema discrepancy.

**Rationale:** `MAP<STRING,STRING>` in Delta Lake flattens nested values but enables direct
MAP key lookup via `getItem()`. Snowflake `VARIANT` preserves JSON structure. Both are
valid representations for their platform. The Latero core should not dictate storage type —
only the logical content.

**Acceptance criteria:**
- A comment in each `bootstrap.sql` documents the choice
- `latero/docs/requirements/meta-table-contract.md` (this file) states the deliberate difference
- No code change required

---

## Abstract EventLogger interface gaps

### LMETA-011 — Add `source_attribute` and `target_attribute` to `EventLogger.lineage()`

**Requirement:** The abstract `EventLogger.lineage()` method must accept `source_attribute`
and `target_attribute` as optional parameters. The Databricks adapter currently hardcodes
them to `None`; attribute-level lineage is only supported via `build_attribute_lineage_rows()`.
The interface must reflect the full capability.

**Breaking change:** additive parameter — existing calls without these parameters continue to work.

**Acceptance criteria:**
- `EventLogger.lineage()` abstract signature includes `source_attribute` and `target_attribute`
- `DeltaEventLogger.lineage()` and `SnowflakeEventLogger.lineage()` pass them through
- `build_attribute_lineage_rows()` can be replaced by direct `lineage()` calls where appropriate

---

## Implementation plan

### Phase 1 — Non-breaking additions (no ALTER TABLE migration needed for new installs)

Implement in a single PR. All changes are additive columns (NULL for existing rows).

| # | Req | Domain | File | Change |
|---|-----|--------|------|--------|
| 1 | LMETA-008 | Latero product | `latero/adapters/databricks/bootstrap.sql` | Add `environment STRING` |
| 2 | LMETA-008 | Latero product | `latero/adapters/snowflake/bootstrap.sql` | Add `environment VARCHAR` |
| 3 | LMETA-009 | Latero product | Both bootstrap.sql | Add `schema_version STRING/VARCHAR NOT NULL DEFAULT '1.1'` |
| 4 | LMETA-003 | Latero product | Both bootstrap.sql | Add `duration_ms BIGINT/NUMBER` to `pipeline_runs` |
| 5 | LMETA-004 | Latero product | Both bootstrap.sql | Add `parent_run_id STRING/VARCHAR` to `pipeline_runs` |
| 6 | LMETA-006 | Latero product | Both bootstrap.sql | Add `policy_version STRING/VARCHAR` to `data_quality_checks` |
| 7 | LMETA-007 | Latero product | `latero/adapters/snowflake/bootstrap.sql` | Add `installation_id VARCHAR` to `data_lineage` |
| 8 | LMETA-011 | Latero product | `latero/framework.py` | Extend `EventLogger.lineage()` signature |
| 9 | LMETA-011 | Latero product | `latero/adapters/databricks/__init__.py` | Pass through `source_attribute`/`target_attribute` |
| 10 | LMETA-011 | Latero product | `latero/adapters/snowflake/__init__.py` | Pass through `source_attribute`/`target_attribute` |
| 11 | LMETA-006 | Latero product | `latero/framework.py` | `register_dq_check()` accepts and passes `policy_version` |
| 12 | LMETA-006 | Latero product | `latero/adapters/databricks/__init__.py` | `build_step_logger()` extracts and forwards `config_schema_version` |
| 13 | LMETA-003 | Latero product | `latero/adapters/databricks/__init__.py` | Compute `duration_ms` in `pipeline_run()` |
| 14 | LMETA-004 | Latero product | `latero/framework.py` | `create_event_logger()` accepts `parent_run_id` |
| 15 | LMETA-002 | Latero product | `latero/framework.py` | `register_dq_check()` catches exceptions → `ERROR` status |
| 16 | LMETA-009 | Latero product | `latero/adapters/databricks/__init__.py` | `_base()` writes `schema_version = META_SCHEMA_VERSION` constant |
| 17 | LMETA-009 | Latero product | `latero/adapters/snowflake/__init__.py` | Same |
| 18 | LMETA-010 | Latero product | Both bootstrap.sql + this doc | Add explanatory comments |
| 19 | LMETA-005 | Latero product | This doc + bootstrap.sql comment | Document struct versioning contract |

### Phase 2 — Breaking rename (requires migration for existing installs)

Implement in a separate PR, after Phase 1 is merged and deployed.

| # | Req | Domain | File | Change |
|---|-----|--------|------|--------|
| 20 | LMETA-001 | Latero product | Both bootstrap.sql | Rename `supplier` → `source_system` |
| 21 | LMETA-001 | Latero product | `latero/framework.py` | All `supplier` parameters → `source_system` |
| 22 | LMETA-001 | Latero product | `latero/adapters/databricks/__init__.py` | All `supplier` references → `source_system` |
| 23 | LMETA-001 | Latero product | `latero/adapters/snowflake/__init__.py` | Same |
| 24 | LMETA-001 | Demo | `notebooks/landing_to_raw.py` | `supplier=` → `source_system=` |
| 25 | LMETA-001 | Demo | `notebooks/raw_to_bronze.py` | Same |
| 26 | LMETA-001 | Demo | `notebooks/bronze_to_silver_logs.py` | Same |
| 27 | LMETA-001 | Demo | `notebooks/silver_to_gold_logs.py` | Same |
| 28 | LMETA-001 | Demo | `lib/spark_utils.py` | Update any `supplier` column queries |
| 29 | LMETA-001 | Demo | `tests/` | Update all test fixtures |
| 30 | LMETA-001 | Latero product | `latero/docs/requirements/meta-table-contract.md` | Remove migration note |

**Migration SQL for existing Databricks installs (Phase 2):**
```sql
ALTER TABLE workspace.meta.pipeline_runs RENAME COLUMN supplier TO source_system;
ALTER TABLE workspace.meta.data_quality_checks RENAME COLUMN supplier TO source_system;
ALTER TABLE workspace.meta.data_lineage RENAME COLUMN supplier TO source_system;
```

**Migration SQL for existing Snowflake installs (Phase 2):**
```sql
ALTER TABLE LATERO.META.PIPELINE_RUNS RENAME COLUMN supplier TO source_system;
ALTER TABLE LATERO.META.DATA_QUALITY_CHECKS RENAME COLUMN supplier TO source_system;
ALTER TABLE LATERO.META.DATA_LINEAGE RENAME COLUMN supplier TO source_system;
```

### Phase 3 — Documentation and proposition

| # | Domain | File | Change |
|---|--------|------|--------|
| 31 | Latero docs | `docs/product/positionering.md` | Add meta table maturity to "Wat onderscheidt Latero" table |
| 32 | Latero docs | `docs/product/vereisten.md` | Add LMETA requirements section |
| 33 | Latero docs | `docs/product/architectuur.md` | Update meta table schema overview |
| 34 | Demo docs | `docs/demo/ontwerp/stappen/` | Update DQ check status docs to include ERROR |
| 35 | Tests | `tests/unit/` | Golden tests for `ERROR` status behavior |
| 36 | Tests | `tests/unit/` | Compatibility test: `source_system` rename |

### Phase 4 — LMETA-017: `hop_kind` field

Implement in a separate PR after Phase 1 is merged.

| # | Req | Domain | File | Change |
|---|-----|--------|------|--------|
| 37 | LMETA-017 | Latero product | `latero/adapters/databricks/bootstrap.sql` | Add `hop_kind STRING` column + migration comment |
| 38 | LMETA-017 | Latero product | `latero/adapters/snowflake/bootstrap.sql` | Add `hop_kind VARCHAR` column + migration comment |
| 39 | LMETA-017 | Latero product | `latero/framework.py` | Add `hop_kind` parameter to `EventLogger.lineage()` and `build_attribute_lineage_rows()` |
| 40 | LMETA-017 | Latero product | `latero/adapters/databricks/__init__.py` | Add `hop_kind` to `DeltaEventLogger.lineage()` |
| 41 | LMETA-017 | Latero product | `latero/adapters/snowflake/__init__.py` | Add `hop_kind` to `SnowflakeEventLogger.lineage()` (cols + values) |
| 42 | LMETA-017 | Demo | `notebooks/landing_to_raw.py` | Pass `hop_kind='data_flow'` on all 3 lineage calls |
| 43 | LMETA-017 | Demo | `notebooks/raw_to_bronze.py` | Pass `hop_kind='data_flow'` |
| 44 | LMETA-017 | Demo | `notebooks/bronze_to_silver_logs.py` | Add `hop_kind='data_flow'` to `lineage_base` dict |
| 45 | LMETA-017 | Demo | `notebooks/silver_to_gold_logs.py` | Pass `hop_kind='data_flow'` on `logger.lineage()` and `build_attribute_lineage_rows()` |
| 46 | LMETA-017 | Demo | `notebooks/lineage_projector.py` | Add `COALESCE(hop_kind, 'data_flow') != 'context'` filter to all 4 WHERE clauses |

### Compatibility and golden test requirements

Before Phase 2 is merged, the following tests must exist and pass:

- `test_register_dq_check_error_status` — verifies that an exception during check evaluation produces an `ERROR` record and then re-raises
- `test_supplier_rename_migration` — verifies that a table with `supplier` column and a migration to `source_system` produces identical query results
- `test_duration_ms_populated` — verifies `duration_ms` is a non-null integer after a pipeline run
- `test_policy_version_stamped` — verifies `policy_version` is written from `config_schema_version`

---

## meta.lineage_entities_current and meta.lineage_attributes_current

### LMETA-012 — Projected current-state lineage tables

**Requirement:** Latero must maintain two projected current-state tables alongside the append-only
`meta.data_lineage` event log. These tables are not event logs. They represent the latest known
lineage state per entity/layer and per attribute relationship respectively. See LADR-005.

These tables are maintained by a dedicated projector component, not by pipeline step notebooks.
Pipeline steps write only to `meta.data_lineage`. The projector reads lineage events and applies
them to the current-state tables via `MERGE INTO`.

**Rationale:** The append-only event log is not suitable for "current state" queries because it
requires aggregation over unbounded history. Tools such as OpenMetadata require a stable,
upsertable current-state object model. See LADR-005.

---

#### `meta.lineage_entities_current` schema

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `installation_id` | STRING | yes | Latero installation identifier (composite key) |
| `environment` | STRING | yes | Deployment environment (composite key) |
| `dataset_id` | STRING | yes | Dataset identifier (composite key) |
| `entity_name` | STRING | yes | Entity name (composite key) |
| `layer` | STRING | yes | Pipeline layer: `landing`, `raw`, `bronze`, `silver`, `gold` (composite key) |
| `entity_fqn` | STRING | no | Fully qualified entity name |
| `latest_run_id` | STRING | no | Run ID of the most recent event for this entity/layer |
| `latest_parent_run_id` | STRING | no | Parent run ID of the most recent event |
| `latest_status` | STRING | no | Status of the most recent producing step |
| `latest_success_at` | STRING | no | Timestamp of the most recent successful run |
| `latest_event_at` | STRING | no | Timestamp of the most recent event (any status) |
| `upstream_entity_fqns` | ARRAY\<STRING\> | no | FQNs of upstream entities as of the latest run |
| `downstream_entity_fqns` | ARRAY\<STRING\> | no | FQNs of downstream entities as of the latest run |
| `openmetadata_synced_at` | STRING | no | Timestamp of last successful OpenMetadata sync |
| `openmetadata_entity_id` | STRING | no | OpenMetadata entity ID for idempotent upserts |

Composite key: `installation_id`, `environment`, `dataset_id`, `entity_name`, `layer`.

`openmetadata_synced_at` and `openmetadata_entity_id` must be preserved across re-projections
(LEFT JOIN on the existing table). Re-running the projector must not clear sync state.

---

#### `meta.lineage_attributes_current` schema

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `target_entity_fqn` | STRING | yes | Fully qualified target entity name (composite key) |
| `target_attribute` | STRING | yes | Target attribute name (composite key) |
| `source_entity_fqn` | STRING | yes | Fully qualified source entity name (composite key) |
| `source_attribute` | STRING | yes | Source attribute name (composite key) |
| `source_layer` | STRING | no | Source pipeline layer |
| `target_layer` | STRING | no | Target pipeline layer |
| `mapping_version` | STRING | no | SHA256 hash of the lineage config at the time of the last run |
| `latest_run_id` | STRING | no | Run ID of the most recent event for this attribute relationship |
| `latest_success_at` | STRING | no | Timestamp of the most recent successful run |

Composite key: `target_entity_fqn`, `target_attribute`, `source_entity_fqn`, `source_attribute`.

`mapping_version` is extracted from `lineage_evidence` in the source event by the projector.
It enables downstream tools to detect when a mapping definition changed between runs.

---

#### Projector behavioral requirements

- The projector reads from `meta.data_lineage` and writes to both current-state tables.
- Pipeline step notebooks must not write to `meta.lineage_entities_current` or
  `meta.lineage_attributes_current` directly.
- The projector must be idempotent: re-running it from scratch must produce the same result
  as an incremental run.
- The projector must run after every pipeline execution that writes lineage events.
- `openmetadata_synced_at` and `openmetadata_entity_id` are preserved via LEFT JOIN on the
  pre-merge state of `lineage_entities_current`.

---

#### `installation_fields()` on `DeltaEventLogger`

**Requirement:** `DeltaEventLogger` must expose an `installation_fields()` method that returns
a dict containing: `installation_id`, `environment`, `schema_version`, `parent_run_id`,
`dbx_job_id`, `dbx_job_run_id`.

**Rationale:** Notebooks that call `append_rows()` directly (e.g. the lineage projector) need
consistent installation metadata without duplicating the field construction logic from `_base()`.

**Acceptance criteria:**

- `DeltaEventLogger.installation_fields()` returns a dict with the six named fields
- The method reads from the same source as `_base()` — no separate configuration lookup
- The method is used by the `lineage_projector` notebook for rows written to current-state tables

---

#### `build_step_logger()` environment and `parent_run_id` auto-derivation

**Requirement:** `build_step_logger()` must automatically derive `environment` from the
runtime config and `parent_run_id` from the Databricks job run context. Callers must not be
required to supply these parameters explicitly.

**Acceptance criteria:**

- `build_step_logger()` reads `environment` from the runtime config without requiring it as a
  call-site parameter
- `build_step_logger()` derives `parent_run_id` from `dbx_job_run_id` when not explicitly
  supplied, consistent with LMETA-004
