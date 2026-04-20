# LADR-003 — Layer2 Meta Insights: standalone web frontend for metadata visualization

**Datum:** 2026-04-17
**Status:** ACCEPTED

## Context

Latero MDCF stores pipeline metadata in three Delta tables (`pipeline_runs`,
`data_quality_checks`, `data_lineage`). Currently, visualization is handled by
Databricks SQL dashboards defined in `resources/dashboard_*.yml`. These
dashboards are tied to the Databricks workspace and cannot be shared with users
who do not have Databricks access.

There is a need for a standalone, shareable web frontend that visualizes the
same metadata — pipeline health, data quality, and lineage — without requiring
direct Databricks workspace access.

## Decision

Introduce **Layer2 Meta Insights** as a new Latero product: a responsive Next.js
web application that reads from the Latero meta tables via the Databricks SQL
REST API or Snowflake SQL REST API, selectable via a data adapter interface.

Key decisions:

1. **Standalone product.** Insights is a Latero product, not a demo artifact.
   It does not depend on demo config, contracts, or lineage files. (LINS-001)
2. **Data adapter interface.** A typed adapter abstraction supports Databricks
   SQL Warehouse as the primary data source. The interface is designed for
   future extensibility to Snowflake. (LINS-002, LINS-003)
3. **Read-only.** Insights performs no write operations against any data
   platform. All queries target the three standard meta tables only. (LINS-005)
4. **No workspace access required.** All data platform API calls go through
   Next.js API routes. No credentials are exposed to the browser. (LINS-004)
5. **Repository location.** The frontend lives in its own standalone
    repository (`@layer2/meta-insights`).
6. **Responsive & PWA.** The application supports viewports from 320px to
   1920px+ with six defined breakpoints (640, 768, 1024, 1280, 1440, 1920)
   and is installable as a PWA on Android and iOS. (LINS-010–LINS-016)
7. **Query compatibility.** SQL queries use only columns from the meta table
   contract. (LINS-005, LINS-032)
8. **UX design process.** A UX designer must be involved before implementation;
   wireframes and cross-breakpoint validation are required. (LINS-050–LINS-054)
9. **Design system.** Design tokens are defined as CSS custom properties in a
   single `tokens.css` file, matching the Latero website brand identity.
   (LINS-080–LINS-085)
10. **Dashboard Builder.** Users can create custom dashboards with drag-and-drop
    widget placement, configurable widgets, and JSON-based persistence.
    (LINS-060–LINS-064)
11. **Databricks-first scope.** Initial release targets Databricks only.
    Snowflake connectivity is deferred to a future release. (LINS-045, LINS-046)

## Consequences

- Layer2 Meta Insights lives in its own standalone repository, separate from
  the Latero MDCF Python codebase.
- Requirements are tracked in
  [`docs/requirements/insights-product.md`](../requirements/insights-product.md)
  using LINS-xxx requirement IDs.
- Requirements v0.3 adds LINS-060–LINS-073 (dashboard builder, home view,
  notifications, lineage enhancements, BCBS239 drilldown, dark mode, local
  dev) and LINS-080–LINS-085 (design system) based on the completed UX design.
- LINS-046 (Snowflake) is deferred to future scope.
- The meta table contract (`latero/docs/requirements/meta-table-contract.md`)
  becomes a dependency for the Insights query layer.
- Changes to meta table column names or types must consider Insights
  compatibility.
- Both Databricks and Snowflake adapter implementations must be maintained.
