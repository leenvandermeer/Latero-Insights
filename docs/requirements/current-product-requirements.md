# Latero Insights — Current Product Requirements

Status: CURRENT  
Owner: Latero product

Key words such as MUST, SHOULD, and MAY are used normatively.

## Scope

Latero Insights is a metadata operations product for:

- pipeline monitoring
- data quality visibility
- lineage exploration
- operational evidence workflows

It is not defined as a demo dashboard and not as a browser-side Databricks
reader.

## Product Requirements

### LINS-001 — Modular Repository Model

The repository MUST clearly support two product modules:

- web module
- infra module

Documentation MUST describe those modules explicitly.

### LINS-002 — Store-Backed Read APIs

The primary dashboard read APIs MUST read from the Insights canonical store.

Direct browser-side reads from Databricks or Postgres are not allowed.

### LINS-003 — Server-Side Integration Boundary

All Databricks connectivity MUST remain server-side.

The browser MUST NOT receive Databricks credentials or connect directly to
Databricks endpoints.

### LINS-004 — Local Development Support

The product MUST support both of the following local modes:

1. web local + infra in Docker
2. web + infra in Docker

These modes MUST be documented and runnable through repo scripts.

### LINS-005 — Writable Local State

The product MAY persist local operational state in repo-local writable files for
development and single-tenant operation.

This currently includes:

- `.cache/`
- `data/shared-widgets.json`
- `data/system-overrides.json`

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

The active product name MUST be `Latero Insights`.

Legacy names MAY remain in historical records, but new documentation SHOULD use
the current product name consistently.

### LINS-009 — Requirements Hygiene

Only current, authoritative requirements and architecture documents SHOULD live
in `docs/requirements/`.

Backlogs, brainstorming notes, and obsolete product descriptions SHOULD be
removed or moved elsewhere.

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
