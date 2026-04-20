# LADR-011 — Remove static dashboard views; all routes serve the dashboard builder

Date: 2026-04-19
Status: ACCEPTED
Owner: Layer2 Meta Insights product
Related: [LADR-007](20260418-dashboard-builder-model.md), [LADR-008](20260418-dashboard-builder-implementation.md), [LADR-010](20260419-dashboard-ux-cta-and-placement.md)

---

## Context

Layer2 Meta Insights originally shipped with three hardcoded dashboard views implemented as standalone React components:

- `/pipelines` → `PipelinesDashboard` (own chart components: status-trend-chart, step-duration-chart, run-detail-drawer, run-viewer)
- `/quality` → `QualityDashboard` (own chart components: pass-rate-trend-chart, severity-chart, check-viewer)
- `/bcbs239` → `Bcbs239Dashboard` (own chart components: compliance-trend-chart, principle-score-card)

These were non-customisable, single-purpose pages — similar in nature to a static Power BI report embedded in a web page. They were built before the dashboard builder existed (LADR-007/008) and had no relationship to the widget system, layout persistence, or the `DashboardStoreData` model.

After LADR-007/008/009/010, a fully functional dashboard builder exists with:
- A widget registry covering all data the static views displayed
- Responsive grid layout with per-dashboard persistence
- System dashboard definitions (`SYSTEM_DASHBOARD_DEFS`) already defining optimal layouts for Pipelines, Data Quality, and BCBS239
- `system:pipelines`, `system:quality`, `system:bcbs239` IDs that map to `/pipelines`, `/quality`, `/bcbs239` routes

The static components had become unreachable dead code — the `page.tsx` files for all three routes already delegated to `DashboardCanvas` before this ADR.

---

## Decision

All static dashboard view components and their dedicated chart sub-components are **removed**. The three routes serve the dashboard builder exclusively:

| Route | Dashboard ID | Default widgets |
| --- | --- | --- |
| `/pipelines` | `system:pipelines` | Total Runs, Failed Runs, Event Log, Run Status Trend, Avg Duration by Step, Recent Pipeline Runs table |
| `/quality` | `system:quality` | DQ Pass Rate, Failed Runs, DQ Pass Rate Trend, Results by Category, DQ Check Results table |
| `/bcbs239` | `system:bcbs239` | BCBS239 Score, DQ Pass Rate, Failed Runs, DQ Pass Rate Trend, Results by Category, DQ Check Results table |

Each route's `page.tsx` contains exactly one line: `return <DashboardCanvas dashboardId="system:..." />`.

Users can customise layouts and add/remove widgets. "Reset to default" restores the default system layout defined in `dashboard-store.ts`.

---

## Rationale

1. **One mental model** — every view in the product is a dashboard. Users learn one interaction pattern (widget library, drag, configure) rather than two (static view + builder).
2. **Composability** — system dashboards are now just another dashboard. Users can duplicate them, extend them, or create personal variants.
3. **Code reduction** — 12 files deleted, 3 chart component trees removed. Widget implementations in the registry already cover the same data.
4. **Separation of concerns** — chart rendering logic is now owned by the widget components in `src/app/(dashboard)/dashboard/widgets/`, not duplicated across per-route chart files.

---

## Consequences

- `src/app/(dashboard)/pipelines/dashboard.tsx` and all sibling chart files are **deleted**
- `src/app/(dashboard)/quality/dashboard.tsx` and all sibling chart files are **deleted**
- `src/app/(dashboard)/bcbs239/dashboard.tsx` and all sibling chart files are **deleted**
- LINS-020, LINS-021, LINS-025 are updated to specify system dashboard requirements instead of fixed component requirements
- Sidebar "SYSTEM DASHBOARDS" section remains; nav items continue pointing to the same routes

---

## Files deleted

| File |
| --- |
| `src/app/(dashboard)/pipelines/dashboard.tsx` |
| `src/app/(dashboard)/pipelines/status-trend-chart.tsx` |
| `src/app/(dashboard)/pipelines/step-duration-chart.tsx` |
| `src/app/(dashboard)/pipelines/run-detail-drawer.tsx` |
| `src/app/(dashboard)/pipelines/run-viewer.tsx` |
| `src/app/(dashboard)/quality/dashboard.tsx` |
| `src/app/(dashboard)/quality/pass-rate-trend-chart.tsx` |
| `src/app/(dashboard)/quality/severity-chart.tsx` |
| `src/app/(dashboard)/quality/check-viewer.tsx` |
| `src/app/(dashboard)/bcbs239/dashboard.tsx` |
| `src/app/(dashboard)/bcbs239/compliance-trend-chart.tsx` |
| `src/app/(dashboard)/bcbs239/principle-score-card.tsx` |
