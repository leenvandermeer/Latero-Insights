# Latero Control API Reference

Status: CURRENT — bijgewerkt 2026-05-16  
Owner: Latero product

For the full external ingest contract, see:

- [Insights SaaS API Contract](./mdcf-integration/INSIGHTS_SAAS_API_CONTRACT.yml)
- [Insights SaaS Integration Guide](./mdcf-integration/INSIGHTS_SAAS_INTEGRATION_GUIDE.md)

---

## API Groups

| Group | Prefix | Consumers |
|-------|--------|----------|
| Dashboard read APIs | `/api/*` | Web UI (TanStack Query hooks) |
| Auth APIs | `/api/auth/*` | Web UI login/session flows |
| Versioned ingest | `/api/v1/*` | Latero runtimes, integration clients |
| Admin | `/api/v1/admin/*` | Admin-only operator tooling |

---

## Dashboard Read APIs

### `GET /api/health`
Basic health check. Returns `status`, database connectivity, timestamp.

### `GET /api/health/estate`
Aggregate estate health across the active installation.  
Returns: `data_product_count`, `entity_count`, `issue_count`, `dq_pass_rate`, `last_run_at`.

### `GET /api/runs`
Paginated run history.  
Query params: `from` (YYYY-MM-DD, default last 30 days), `to`, `status`, `step`, `entity`, `product_id`, `cursor`  
Returns: `{ data, source, next_cursor }`

### `GET /api/runs/[run_id]`
Run detail with relations.  
Returns: run fields + `io_datasets`, `dq_checks`, `lineage_edges`, `child_runs`.

### `GET /api/entities`
Entity list with aggregated health status per entity.  
Query params: `product_id`, `status`, `q`

### `GET /api/entities/[fqn]`
Entity detail with `layer_statuses` array.

### `GET /api/entities/[fqn]/runs`
Run history for a specific entity.

### `GET /api/data-products`
Data product list with `entity_count` per product.

### `GET /api/pipelines`
Legacy pipeline run read (V1 model). Reads from Insights store with snapshot fallback.  
Query params: `from` (required), `to` (required)

### `GET /api/quality`
Data quality check results.  
Query params: `from` (required), `to` (required), `run_id` (optional), `entity_fqn` (optional)

### `GET /api/lineage`
Lineage hops for a date range.  
Query params: `from` (required), `to` (required)

### `GET /api/lineage/entities`
Current lineage entity projection from `meta.datasets` + `meta.lineage_edges`.

### `GET /api/lineage/attributes`
Current lineage attribute projection from `meta.lineage_columns`.

### `GET /api/settings` / `PUT /api/settings`
Runtime settings (Databricks host, token, warehouse, catalog, schema, cache TTL).

### `POST /api/test-connection`
Test Databricks connectivity with current runtime settings.

### `POST /api/sync/databricks`
Pull sync from Databricks into the Insights store.  
Body: `{ from?, to? }` (defaults to last 7 days)

### `GET /api/widgets/shared` / `POST` / `DELETE /api/widgets/shared/[id]`
Shared widget library. JSON-backed, persisted to `web/data/shared-widgets.json`.

### `GET /api/dashboards/system`
System dashboard registry.

### `GET /api/installations`
Active installations for the current user session.

---

