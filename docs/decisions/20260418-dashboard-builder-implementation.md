# LADR-008 — Dashboard Builder: implementation decisions

Date: 2026-04-18  
Status: ACCEPTED  
Owner: Layer2 Meta Insights product  
Supersedes: —  
Related: [LADR-007](20260418-dashboard-builder-model.md)

---

## Context

LADR-007 established that every view in Layer2 Meta Insights is a dashboard instance rendered by a unified engine. This ADR records the concrete technical decisions made during the P1–P3 implementation (commit `34db2ce`).

---

## Decision 1 — Widget type system: WidgetSlot + registry

**Decision:** A widget instance on a canvas is represented by `WidgetSlot` (defined in `src/types/dashboard.ts`). The widget library is a static registry array (`WIDGET_REGISTRY` in `dashboard/registry.ts`). Each registry entry provides the React component, default grid size, label, and description.

**Rationale:** Separating the per-instance slot record (`WidgetSlot`) from the widget definition (`WidgetDef`) allows slots to carry instance-level overrides (title, date range) without coupling them to the rendering implementation. The static registry keeps widget discovery O(1) without a dynamic module loader.

**Contract:**
- `WidgetSlot.type` is either a registry key (e.g. `"total-runs"`) or `"custom"` when `customWidgetId` is set.
- Adding a new built-in widget requires only a new entry in `WIDGET_REGISTRY`; no other file changes.
- `ActiveWidget` (previous ad-hoc type in registry.ts) is removed; all callers use `WidgetSlot`.

---

## Decision 2 — Dashboard store: localStorage in v1, context-only runtime

**Decision:** Dashboard state is persisted to localStorage under key `insights-dashboard-store-v1`. The store is loaded once at mount inside `DashboardProvider` and written on every mutation. The React context holds the in-memory state; components never read from localStorage directly.

**Rationale:** localStorage is sufficient for a single-user demo deployment and avoids the need for an authenticated API in v1. The indirection through context means the persistence layer can be swapped for a server call (`/api/dashboards`) in v2 without touching any component.

**Constraints:**
- Server components must not access the store (SSR has no localStorage). `DashboardProvider` is mounted in the client-only `(dashboard)/layout.tsx`.
- System dashboard factory definitions live in `lib/dashboard-store.ts` as plain objects. User overrides of a system dashboard are stored as full records in the dashboards array, identified by the same `"system:*"` ID. Reset removes the override record.

---

## Decision 3 — System dashboard migration: replace page components with DashboardCanvas

**Decision:** `/pipelines`, `/quality`, and `/bcbs239` pages now render `<DashboardCanvas dashboardId="system:*" />` instead of their previous hardcoded dashboard components. The old `PipelinesDashboard`, `QualityDashboard`, and `Bcbs239Dashboard` components are retained as files but are no longer on the route.

**Rationale:** The user requirement is that all views behave as customisable dashboards. Keeping two rendering paths (hardcoded + canvas) would duplicate the system and prevent users from editing the pages they use most.

**Accepted regression:** The previous pages included a run-list table and a `RunDetailDrawer`. These are not yet implemented as widgets and are temporarily unavailable on the `/pipelines` route. They will be restored as widget types in a follow-up (planned: `run-list` widget with row-level detail drawer).

**Scope boundary:** `/lineage`, `/openlineage`, and `/datasets` are specialised graph/table views that do not fit the widget grid model. They remain as fixed pages until a lineage-graph widget type is designed.

---

## Decision 4 — Client-side QueryEngine for custom widgets

**Decision:** Custom widget data queries are executed entirely on the client. The `QueryEngine` (`src/lib/query-engine.ts`) receives a raw array fetched from the existing API endpoints (`/api/pipelines`, `/api/quality`, `/api/lineage`) and applies filtering, grouping, and aggregation in memory.

**Rationale:** The existing API endpoints already return all rows for the selected date range. Adding a server-side query planner would require a new API layer and SQL generation, which is out of scope for v1. The client-side approach reuses the existing endpoints without modification.

**Constraints:**
- Queries are safe by construction: they operate on the JSON payload already returned by the API, never constructing SQL or accessing external systems directly.
- Performance is acceptable for the expected dataset sizes (thousands of rows per date range). If datasets grow into the tens of thousands, a server-side aggregation endpoint should be introduced.
- Supported measures: `count`, `count_where`, `percentage`, `avg`. Supported visual types: `counter`, `bar`, `line`, `area`, `donut`, `table`.

---

## Decision 5 — Widget builder: 4-step wizard at /dashboard/widget-builder

**Decision:** Custom widgets are created through a 4-step wizard page at `/dashboard/widget-builder`. Steps: (1) data source + filters, (2) measure, (3) group-by + chart type with live preview on sample data, (4) label and description. On save the widget definition is written to the store and the user is redirected to `/pipelines`.

**Rationale:** A wizard enforces a valid query configuration at each step before the user can proceed, avoiding invalid combinations (e.g. `avg` without a numeric field). The live preview on step 3 gives immediate visual feedback without requiring real API data.

**Access point:** The widget palette (opened in edit mode on any dashboard) has a "Create custom widget" entry that navigates to the wizard. After saving, the widget appears in the "My Widgets" section of the palette on all dashboards.

---

## Consequences

- Any component that needs to render a widget instance imports `WidgetSlot` from `@/types/dashboard`, not from the registry.
- Any component that needs the widget library imports `WIDGET_REGISTRY` / `getWidgetDef` from `dashboard/registry`.
- `QueryResult` is defined in `@/lib/query-engine`, not in `@/types/dashboard`.
- P4 (server persistence) remains deferred. When implemented, it replaces the `loadStore`/`saveStore` calls in `DashboardProvider` and adds a `/api/dashboards` route. No context or component changes are needed.
