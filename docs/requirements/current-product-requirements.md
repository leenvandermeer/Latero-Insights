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

All user-facing product UI text MUST be in English.

This includes:

- navigation labels
- page titles and descriptions
- buttons and form labels
- validation, empty, and error states
- dashboard, settings, and admin interface text

Dutch MAY remain in historical documentation, ADR context sections, or other
non-product-authoring material, but it MUST NOT appear in the active product UI.

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

## Deferred Backlog

### B-001 — Full Session Auth (Future Option B)

The product MAY evolve from installation API key login to full user/session
authentication using NextAuth.js or Clerk.

If implemented, the authenticated session SHOULD carry an installation/tenant
claim, and all read APIs MUST continue enforcing installation scoping based on
that claim.

This is explicitly deferred and not part of the current implementation scope.

## Authoritative Companion Documents

- [Current Architecture](./current-architecture.md)
- [Latero Meta Table Contract](./meta-table-contract.mdcf.md)
- [Insights SaaS Integration Guide](./mdcf-integration/INSIGHTS_SAAS_INTEGRATION_GUIDE.md)
