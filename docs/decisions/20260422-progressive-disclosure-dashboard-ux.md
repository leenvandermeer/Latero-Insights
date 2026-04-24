# LADR-016 — Progressive Disclosure as Dashboard UX Baseline

Date: 2026-04-22
Status: ACCEPTED
Owner: Layer2 Meta Insights product
Related: [LADR-010](20260419-dashboard-ux-cta-and-placement.md), [LADR-015](20260420-lineage-entity-model-redesign.md)

---

## Context

Layer2 Meta Insights serves multiple user intents:

- operational monitoring of pipelines, quality checks, and BCBS239 controls;
- analytical investigation of datasets, lineage, and OpenLineage events;
- configurable dashboards and custom widgets for team-specific workflows.

The product has enough metadata to overwhelm users if every table, attribute,
run event, and raw payload is shown on first load. During the lineage dashboard
redesign, this became visible in the graph and chain experiences: users needed
the graph to stay readable, but also needed access to file-level evidence,
column mappings, and run/detail metadata when investigating a node.

UX Studio's dashboard guidance describes useful dashboards as easy to understand,
glanceable, and insightful. In particular, it recommends hierarchical layouts,
progressive disclosure, search/filtering, and drill-down interactions so that
advanced data remains accessible without cluttering the initial view:
https://www.uxstudioteam.com/ux-blog/dashboard-design

---

## Decision

All Meta Insights dashboard and specialist views must follow a progressive
disclosure hierarchy:

1. **Overview first.** The initial viewport should show the minimum useful
   summary: KPI cards, health/status distribution, top risks, recent activity,
   or the primary navigational graph.
2. **Context on interaction.** Clicking a card, node, row, or event may reveal
   a drawer, expansion, popover, or focused panel with contextual metadata.
3. **Dedicated detail views for large data.** Large tables, full attribute
   mappings, raw JSON, or event evidence must live in a dedicated table/detail
   tab or drawer, with a clear link from the overview context.
4. **Search and filters near dense data.** Any view that can show many rows,
   entities, events, or attributes must provide search/filter controls close to
   that data.
5. **Status semantics are consistent.** Shared status values such as `SUCCESS`,
   `WARNING`, `PARTIAL`, `IN_PROGRESS`, `FAILED`, and `UNKNOWN` must map to the
   same label/color meaning across overview, graph, chains, tables, and details.
6. **Technical identifiers are secondary.** Hashes, FQNs, raw refs, and run IDs
   may be available for traceability, but human-readable names should be the
   primary label where one can be derived.

---

## Product Audit Against This Decision

| Area | Current fit | Required/implemented improvement |
| --- | --- | --- |
| System dashboard canvas (`/pipelines`, `/quality`, `/bcbs239`) | Fits. KPI/chart widgets create an overview, table widgets provide denser supporting evidence, and dashboard editing is separated into edit mode. | Keep table widgets below KPI/chart summaries in default layouts. Future row-level drawers should use this ADR as the interaction model. |
| Custom dashboard builder | Fits. Wizard steps progressively reveal data source, measure, grouping, preview, and save metadata. | No immediate change required. |
| Dataset Health (`/datasets`) | Fits. Cards summarize per dataset with only health, latest run, DQ, and lineage depth. | Future improvement: make dataset cards clickable into a detail drawer with run, DQ, and lineage evidence rather than adding more fields to each card. |
| Lineage Overview (`/lineage`, Overview tab) | Fits after redesign. Overview shows health, risk, layer coverage, chain readiness, and connected entities without raw evidence tables. | `IN_PROGRESS` is now counted explicitly instead of being collapsed into unknown status. |
| Lineage Graph | Fits after redesign. The graph stays navigational; node details open in a side panel. File-level CSV/JSON/Parquet refs feeding bronze are shown as separate graph nodes without exposing all column mappings in-node. | Removed node-level E2E label clutter; file nodes can now open the detail panel; large attribute sets link to Columns. |
| Lineage Chains | Fits after redesign. Chain cards summarize status and layers; expanding reveals entity-level details. | Added `IN_PROGRESS`; removed hidden `+ more` truncation in upstream/downstream details; primary labels are readable names rather than technical hashes. |
| Lineage Columns | Fits. Dedicated dense table for attribute-level mappings with search and source filtering. | Graph detail actions can open Columns with a targeted search term. |
| OpenLineage Viewer | Fits. Run cards summarize each event; expanded cards show hop detail; raw JSON is isolated in a drawer. | Future improvement: cap expanded hop tables with local search/pagination for very large events. |
| Settings | Fits. Connection/cache controls are task-focused and do not mix operational metadata tables into the settings view. | No immediate change required. |
| About | Fits. Marketing/product context remains separate from operational dashboards. | No immediate change required. |

---

## Consequences

- Graph nodes should not accumulate every status, attribute, and raw reference as
  inline badges. Nodes remain scannable; the detail panel carries investigation.
- `+N more` is acceptable only when accompanied by a clear route to the complete
  data. For lineage attributes, the route is the Columns tab. For raw events, the
  route is the OpenLineage JSON drawer.
- Any new widget or specialist page must define its disclosure levels before
  implementation:
  - Level 1: overview/KPI/chart/card
  - Level 2: expansion/drawer/inline context
  - Level 3: dedicated table/raw/detail page
- UX reviews should test whether a user can understand the initial state within
  a few seconds and still reach supporting evidence without guessing.

---

## Implementation Notes

Changes made as part of accepting this ADR:

- `src/app/(dashboard)/lineage/overview-view.tsx`
  - explicit `IN_PROGRESS` handling in status mix and risk logic.
- `src/app/(dashboard)/lineage/graph-view.tsx`
  - file refs such as CSV/JSON/Parquet feeding bronze become graph nodes;
  - virtual file nodes can open the same detail panel as entity nodes;
  - graph-to-Columns drilldown accepts a targeted search query.
- `src/app/(dashboard)/lineage/entity-node.tsx`
  - removed node-level E2E badge to keep the graph readable.
- `src/app/(dashboard)/lineage/entity-detail-panel.tsx`
  - shows a bounded attribute preview and links large mappings to Columns.
- `src/app/(dashboard)/lineage/chains-view.tsx`
  - readable chain labels, `IN_PROGRESS` status, and full upstream/downstream
    lists in expanded chain details.
- `src/app/(dashboard)/lineage/columns-view.tsx`
  - accepts an initial search term from Graph detail drilldown.
- `src/app/(dashboard)/datasets/dashboard.tsx`
  - dataset cards now open an evidence drawer with recent runs, quality checks,
    and lineage hops.
- `src/app/(dashboard)/openlineage/run-event-card.tsx`
  - expanded run events now provide local hop search and show a bounded preview
    before revealing all hops.
- `src/app/(dashboard)/dashboard/widgets/pipeline-runs-table-widget.tsx`
  - run rows now open a row-detail drawer.
- `src/app/(dashboard)/dashboard/widgets/dq-checks-table-widget.tsx`
  - DQ check rows now open a row-detail drawer.

---

## Follow-up Backlog

1. Add a small UX checklist to pull requests that introduce new dashboard
   widgets or specialist views.
