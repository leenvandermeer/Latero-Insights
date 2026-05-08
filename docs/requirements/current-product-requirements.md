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

### LINS-022 — Out-of-the-box system dashboard widget layouts (LADR-068) ✓ IMPLEMENTED

The three system dashboards (Pipelines, Data Quality, BCBS 239) MUST ship with
pre-populated widget layouts that are immediately useful to a new user.

Requirements:
1. Factory defaults are defined in `dashboard-store.ts` and serve as the
   baseline when no operator-published override is present.
2. Operators MAY override the factory default by publishing a custom layout via
   "Publish for everyone" on the dashboard canvas.
3. "Reset to default" on a system dashboard restores the factory-default layout,
   not an empty canvas (as was the case before LADR-068).
4. `SYSTEM_LAYOUT_VERSION` was bumped to 3 to reflect this change.

### LINS-023 — Dashboard favorites/pinning in sidebar navigation (LADR-068) ✓ IMPLEMENTED

Users MUST be able to pin personal dashboards to the sidebar for one-click access.

Requirements:
1. The sidebar MUST always display the three system dashboards (Pipelines, Data
   Quality, BCBS 239) directly in a "Dashboards" section — no click-through needed.
2. A star/pin icon MUST be available on dashboard canvas headers (for personal
   dashboards) and in the dashboard list page.
3. Pinned dashboards MUST appear in the sidebar "Dashboards" section (max 3
   shown, in pin order).
4. Pin state MUST be stored in localStorage per installation:
   key `insights-pinned-dashboards-v1:{installationId}`.
5. System dashboards MUST NOT be pinnable — they are always visible.

### LINS-024 — Simplified dashboard home as searchable list (LADR-068) ✓ IMPLEMENTED

The `/dashboard` home page MUST be a simple, scannable list of all dashboards.

Requirements:
1. The page MUST show all dashboards (system + personal) in a flat list.
2. A text search input MUST filter the list by dashboard name.
3. Tabs (All, System, Mine, Pinned) MUST allow scoped views.
4. Each row MUST show: dashboard name, description (if present), widget count,
   last updated date, a pin toggle (for personal dashboards), and an "Open" button.
5. No hero banner, stat cards, or template sections.

---

### LINS-025 — Entity vs Dataset: conceptual definition (LADR-064) ✓ IMPLEMENTED

The product MUST treat **Entity** and **Dataset** as distinct concepts with a
clear semantic boundary. This boundary MUST be reflected in the data model, the
API surface, and the Catalog UX.

**Definitions:**

| Concept | Definition | Layers |
|---------|-----------|--------|
| **Dataset** | A physical data object tied to a specific layer and namespace. One dataset per `(name, layer)` pair. | landing, raw, bronze |
| **Entity** | A business concept that aggregates one or more datasets across layers. An entity may span multiple layers and be fed by multiple source datasets. | silver, gold (may reference all layers) |

**Normative rules:**
1. `dataset_id` MUST be a composed key: `{dataset_name}::{layer}`.
2. `entity_id` MUST be a stable business identifier (e.g. `gemeente_arbeid`).
3. An entity MAY have `layer_statuses` — an array of per-layer run statuses across all datasets linked to that entity.
4. A dataset MUST belong to exactly one layer. An entity MAY span multiple layers.
5. The Catalog `/catalog?tab=entities` view MUST show entities. The
   `/catalog?tab=datasets` view MUST show datasets.
6. The distinction MUST be documented in LADR-064.

---

### LINS-026 — Aligned catalog filters: entity and dataset tabs (LADR-064) ✓ IMPLEMENTED

The Catalog entity and dataset tabs MUST offer equivalent filter capabilities
so operators can navigate both views consistently.

Requirements:
1. Both tabs MUST provide a **text search** input (filters by name/id).
2. Both tabs MUST provide **layer filter** buttons (All, landing, raw, bronze, silver, gold).
   - For entities: filters to entities that have at least one dataset in the selected layer.
   - For datasets: filters to datasets in the selected layer (direct layer field match).
3. The entity tab MUST additionally provide a **health status filter**
   (All, Success, Failed, Warning, Running) — because entities aggregate
   per-layer run statuses into a health status.
4. All active filters MUST be reflected in the page URL as query parameters
   (`entity_layer`, `entity_status`, `entity_q`, `dataset_layer`, `dataset_q`)
   so filter state is shareable and bookmarkable.
5. The empty state message MUST differentiate between "no data" and
   "no results for current filters".

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
