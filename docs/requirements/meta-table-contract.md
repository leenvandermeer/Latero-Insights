# Latero Meta Table Contract — Normative Requirements

Version: 1.1-draft
Status: DRAFT — pending implementation of LMETA-001 through LMETA-010
Owner: Latero product

---

## Scope

This document defines the normative requirements for the three Latero meta tables:

- `meta.pipeline_runs`
- `meta.data_quality_checks`
- `meta.data_lineage`

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
| `hop_kind` | STRING | no | Semantic hop role: `data_flow` or `context`; NULL defaults to `data_flow` for historical rows |

### LMETA-007 — Fix Snowflake `data_lineage` missing `installation_id`

**Requirement:** The Snowflake `data_lineage` DDL must include `installation_id VARCHAR`
in the same position as the Databricks DDL. The Snowflake adapter must write the value.

**Rationale:** The Databricks and Snowflake bootstrap SQL are currently inconsistent:
`installation_id` is present in Databricks `data_lineage` but absent from the Snowflake DDL.
Cross-platform deployments produce non-comparable lineage records.

**Breaking change:** additive for new Snowflake installations. Existing Snowflake tables
require `ALTER TABLE LAYERTO.META.DATA_LINEAGE ADD COLUMN installation_id VARCHAR`.

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

### LMETA-012 — Semantic lineage hop role via `hop_kind`

**Requirement:** `meta.data_lineage` must include a nullable `hop_kind STRING`
column with the following semantics:

| Value | Meaning |
|-------|---------|
| `data_flow` | A real source-to-target data transfer that counts for lineage inputs, outputs, sources, targets, and lineage depth |
| `context` | A contextual or technical relation that may be shown as evidence, but must not count as a material lineage edge |
| `NULL` | Treated as `data_flow` for backwards compatibility with historical rows |

**Rationale:** Consumers must not infer material lineage from heuristics on
`source_ref`, `target_ref`, or entity names. The producer must explicitly mark
whether a hop represents real data movement or only context.

**Breaking change:** additive — historical rows remain valid and default to
`data_flow` semantics.

**Acceptance criteria:**
- Column present in Databricks and Snowflake DDL
- Producer writes `hop_kind = 'data_flow'` for real dataset and column lineage
- Producer writes `hop_kind = 'context'` for contextual edges
- Hop-based consumers count only `data_flow`
- Derived current lineage projections must be built from `data_flow` hops only
  when they depend on `meta.data_lineage`

---

### LMETA-013 — Environment-scoped live reads

**Requirement:** Installations that write multiple environments or demo data
into the same physical meta tables must provide an explicit environment scope
for live consumers. The `environment` column becomes part of the operational
read contract, not only write-time metadata.

**Rationale:** A live dashboard cannot safely distinguish demo from production
data by filtering on naming conventions such as `demo_` prefixes. Live reads
must be explicitly scoped to the intended `environment`.

**Acceptance criteria:**
- Live consumers can constrain reads by exact `environment`
- Demo and live rows are never mixed in a single live dashboard response
- If current lineage views are environment-specific, that scope is documented
  and preserved in their build process

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
ALTER TABLE LAYERTO.META.PIPELINE_RUNS RENAME COLUMN supplier TO source_system;
ALTER TABLE LAYERTO.META.DATA_QUALITY_CHECKS RENAME COLUMN supplier TO source_system;
ALTER TABLE LAYERTO.META.DATA_LINEAGE RENAME COLUMN supplier TO source_system;
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

### Compatibility and golden test requirements

Before Phase 2 is merged, the following tests must exist and pass:

- `test_register_dq_check_error_status` — verifies that an exception during check evaluation produces an `ERROR` record and then re-raises
- `test_supplier_rename_migration` — verifies that a table with `supplier` column and a migration to `source_system` produces identical query results
- `test_duration_ms_populated` — verifies `duration_ms` is a non-null integer after a pipeline run
- `test_policy_version_stamped` — verifies `policy_version` is written from `config_schema_version`
