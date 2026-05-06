# Latero Control — Current Product Requirements

Status: CURRENT  
Owner: Latero product

Key words such as MUST, SHOULD, and MAY are used normatively.

## Scope

Latero Control is a standalone metadata operations product for data teams.
It provides:

- pipeline monitoring
- data quality visibility
- lineage exploration
- operational evidence workflows

Latero Control is a self-contained product positioned for SaaS delivery.
It is not a demo dashboard and not a browser-side data platform viewer.

The product supports two integration modes:

1. **API mode** — Latero runtimes push events via `/api/v1/*`. Data is stored
   in the Insights Postgres store.
2. **Databricks mode** — Operators trigger a pull sync via
   `POST /api/sync/databricks`. Data is pulled into the same Insights store.

Both modes write to the same canonical store. The product layer is identical
regardless of which mode is active.

## Product Requirements

### LINS-001 — Modular Repository Model

The repository MUST clearly support two product modules:

- web module
- infra module

Documentation MUST describe those modules explicitly.

### LINS-002 — Store-Backed Read APIs

All dashboard read APIs MUST read from the Insights Postgres store.

Direct browser-side reads from any external data platform are not allowed.

### LINS-003 — Server-Side Integration Boundary

All external data platform connectivity MUST remain server-side.

The browser MUST NOT receive credentials or connect directly to any data
platform endpoint. This applies to both integration modes.

### LINS-004 — Local Development Support

The product MUST support both of the following local modes:

1. web local + infra in Docker
2. web + infra in Docker

These modes MUST be documented and runnable through repo scripts.

### LINS-005 — Writable Local State

The product MAY persist local operational state in repo-local writable files for
development and single-tenant operation.

This currently includes:

- `data/shared-widgets.json`
- `data/system-overrides.json`
- `.cache/` (fallback and local resilience)

### LINS-006 — Dashboard-First UX

Operational views MUST remain dashboard-oriented and task-oriented.

The product MUST support:

- system dashboards
- personal dashboards
- widget-based composition
- in-place widget configuration

### LINS-007 — Lineage and Evidence Workflows

The product MUST expose:

- lineage exploration
- OpenLineage evidence views
- dataset health workflows

These experiences SHOULD read from the same operational model where possible.

### LINS-008 — Product Naming Consistency

The active product name MUST be `Latero Control`.

Legacy names MAY remain in historical records, but new documentation SHOULD use
the current product name consistently.

### LINS-009 — Requirements Hygiene

Only current, authoritative requirements and architecture documents SHOULD live
in `docs/requirements/`.

Backlogs, brainstorming notes, and obsolete product descriptions SHOULD be
removed or moved elsewhere.

### LINS-010 — Admin Dashboard Availability (LADR-028)

The product MUST provide an admin-only dashboard for operator management of
multi-tenant lifecycle. This includes:

- Installation creation, editing, and soft-archival
- User membership management across installations
- API key rotation and revocation with usage tracking
- Health status monitoring per installation
- Audit logging of administrative actions

Admin access is controlled via session role verification (`is_admin` flag) with
bearer token fallback for external tooling.

### LINS-011 — Installation Lifecycle API (LADR-028)

The product MUST expose server-side API routes under `/api/v1/admin/*` for:

- Listing installations with health snapshots
- Creating installations (returns API key once)
- Editing installation metadata (name, environment, tier, contact)
- Rotating and revoking API keys

All routes MUST enforce admin role verification and log actions to
`insights_admin_audit_log`.

### LINS-012 — Health Status Monitoring (LADR-028)

The product MUST compute and expose health status per installation, including:

- Database connectivity and latency
- Message throughput (24h count)
- Error rate (percentage of failed ingest events)
- Cache hit ratio (if applicable)
- Aggregated metrics across all installations

Health status is cached for 5 minutes to avoid excessive database load.

### LINS-013 — User and Role Management (LADR-028)

The product MUST allow admins to:

- View all users and their installations/roles
- Modify user roles per installation
- Revoke user access to specific installations

Role types are: `member`, `admin`, `operator`, `viewer` (extensible).

### LINS-014 — Admin Audit Trail (LADR-028)

All administrative actions (create installation, rotate key, modify user, etc.)
MUST be logged to `insights_admin_audit_log` with:

- Timestamp, admin user ID, action type
- Resource type and ID
- Change details (JSON)
- IP address

Admins MUST be able to query the audit log with filters (date range, user,
action type, resource type).

### LINS-015 — English UI Language

Latero Control is an English-only product. **All user-facing text MUST be in English without exception.**

This includes:

- navigation labels
- page titles, headings, and descriptions
- buttons, form labels, and placeholders
- validation messages, empty states, and error states
- dashboard, widget, settings, and admin interface text
- tooltips, badges, status labels, and inline help text
- onboarding, login, and authentication UI

Dutch MAY remain in:
- ADR context/rationale sections
- Internal team documentation
- Non-product-authoring material (e.g. README prose, commit messages)

Dutch MUST NOT appear in any rendered UI, including component labels, API error messages surfaced to the user, or any string visible in the browser.

