# LADR-007 — Dashboard Builder: unified model for all views

Date: 2026-04-18  
Status: ACCEPTED  
Owner: Layer2 Meta Insights product

---

## Context

Layer2 Meta Insights currently has two kinds of views:

1. **Fixed pages** (`/pipelines`, `/quality`, `/lineage`, etc.) — hardcoded layouts with hardcoded widgets. Cannot be rearranged or extended by the user.
2. **Widget canvas** (`/dashboard`) — drag-and-drop grid with a fixed set of 8 built-in widgets. Introduced in sprint 2026-04-18.

Users want to create their own dashboards, choose which widgets to show, configure data selection per widget (no SQL), and have the existing pages behave in the same way. The product requirement LINS-061 to LINS-064 covers this direction.

---

## Decision

**Every view in Layer2 Meta Insights is a dashboard instance rendered by a unified dashboard engine.**

There is no separate "fixed page" concept. Instead:

1. The existing fixed pages become **system dashboards** — pre-configured dashboard instances that ship with the product. They are fully editable by the user but have a "Reset to Default" action that restores the factory layout.

2. Users can create **personal dashboards** — empty or cloned from a system dashboard. Personal dashboards can be renamed, duplicated, and deleted.

3. A **custom widget builder** allows users to define new widgets using a no-code query builder (data source → measure → grouping → visualization). Custom widget definitions are stored in the dashboard store and reusable across dashboards.

4. The dashboard store persists in localStorage in v1. A server-side persistence endpoint (`/api/dashboards`) is planned for v2.

---

## Consequences

**Positive:**
- All views become first-class configurable dashboards — consistent UX throughout the product
- System dashboards give users a working starting point without configuration
- Custom widget builder removes the need for developer involvement when a user wants a new metric
- The widget canvas built in P1 (2026-04-18) becomes the foundation for the full model

**Negative / Risks:**
- Migration of existing fixed pages to dashboard instances is a significant refactor (estimated P2 phase)
- localStorage persistence limits cross-device and cross-browser access until v2 server persistence is built
- The custom widget `QueryEngine` adds complexity — query specs must be validated and mapped to safe parameterized API calls

**Neutral:**
- Existing widget files (`TotalRunsWidget`, etc.) remain as built-in widget implementations; the registry grows
- The `DashboardCanvas` component from P1 is extended, not replaced

---

## Alternatives Considered

**A — Keep fixed pages, add dashboard canvas as a separate section**  
Rejected. Maintains two UX paradigms in the same product, creating inconsistency. Users cannot customise the existing pages they use most.

**B — Replace all pages with a single configurable dashboard, no system defaults**  
Rejected. Without system defaults, new users face a blank product. System dashboards ensure immediate value without configuration.

**C — Use a third-party BI embedding (Grafana, Redash, Metabase)**  
Rejected. Introduces an external dependency, breaks the Latero brand identity, and requires users to learn a separate tool. The widget builder scope is intentionally narrower and more opinionated than general-purpose BI.

---

## Implementation Record (2026-04-18)

Implemented in commit `34db2ce`. See [LADR-008](20260418-dashboard-builder-implementation.md) for the detailed technical decisions made during implementation.

**Phase coverage:**

- P1 (DashboardStore, context, sidebar, DashboardCanvas, palette, config panel) — DONE
- P2 (system dashboard migration: `/pipelines`, `/quality`, `/bcbs239`) — DONE
- P3 (QueryEngine, WidgetRenderer, custom widget builder wizard) — DONE
- P4 (server-side persistence at `/api/dashboards`) — DEFERRED, blocked on auth/multi-user decision

**Requirements satisfied:** LINS-061, LINS-062, LINS-063, LINS-064 (localStorage scope)
