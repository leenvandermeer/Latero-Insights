# Latero Control SQL Schema Reference

Status: CURRENT — bijgewerkt 2026-05-04  
Owner: Latero product

This document describes the Postgres schema used by Latero Control.

Authoritative SQL source: `infra/sql/init/` (migrations 001–017)

## Overview

The schema uses two namespaces:

- **`public.*`** — installation registry, session, auth, audit tables
- **`meta.*`** — operational metadata store (V2 canonical read/write schema)

The `public.pipeline_runs`, `public.data_quality_checks`, and
`public.data_lineage` legacy event tables were dropped in migration 014.
All operational data is now in `meta.*`.

---

## Public Schema Tables

### `insights_installations`

Purpose: installation registry with API token hash and active flag.

Key columns: `installation_id` (PK), `environment`, `token_hash`, `active`, `created_at`, `updated_at`

### `app_users`

User accounts with password hash, role, and 2FA fields.

Key columns: `user_id`, `email`, `password_hash`, `is_admin`, `totp_secret`, `totp_enabled`

### `user_sessions`

Active session store.

Key columns: `session_id`, `user_id`, `installation_id`, `expires_at`

### `sso_configs`

Per-installation SSO/OIDC configuration.

Key columns: `installation_id`, `provider`, `issuer_url`, `client_id`, `client_secret`

### `admin_audit_log` / `auth_audit_log`

Audit trails for admin actions and authentication events.

---

## Meta Schema Tables (`meta.*`)

### `meta.datasets`

Catalog of known data assets observed across runs.

Key columns:
- `dataset_id` — scoped identifier
- `installation_id` — FK to `insights_installations`
- `fqn` — fully qualified name
- `namespace`, `object_name`
- `platform` — `ICEBERG`, `DELTA`, `HIVE`, `JDBC`, `FILE`, `TOPIC`, `UNKNOWN`
- `entity_type` — `TABLE`, `VIEW`, `STREAM`, `FILE`, `TOPIC`
- `entity_id` — FK (soft) to `meta.entities`
- `group_id` — layer-scoped grouping key (migration 016)
- `dataset_facets` — JSONB facets from OpenLineage (migration 017)
- `first_seen_at`, `last_seen_at`

### `meta.jobs`

Pipeline / job definitions (stable, not per-run).

Key columns: `job_id` (UUID PK), `installation_id`, `job_name`, `job_type` (`PIPELINE`, `SYNC`, `VALIDATION`)

### `meta.runs`

Execution instances of jobs.

Key columns:
- `run_id` (UUID PK)
- `job_id` (FK), `installation_id`
- `external_run_id`, `parent_run_id`
- `step`, `status` (`SUCCESS`, `FAILED`, `WARNING`, `RUNNING`)
- `environment`, `started_at`, `ended_at`, `duration_ms`
- `run_date` (generated from `started_at`)
- `run_facets` — JSONB facets from OpenLineage (migration 017)

### `meta.run_io`

Which datasets a run reads (INPUT) or writes (OUTPUT).

Key columns: `run_id` (FK), `dataset_id`, `role` (`INPUT`, `OUTPUT`), `observed_at`

### `meta.quality_rules`

Check definitions (stable, not per-result).

Key columns: `check_id`, `installation_id`, `check_name`, `check_category`, `severity` (`HIGH`, `MEDIUM`, `LOW`), `dataset_id`

### `meta.quality_results`

Check execution results per run.

Key columns: `result_id` (UUID), `check_id`, `run_id`, `status` (`SUCCESS`, `FAILED`, `WARNING`), `result_value`, `threshold_value`, `executed_at`

### `meta.lineage_edges`

Table-level lineage graph — upsert model (one row per unique source→target pair).

Key columns: `edge_id` (UUID), `installation_id`, `source_dataset_id`, `target_dataset_id`, `first_observed_at`, `last_observed_at`, `observation_count`

### `meta.lineage_columns`

Column-level lineage.

Key columns: `column_edge_id` (UUID), `source_dataset_id`, `source_column`, `target_dataset_id`, `target_column`, `transformation_type`

Valid `transformation_type`: `IDENTITY`, `AGGREGATION`, `DERIVED`, `FILTER`, `RENAME`, `UNKNOWN`

### `meta.data_products`

Data product registry.

Key columns: `data_product_id`, `installation_id`, `display_name`, `description`, `owner`, `domain`, `tags` (JSONB)

### `meta.entities`

Entity registry — grouping of related datasets across layers.

Key columns: `entity_id`, `installation_id`, `data_product_id` (FK), `display_name`, `description`, `owner`, `tags` (JSONB)

---

## Migrations

| File | Content |
|------|---------|
| 001 | Base installation + event tables (legacy) |
| 002 | License and installations |
| 003 | Session auth |
| 004 | Admin audit |
| 007 | SSO auth |
| 008 | SSO role mapping |
| 009 | Auth audit log |
| 010 | TOTP 2FA |
| 011 | Default installation |
| 012 | Nullable session installation |
| 013 | `meta.*` schema (datasets, jobs, runs, run_io, quality_rules/results, lineage_edges/columns) |
| 014 | Drop legacy event tables (`public.pipeline_runs`, `public.data_quality_checks`, `public.data_lineage`) |
| 015 | OpenLineage alignment |
| 016 | Layer-scoped dataset IDs + `group_id` |
| 017 | V2 data model: `meta.data_products`, `meta.entities`, `entity_id` FK, `run_facets`, `dataset_facets` |

---

## Related Documents

- [Current API Reference](./current-api-reference.md)
- [Current Architecture](./current-architecture.md)