### LINS-016 — Strict Tenant Data Isolation

A fundamental security boundary: **Data from one tenant MUST NOT be visible in
another tenant's context.**

Requirements:

1. All read APIs in `/api/*` (non-admin routes) MUST enforce tenant scoping via
   the session's `active_installation_id`.

2. No query, cache key, or API response MUST contain data from any installation
   other than the user's active installation.

3. Any user attempting to access data from an installation other than their
   active installation MUST receive a 403 Forbidden response.

4. Session tokens and cookies MUST NOT be forged to switch installations without
   explicit authorization (installation reassignment via dedicated admin endpoint).

5. Cache keys MUST include `installation_id` to prevent cross-tenant cache hits.

6. Cross-tenant data aggregation (e.g., system health across all installations)
   is ONLY visible to admin users via `/api/v1/admin/*` endpoints, which MUST
   verify the `is_admin` role.

7. All enforcement MUST be server-side; client-side access control is
   insufficient.

This requirement is the foundation for multi-tenant safe operation.

### LINS-017 — (Skipped)

LINS-017 was not assigned. The numbering gap is intentional and is preserved for traceability.

### LINS-018 — Installation data reset (admin) ✓ IMPLEMENTED

An admin MUST be able to delete all operational data for a specific installation via the admin module, without removing the installation definition itself.

Scope of deletion:
- `meta.quality_results`, `meta.run_io`, `meta.lineage_columns`, `meta.lineage_edges`
- `meta.runs`, `meta.jobs`, `meta.datasets`, `meta.entities`, `meta.data_products`

Scope of preservation:
- `insights_installations` row, users, SSO config, settings (`.cache/`)

Rules:
1. Only executable by an `is_admin = true` session
2. Requires explicit confirmation via `installation_id` input in the UI
3. Fully audited in `admin_audit_log` (actor, target, deleted counts, timestamp)
4. API route: `DELETE /api/v1/admin/installations/[installation_id]/data`
5. Response contains deleted counts per table and total
6. Irreversible

### LINS-019 — Sync outcome feedback in the UI ✓ IMPLEMENTED

After every sync action, the user MUST see a visible status message:
- `synced > 0`: *"Synced N records in Xs"* (green)
- `synced = 0`: *"Sync complete — no new records found. Existing data unchanged."* (amber)
- Error: error message (red)

Implementation: inline feedback below the sync button on the Settings page.

### LINS-020 — Job name as primary identifier in the runs table ✓ IMPLEMENTED

The runs table at `/runs` MUST show the pipeline job name as the primary identifier, not the dataset ID.

Rationale: `dataset_id` (e.g. `"arbeidsmarkt"`) is a technical key that conveys nothing about the job that ran. The operator needs to know which job executed, not which dataset object was updated.

Requirements:
1. The "Dataset" column is renamed to "Job"
2. `job_name` is shown instead of `dataset_id`
3. If the Databricks source contains a native `job_name` column (optional), that value is stored and shown
4. Fallback when no native job name is available: `dataset_id` — a direct DB field value, never constructed
5. The `/api/runs` route already returns `job_name` — only the UI display changes
6. Databricks sync passes the native `job_name` to `writeMetaPipelineRun` when available

### LINS-021 — No fabricated values in the data store ✓ IMPLEMENTED

All values written to Postgres or derived in read queries and UI logic MUST originate from direct database fields of the source (Databricks or API ingest). Construction, parsing, or derivation of values is forbidden.

Forbidden patterns:
- Deriving layer from a step name (e.g. `"raw_to_bronze"` → `"bronze"`) — `extractTargetLayerFromStep` removed
- Deriving layer from an FQN (e.g. `"workspace.bronze.fact_sales"` → `"bronze"`) — `extractLayerFromFqn` removed
- Constructing a job name as `{dataset_id}:{step}` or `{dataset_id}.{step}` — removed; fallback is `dataset_id` (direct DB value)
- Stripping layer prefixes from entity names (e.g. `"silver_gemeente_arbeid"` → `"gemeente_arbeid"`) — `stripLayerPrefix` removed
- SQL `split_part(step, '_to_', N)` or `regexp_replace` to derive layer from step — removed from read queries

Allowed: writing `null` when a field is absent in the source.

## Implemented (was Deferred Backlog)

### B-001 — Full Session Auth ✓ IMPLEMENTED

Session authentication with username/password, TOTP 2FA, and SSO (OIDC/Keycloak)
is now implemented as the primary auth model.

The authenticated session carries an `installation_id` claim. All read APIs
enforce installation scoping based on that claim. Bearer token auth (`/api/v1/*`)
remains available for ingest clients.

Reference: LADR-020 (session auth), LADR-030 (SSO), LADR-031 (Keycloak), LADR-032 (2FA)

## Authoritative Companion Documents

- [Current Architecture](./current-architecture.md)
- [Current API Reference](./current-api-reference.md)
- [SQL Schema Reference](./sql-schema-reference.md)
- [Insights SaaS Integration Guide](./mdcf-integration/INSIGHTS_SAAS_INTEGRATION_GUIDE.md)