## Auth APIs

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/login` | POST | Password login, returns session cookie |
| `/api/auth/logout` | POST | Invalidate session |
| `/api/auth/session` | GET | Current session info |
| `/api/auth/switch-installation` | POST | Switch active installation |
| `/api/auth/set-default-installation` | POST | Set default installation for user |
| `/api/auth/password-reset` | POST | Request password reset email |
| `/api/auth/password-reset/confirm` | POST | Confirm password reset with token |
| `/api/auth/policy` | GET | Auth policy for a domain (`?hint=email`) |
| `/api/auth/sso/initiate` | POST | Start OIDC SSO flow |
| `/api/auth/sso/callback` | GET | OIDC callback handler |
| `/api/auth/2fa/verify` | POST | Verify TOTP code |
| `/api/account/2fa` | GET/DELETE | 2FA status and revocation |
| `/api/account/2fa/setup/initiate` | POST | Begin 2FA setup |
| `/api/account/2fa/setup/confirm` | POST | Confirm 2FA setup |

---

## Versioned Ingest APIs (`/api/v1/*`)

Common behavior:
- Bearer token auth per installation (except `/api/v1/health`)
- Rate-limited
- Writes to Postgres `meta.*` schema

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/health` | GET | Ingest API health |
| `/api/v1/events` | POST | OpenLineage RunEvent ingest (canonical V2) |
| `/api/v1/pipeline-runs` | POST | Legacy pipeline run ingest |
| `/api/v1/dq-checks` | POST | Legacy DQ check ingest |
| `/api/v1/lineage` | POST | Direct lineage ingest for dataset- and column-level edges (legacy aliases supported) |
| `/api/v1/ingest` | POST | Generic ingest endpoint |
| `/api/v1/me` | GET | Current user info |
| `/api/v1/users` | GET | Users for active installation |
| `/api/v1/installations` | GET | Installations for current user |
| `/api/v1/installations/[id]` | GET | Installation detail |
| `/api/v1/installations/[id]/status` | GET | Ingest status counts |
| `/api/v1/installations/[id]/rotate-key` | POST | Rotate API key |
| `/api/v1/license/validate` | POST | License validation |

### `POST /api/v1/events` — OpenLineage ingest (V2 canonical)

Primary ingest endpoint for Latero runtimes.  
Accepts an OpenLineage `RunEvent` or array of `RunEvent`.  
Auth: Bearer token; `installation_id` from `producer` or `installation_id` field.  
Processes: runs, run_io, lineage_edges, lineage_columns (ColumnLineageFacet), quality_results (DataQualityAssertionsFacet).

### `POST /api/v1/lineage` — direct lineage ingest

Compatibility endpoint for runtimes and adapters that post lineage without the
generic batch envelope. Accepts canonical `source_ref` / `target_ref` fields and
still accepts legacy aliases `input_entity` / `output_entity`.

Supports:
- Dataset lineage via `source_ref`, `target_ref`, `source_layer`, `target_layer`
- Column lineage via optional `source_attribute`, `target_attribute`
- Forward-compatible metadata fields such as `lineage_scope`, `relation_type`, `evidence`

Current storage behavior:
- `meta.lineage_edges` is driven by the resolved source and target refs plus layers
- `meta.lineage_columns` is additionally written when both attribute fields are present
- `relation_type` and `evidence` are accepted for compatibility and audit logging, but are not yet materialized as first-class columns in `meta.*`

---

## Admin APIs (`/api/v1/admin/*`)

All routes require `is_admin = true` on the session.

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/admin/health` | GET | System-wide health across all installations |
| `/api/v1/admin/audit` | GET | Admin audit log |
| `/api/v1/admin/installations` | GET/POST | List / create installations |
| `/api/v1/admin/installations/[id]` | GET/PATCH/DELETE | Installation CRUD |
| `/api/v1/admin/installations/[id]/rotate-key` | POST | Force key rotation |
| `/api/v1/admin/installations/[id]/auth-config` | GET/PUT | SSO auth config per installation |
| `/api/v1/admin/installations/[id]/auth-config/test` | POST | Test SSO config |
| `/api/v1/admin/users` | GET/POST | User management |
| `/api/v1/admin/users/[id]` | GET/PATCH/DELETE | User CRUD |
| `/api/v1/admin/users/[id]/reset-password` | POST | Force password reset |
| `/api/v1/admin/users/[id]/2fa` | DELETE | Revoke 2FA |

---

## Storage Model

**Read side:** all dashboard APIs read from `meta.*` tables in Postgres.  
**Write side:** `/api/v1/*` writes to `meta.*`; `/api/sync/databricks` pulls from Databricks into the same store.  
**Schema:** `infra/sql/init/` (migrations 001–017+)
