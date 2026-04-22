# Layer2 Meta Insights — Product Requirements

Version: 0.8
Status: NORMATIVE
Owner: Latero product
Date: 2026-04-19
ADR: [LADR-003](../decisions/20260417-insights-product.md)

---

## Scope

Layer2 Meta Insights is a standalone responsive web application that provides
interactive visualization of pipeline metadata, data quality, and data lineage
stored in the Latero MDCF meta tables. It reads from the same three meta
tables that the Latero runtime writes to:

- `pipeline_runs`
- `data_quality_checks`
- `data_lineage`

These tables are stored in Databricks Unity Catalog (Delta). Snowflake support
MAY be added in a future release.

Layer2 Meta Insights is a Latero product — it ships alongside the framework and
adapters. It does not depend on any demo-specific configuration or code.

Key words: The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY"
in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

---

## 1  Architecture

### LINS-001 — Standalone Deployment

Layer2 Meta Insights MUST be a standalone web application deployable independently
from the Latero MDCF runtime. It MUST NOT require the Latero Python package
or a running pipeline to function.

**Acceptance criteria:**

- The application can be built and started without the Latero Python package
  installed
- The application can be deployed to any static/Node.js hosting environment
- No runtime coupling to the Latero MDCF Python process

**Affected files:** `package.json`, `insights/Dockerfile` (when created)

---

### LINS-002 — Data Adapter Interface

Layer2 Meta Insights MUST connect to Latero meta tables via a data adapter
interface. The application MUST NOT embed direct SQL strings in UI components
or pages. All data access MUST be routed through a typed adapter abstraction.

**Acceptance criteria:**

- A data adapter interface is defined in `src/lib/`
- UI components call adapter methods, not raw SQL
- Swapping the adapter implementation does not require UI changes

**Affected files:** `src/lib/`

---

### LINS-003 — Multi-Source Adapter Support

The data adapter interface MUST support Databricks SQL Warehouse as the
primary data source. The adapter interface MUST be designed so that additional
data sources (e.g. Snowflake) can be added without changing the adapter
contract.

**Acceptance criteria:**

- A Databricks adapter implementation exists
- Configuration determines which adapter is active at runtime
- The adapter interface is generic enough to support future data sources

**Affected files:** `src/lib/`

---

### LINS-004 — No Workspace Access Required

Layer2 Meta Insights MUST NOT require Databricks workspace access for end users.
All data platform API calls MUST be proxied through server-side API routes.

**Acceptance criteria:**

- Browser network traffic shows no direct calls to Databricks URLs
- End users authenticate to the Insights application, not to the data platform
- No data platform tokens or credentials are exposed to the browser

**Affected files:** `src/app/api/`

---

### LINS-005 — Standard Meta Tables and Lineage Snapshots

Core monitoring queries MUST read from the three standard meta tables
(`pipeline_runs`, `data_quality_checks`, `data_lineage`).
Lineage Explorer MAY additionally read from the snapshot lineage tables
(`lineage_entities_current`, `lineage_attributes_current`) as defined in LADR-015.
Queries MUST use only columns defined in the applicable Latero contract.

**Acceptance criteria:**

- Core monitoring queries reference only `pipeline_runs`, `data_quality_checks`, and `data_lineage`
- Lineage Explorer queries may reference `lineage_entities_current` and `lineage_attributes_current`
- No DDL or DML (INSERT, UPDATE, DELETE) statements are issued
- Column references match the meta table contract

**Affected files:** `src/lib/`

---

### Integration Standards

| ID | Requirement | Priority |
|----|-------------|----------|
| LINS-090 | All frontend-to-backend communication MUST go through a typed API client (`@/lib/api`). Direct `fetch()` calls to API routes from components are not allowed. | MUST |
| LINS-091 | The API client MUST be framework-agnostic (plain `fetch`). React-specific bindings are separate hooks. | MUST |
| LINS-092 | All API responses MUST use a standardized envelope: `{ data: T, source: "databricks" \| "cache" \| "fallback", cachedAt?: string }` for data endpoints. | MUST |
| LINS-093 | Server-state management MUST use TanStack Query (React Query v5) with typed query hooks per domain entity. | MUST |
| LINS-094 | Query hooks MUST set `queryKey` arrays that include the endpoint name and all parameters, enabling automatic cache invalidation. | MUST |
| LINS-095 | The `QueryClientProvider` MUST be configured at the application root with consistent defaults for `staleTime`, `gcTime`, and `retry`. | MUST |
| LINS-096 | API errors MUST be typed (`ApiClientError`) with HTTP status and parsed error body. Components MUST NOT handle raw fetch errors. | MUST |
| LINS-097 | All public module surfaces MUST use barrel exports (`index.ts`) for clean import paths. | SHOULD |
| LINS-098 | Client components that fetch data MUST use the provided query hooks. Server components MAY use the API client directly. | MUST |

**Acceptance criteria:**

- A typed API client exists at `src/lib/api/`
- No component file contains direct `fetch()` calls to `/api/` routes
- All API responses conform to the `{ data, source, cachedAt? }` envelope
- TanStack Query (`@tanstack/react-query` v5) is declared in `package.json`
- Query hooks exist per domain entity with typed `queryKey` arrays
- `QueryClientProvider` is configured in the root layout with `staleTime`,
  `gcTime`, and `retry` defaults
- `ApiClientError` type is defined and used for all API error handling
- Public module directories export through `index.ts` barrel files
- Client components use query hooks; no client component calls the API client
  directly

**Affected files:** `src/lib/api/`, `src/hooks/`,
  `src/app/layout.tsx`, `src/types/`, `package.json`

---

## 2  Responsive Design & UX

### LINS-010 — Viewport Range

The application MUST render correctly on viewports from 320px (mobile) through
2560px+ (4K/UHD desktop). No horizontal scrolling MUST occur on any supported
viewport width.

The following breakpoints MUST be used:

| Breakpoint | Width  | Description        |
|------------|--------|--------------------|
| `sm`       | 640px  | Mobile landscape   |
| `md`       | 768px  | Tablet portrait    |
| `lg`       | 1024px | Tablet landscape   |
| `xl`       | 1280px | Desktop            |
| `2xl`      | 1440px | Large desktop      |
| `3xl`      | 1920px | Full HD            |
| `4k`       | 2560px | 4K / UHD           |

**Acceptance criteria:**

- Application renders without horizontal overflow at 320px, 640px, 768px,
  1024px, 1280px, 1440px, 1920px, and 2560px widths
- Breakpoints are defined in `tokens.css` and in the `useBreakpoint` hook
- Visual regression tests cover all listed breakpoints

**Affected files:** `src/styles/tokens.css`,
  `src/hooks/use-breakpoint.ts`, `src/app/`,
  `src/components/`

---

### LINS-011 — Adaptive Navigation

*Updated by [LADR-013](../decisions/20260420-adaptive-nav-breakpoint.md) — threshold raised from 1024px to 1280px.*

Navigation MUST adapt between desktop sidebar, compact sidebar, and
mobile bottom navigation with top bar.

| Viewport | Navigation style | User control |
|----------|-----------------|-------------|
| ≥ 1280px | Sidebar expanded (256px), icon + label | Collapsible; preference persisted |
| 1024px–1279px | Sidebar collapsed (64px, icons only) | User MAY expand manually |
| 768px–1023px | Sidebar always collapsed (64px, icons only) | No expand; viewport-forced |
| < 768px | Bottom navigation bar (5 items, 44px touch targets) + top bar (56px) | N/A |

**Desktop sidebar footer** MUST show user avatar (32px circle) and dark mode
toggle. **Mobile hamburger menu** MUST open a full-screen overlay with all
navigation items, user info, and dark mode toggle.

**Acceptance criteria:**

- Navigation switches style at the specified breakpoints
- All navigation items are reachable at every breakpoint
- Active state uses `--brand-subtle` background with 3px left accent bar
  (`--brand` color) on sidebar items
- Mobile bottom nav includes safe area padding via
  `env(safe-area-inset-bottom)`
- Sidebar collapse/expand toggle is present at bottom of desktop sidebar

**Affected files:** `src/components/`, `src/styles/responsive.css`

---

### LINS-012 — Single-Column Reflow

All dashboard widgets MUST reflow to single-column layout on viewports < 768px.
Multi-column grid layouts MUST collapse to a stacked vertical layout.

**Acceptance criteria:**

- Dashboard views show single-column layout at 320px and 375px widths
- Widget order in single-column layout follows logical reading order
- No content is hidden or truncated at narrow viewports

**Affected files:** `src/components/`, `src/app/`

---

### LINS-013 — Touch Gestures

Interactive graphs MUST support touch gestures (pinch-zoom, pan) on mobile
and tablet devices.

**Acceptance criteria:**

- Lineage DAG supports pinch-to-zoom on touch devices
- Lineage DAG supports single-finger pan on touch devices
- Touch gestures do not conflict with browser scroll behavior

**Affected files:** `src/components/`

---

### LINS-014 — Accessibility

The application MUST pass WCAG 2.1 AA accessibility standards.

**Acceptance criteria:**

- All pages pass automated WCAG 2.1 AA audit (e.g. axe-core)
- Color contrast ratios meet AA minimums (4.5:1 for normal text, 3:1 for
  large text)
- All interactive elements are keyboard-navigable
- Screen reader landmarks and ARIA labels are present on all views

**Affected files:** `src/app/`, `src/components/`

---

### LINS-015 — Progressive Web App

The application MUST be installable as a PWA (Progressive Web App) on Android
and iOS.

**Acceptance criteria:**

- A valid `manifest.json` is served with `name` set to "Layer2 Meta Insights",
  `short_name` set to "L2 Insights", required icons, `start_url`, and
  `display: standalone`
- A service worker is registered for offline shell caching
- The application passes Lighthouse PWA audit
- Install prompt is available on Android Chrome and iOS Safari

**Affected files:** `public/manifest.json`, `src/app/`

---

### LINS-016 — Touch Targets & Typography

Typography, spacing, and touch targets MUST follow platform conventions.
All interactive touch targets MUST have a minimum size of 44×44px (defined as
`--touch-target-min` in design tokens).

**Acceptance criteria:**

- No interactive element (button, link, input) is smaller than 44×44px on
  touch devices
- Typography uses a consistent scale defined in the design system
- Spacing between interactive elements prevents accidental taps

**Affected files:** `src/components/`, `src/styles/tokens.css`

---

## 3  Dashboard Views

### LINS-020 — Pipelines System Dashboard

The Pipelines system dashboard (`system:pipelines`) MUST be available as a pre-configured dashboard in the dashboard builder at route `/pipelines`.

**Supersedes:** the former hardcoded Pipeline Health View component.

Default widget configuration:

| Widget | Position |
| --- | --- |
| Total Runs counter | top-left |
| Failed Runs counter | top, col 4 |
| Event Log | top-right (tall) |
| Run Status Trend chart | mid-left |
| Avg Duration by Step chart | bottom-left |
| Recent Pipeline Runs table | bottom-right |

**Acceptance criteria:**

- Route `/pipelines` renders `DashboardCanvas dashboardId="system:pipelines"`
- All three run statuses (SUCCESS, WARNING, FAILED) are represented via widgets
- The layout can be customised by the user and reset to the default via "Reset to default"
- No hardcoded dashboard component exists for `/pipelines` — only `page.tsx` and the widget definitions

**ADR:** [LADR-011](../decisions/20260419-remove-static-dashboards.md)

**Affected files:** `src/app/(dashboard)/pipelines/page.tsx`,
  `src/lib/dashboard-store.ts`

---

### LINS-021 — Data Quality System Dashboard

The Data Quality system dashboard (`system:quality`) MUST be available as a pre-configured dashboard in the dashboard builder at route `/quality`.

**Supersedes:** the former hardcoded DQ Control Center component.

Default widget configuration:

| Widget | Position |
| --- | --- |
| DQ Pass Rate counter | top-left |
| Failed Runs counter | top, col 4 |
| DQ Pass Rate Trend chart | mid-left |
| Results by Category chart | mid-right |
| DQ Check Results table | bottom, full width |

Severity values displayed MUST be `high`, `medium`, `low` only. Check statuses displayed MUST be `SUCCESS`, `WARNING`, `FAILED` only.

**Acceptance criteria:**

- Route `/quality` renders `DashboardCanvas dashboardId="system:quality"`
- The layout can be customised by the user and reset to the default
- No hardcoded dashboard component exists for `/quality`

**ADR:** [LADR-011](../decisions/20260419-remove-static-dashboards.md)

**Affected files:** `src/app/(dashboard)/quality/page.tsx`,
  `src/lib/dashboard-store.ts`

---

### LINS-022 — Lineage Explorer DAG

Lineage Explorer MUST render entity-to-entity lineage as an interactive
directed acyclic graph (DAG).

| Aspect | Specification |
|--------|---------------|
| Nodes | Represent entities from `lineage_entities_current` |
| Edges | Derived from `upstream_entity_fqns` and `downstream_entity_fqns` |
| Layout | Layer-based left-to-right flow (Landing → Raw → Bronze → Silver → Gold) |
| Node interaction | Click to open detail panel with status, connectivity, and attribute preview |
| Edge interaction | Optional; column-level exploration is available via Columns tab |

**Acceptance criteria:**

- Graph renders entities from `lineage_entities_current` as nodes
- Edges are resolved from `upstream_entity_fqns` and `downstream_entity_fqns`
- Graph layout follows ordered layer lanes left-to-right
- Node click opens a detail panel
- Columns drill-in is reachable from lineage navigation actions (links to LINS-023)
- Graph re-renders on filter change

**Affected files:** `src/app/lineage/`, `src/components/`

---

### LINS-023 — Column-Level Lineage Drill-In

Lineage Explorer MUST support drill-in from table-level to column-level
lineage.

| Component | Description |
|-----------|-------------|
| Column mapping view | Source column → target column with provenance |
| Coverage metric | Percentage of target columns with a mapped source |

**Acceptance criteria:**

- Column mappings are primarily derived from `lineage_attributes_current`
- `data_lineage` attribute-level rows MAY be used as fallback evidence when current mappings are missing
- Coverage metric is calculated per target entity
- The view is accessible from Lineage Explorer navigation and detail actions (LINS-022)

**Affected files:** `src/app/lineage/`, `src/components/`

---

### LINS-024 — OpenLineage Viewer

OpenLineage Viewer MUST display RunEvents in OpenLineage specification terms.

| Component | Description |
|-----------|-------------|
| RunEvent viewer | Display Jobs, Runs, InputDatasets, OutputDatasets, Facets |
| Export | Copy or download RunEvent as JSON |
| Format | OpenLineage specification RunEvent schema |

The conversion MUST match the output of `latero.lineage.openlineage`.

**Acceptance criteria:**

- RunEvents are rendered with Job, Run, Input Datasets, Output Datasets, and
  Facets sections
- JSON export produces valid OpenLineage RunEvent JSON
- Export supports both clipboard copy and file download

**Affected files:** `src/app/openlineage/`

---

### LINS-025 — BCBS239 System Dashboard

The BCBS239 system dashboard (`system:bcbs239`) MUST be available as a pre-configured dashboard in the dashboard builder at route `/bcbs239`.

**Supersedes:** the former hardcoded BCBS239 Scorecard component.

Default widget configuration includes: BCBS239 Score counter, DQ Pass Rate counter, Failed Runs counter, DQ Pass Rate Trend chart, Results by Category chart, DQ Check Results table.

**Acceptance criteria:**

- Route `/bcbs239` renders `DashboardCanvas dashboardId="system:bcbs239"`
- The BCBS239 Score widget derives its value from `pipeline_runs` and `data_quality_checks`
- The layout can be customised by the user and reset to the default
- No hardcoded dashboard component exists for `/bcbs239`

**ADR:** [LADR-011](../decisions/20260419-remove-static-dashboards.md)

**Affected files:** `src/app/(dashboard)/bcbs239/page.tsx`,
  `src/lib/dashboard-store.ts`

---

### LINS-026 — Date Range Filtering

All views MUST support date range filtering with the following presets:
last 7 days, last 30 days, last 90 days, and custom range.

**Acceptance criteria:**

- A date range selector is present on every dashboard view
- Preset options: 7d, 30d, 90d, custom
- Custom range allows start and end date selection
- All widgets on the view respond to the selected date range
- Default date range is last 30 days

**Affected files:** `src/components/`

---

### LINS-027 — Click-Through to Detail

Dashboard widgets MUST support click-through to detail views. Clicking a
summary metric, chart segment, or table row MUST navigate to a filtered
detail view.

**Acceptance criteria:**

- Summary metrics are clickable and link to filtered detail views
- Chart segments (bars, pie slices) are clickable
- Table rows link to individual record detail
- Navigation preserves the active filter context

**Affected files:** `src/app/`, `src/components/`

---

## 4  Data & Security

### LINS-030 — Authentication

Authentication MUST be configurable. The application MUST support OAuth2 / SSO
integration. The specific identity provider MUST be configurable via
environment variables.

**Acceptance criteria:**

- OAuth2 / SSO authentication flow is implemented
- Identity provider configuration is via environment variables
- Unauthenticated requests to data endpoints return HTTP 401
- Session management uses secure, httpOnly cookies

**Affected files:** `src/app/api/auth/`, `next.config.ts`

---

### LINS-031 — No Raw SQL Exposure

The API layer MUST NOT expose raw SQL or allow arbitrary query injection.
API endpoints MUST accept structured filter parameters and construct queries
server-side.

**Acceptance criteria:**

- No API endpoint accepts a raw SQL string as input
- API endpoints accept typed, validated filter parameters only
- SQL construction happens exclusively in server-side adapter code
- Input validation rejects unexpected parameter types or values

**Affected files:** `src/app/api/`

---

### LINS-032 — Parameterized Queries

All data adapter queries MUST be parameterized. String interpolation of user
input into SQL strings MUST NOT be used.

**Acceptance criteria:**

- All SQL queries use parameter binding (not string concatenation)
- Static analysis or code review confirms no SQL string interpolation with
  user-supplied values
- The catalog and schema prefix MUST be injected via configuration, not
  user input

**Affected files:** `src/lib/`

---

### LINS-033 — Security Headers

CORS and CSP headers MUST be properly configured.

**Acceptance criteria:**

- `Content-Security-Policy` header restricts script and style sources
- `X-Content-Type-Options: nosniff` is set
- `X-Frame-Options: DENY` or CSP `frame-ancestors 'none'` is set
- CORS `Access-Control-Allow-Origin` is restricted to configured origins
- Headers are verified by automated security scan

**Affected files:** `next.config.ts`

---

### LINS-034 — Environment-Based Configuration

Environment configuration (connection strings, credentials, identity provider
settings) MUST use environment variables. Values MUST NOT be hardcoded in
source code.

**Acceptance criteria:**

- All secrets and connection parameters are read from environment variables
- A `.env.example` file documents all required variables
- No credentials appear in committed source code
- The application fails fast with a clear error if required variables are
  missing

**Affected files:** `.env.example`, `src/lib/`

---

## 5  Technology Stack

### LINS-040 — Frontend Framework

Frontend framework MUST be Next.js 15 (App Router) with React 19.

**Acceptance criteria:**

- `package.json` declares `next` 15.x and `react` 19.x as dependencies
- App Router (`app/` directory) is used for all pages

**Affected files:** `package.json`

---

### LINS-041 — Graph Visualization

Graph visualization MUST use React Flow for lineage DAG rendering.

**Acceptance criteria:**

- `package.json` declares `@xyflow/react` as a dependency
- All DAG/graph visualizations use React Flow
- No alternative graph library is introduced without an ADR

**Affected files:** `package.json`, `src/components/`

---

### LINS-042 — UI Component Library

UI component library MUST be shadcn/ui with Tailwind CSS v4.

**Acceptance criteria:**

- Tailwind CSS v4 is configured
- shadcn/ui components are used for standard UI elements (buttons, cards,
  tables, dialogs)
- No alternative component library is introduced without an ADR

**Affected files:** `package.json`, `tailwind.config.ts`

---

### LINS-043 — Charts

Charts MUST use Recharts for time series and bar charts.

**Acceptance criteria:**

- `package.json` declares `recharts` as a dependency
- All chart visualizations (line, bar, pie, area) use Recharts
- No alternative chart library is introduced without an ADR

**Affected files:** `package.json`, `src/components/`

---

### LINS-044 — API Layer

API layer MUST use Next.js API routes with typed endpoints. Each endpoint MUST
have TypeScript request and response types defined.

**Acceptance criteria:**

- API routes are defined in `src/app/api/`
- Request and response types are defined in `src/types/`
- Runtime input validation is applied on all API routes

**Affected files:** `src/app/api/`, `src/types/`

---

### LINS-045 — Databricks Connectivity

Databricks connectivity MUST use the Databricks SQL Statement Execution REST
API. No JDBC/ODBC drivers MUST be required.

**Acceptance criteria:**

- Databricks adapter uses the SQL Statement Execution API (REST)
- No native database drivers are bundled
- Connection uses workspace host, SQL warehouse ID, and token/OAuth from
  environment variables

**Affected files:** `src/lib/`

---

### LINS-046 — Snowflake Connectivity (future)

Snowflake connectivity MAY be added in a future release. When implemented, it
MUST use the Snowflake SQL REST API connector. No JDBC/ODBC drivers MUST be
required.

> **Note:** Snowflake support is out of scope for the initial release. This
> requirement is retained as a placeholder to preserve the adapter interface
> design intent (LINS-003).

**Acceptance criteria:**

- When implemented: Snowflake adapter uses the Snowflake SQL REST API
- When implemented: no native database drivers are bundled
- When implemented: connection uses account identifier, warehouse, and
  credentials from environment variables

**Affected files:** `src/lib/`

---

## 6  Dashboard Builder & Filtering

### LINS-060 — Cascading Filter Model

Dashboard-level filters (date range, environment, dataset) MUST cascade to all
widgets on the dashboard. Individual widgets MUST be able to override cascaded
filters with widget-specific filter values.

**Acceptance criteria:**

- Changing a dashboard-level filter updates all widgets that inherit it
- A widget with a widget-level override is not affected by the cascaded value
  for that filter dimension
- The UI clearly indicates when a widget overrides a dashboard-level filter

**Affected files:** `src/components/`, `src/app/`

---

### LINS-061 — Dashboard Builder

Users MUST be able to create custom dashboards with drag-and-drop widget
placement on a responsive grid.

**Acceptance criteria:**

- A "New Dashboard" action creates an empty dashboard canvas
- The dashboard header shows a persistent **"+ Add Widget"** button (accent colour) that opens the widget library panel and enters edit mode in a single click
- The widget library panel is rendered as a left-side panel inside the canvas area when edit mode is active; it is not part of the sidebar navigation
- Widgets can be added to the canvas by clicking a card in the widget library panel
- Widgets can be added to the canvas by dragging a card from the widget library and dropping it on the grid (drag-to-canvas)
- Dragging a widget card from the library automatically enables edit mode on the canvas
- Click-to-add and drag-to-add coexist; neither interaction replaces the other
- New widgets are placed at the first available grid position (left-to-right, top-to-bottom) rather than stacked in the first column
- Widgets can be repositioned by dragging on the canvas in edit mode
- Widgets can be resized using handles in edit mode
- Dashboard list view shows all saved dashboards in the sidebar under "My Dashboards"

**ADR:** [LADR-008](../decisions/20260418-dashboard-builder-implementation.md), [LADR-009](../decisions/20260419-widget-library-navigation-and-drag.md), [LADR-010](../decisions/20260419-dashboard-ux-cta-and-placement.md)

**Affected files:** `src/app/(dashboard)/dashboard/`, `src/components/`

---

### LINS-105 — Dashboard Switcher

The user MUST be able to navigate between dashboards from within the canvas
without returning to the sidebar.

**Acceptance criteria:**

- The dashboard title in the canvas header is a clickable dropdown trigger (title + chevron)
- The dropdown lists all system dashboards and all user dashboards, each in their own labelled group
- The active dashboard is marked with a check indicator
- Selecting a dashboard from the dropdown navigates to that dashboard
- A "New Dashboard" action is available at the bottom of the dropdown
- The dropdown closes when clicking outside it or after a selection

**ADR:** [LADR-010](../decisions/20260419-dashboard-ux-cta-and-placement.md)

**Affected files:** `src/app/(dashboard)/dashboard/dashboard.tsx`

---

### LINS-106 — Shared Widget Library

The widget palette MUST support a third tier of widgets — **shared (org-level)** — between system widgets (code-defined, shipped with the product) and personal widgets (custom-built, stored in the user's browser).

| Tier | Defined by | Stored | Visible to |
| --- | --- | --- | --- |
| `system` | Product code (`registry.ts`) | Source code | All users, always |
| `shared` | Author via Publish action | Server-side API | All users once published |
| `personal` | User via Custom Widget wizard | Browser localStorage | Only the creating user |

Shared widgets MUST be displayed in a dedicated **"Shared"** section in the widget palette, visually distinct from system widgets and personal widgets.

**Acceptance criteria:**

- The widget palette renders three sections when shared widgets exist: System, Shared, Personal
- Shared widgets appear in all dashboards for all users in the deployment
- Shared widgets are loaded via a server-side API route at startup alongside system widget definitions
- A shared widget added to a dashboard renders identically to a system or personal widget of the same query/type
- Shared widgets survive browser cache clears and new browser sessions
- The palette "Shared" section is not shown when no shared widgets have been published

**ADR:** [LADR-012](../decisions/20260419-shared-widget-library.md)

**Affected files:** `src/app/(dashboard)/dashboard/registry.ts`,
  `src/app/api/widgets/shared/route.ts`,
  `src/app/(dashboard)/dashboard/palette.tsx`,
  `src/hooks/use-shared-widgets.ts`

---

### LINS-107 — Widget Publishing Workflow

A user MUST be able to publish a personal (custom) widget to the shared library and withdraw it again, without losing the widget from any dashboard that already uses it.

**Publish flow:**

1. User opens the widget's context menu in the palette (⋯) or on the canvas
2. User selects **"Publish to library"**
3. A confirmation dialog summarises what will happen: the widget becomes available to all users
4. On confirm, the widget definition is written to the shared widget store via API
5. The palette immediately reflects the widget under the "Shared" section across all open sessions (on next load)

**Withdraw (unpublish) flow:**

1. Author selects **"Remove from library"** on a shared widget
2. A confirmation dialog warns: dashboards already using this widget keep a detached copy of its definition; they are not broken
3. On confirm, the widget is removed from the shared store
4. Dashboards that had the widget continue to function using the detached copy embedded in their layout

**Acceptance criteria:**

- The widget context menu shows "Publish to library" for personal widgets only
- The widget context menu shows "Remove from library" for shared widgets (for the author or any user in a single-tenant deployment)
- Publish requires explicit confirmation before writing to the server
- Withdraw requires explicit confirmation and clearly states the detach semantics
- After withdraw, existing dashboards using the widget continue to render correctly
- The shared library badge in the palette is not shown on personal widgets after publish (they graduate to shared tier; the personal copy is superseded)
- A widget cannot be published if an identically-named shared widget already exists (name conflict guard)

**ADR:** [LADR-012](../decisions/20260419-shared-widget-library.md)

**Affected files:** `src/app/(dashboard)/dashboard/palette.tsx`,
  `src/app/(dashboard)/dashboard/dashboard.tsx`,
  `src/app/api/widgets/shared/route.ts`,
  `src/components/dashboard/publish-widget-dialog.tsx`

---

### LINS-062 — Widget Types

The Dashboard Builder MUST support the following widget types:

| Widget type  | Description                                    |
|-------------|------------------------------------------------|
| Counter     | Single numeric value with label and trend      |
| Bar Chart   | Vertical or horizontal, grouped or stacked     |
| Line Chart  | Time series, multi-line, optional threshold    |
| Area Chart  | Filled, stacked or single                      |
| Donut Chart | Center label with total or percentage          |
| Table       | Sortable, filterable, paginated                |
| Metric Card | Value with sparkline and change percentage     |
| Heatmap     | Grid matrix with color scale                   |
| Status List | List of items with status indicators           |

**Acceptance criteria:**

- Each widget type listed above is available in the widget palette
- Each widget type renders correctly at all supported grid sizes
- Widget type selection is part of the widget configuration flow

**Affected files:** `src/components/`

---

### LINS-063 — Widget Configuration

*Updated by [LADR-018](../decisions/20260422-widget-builder-json-configuration-mode.md) — optional advanced JSON configuration mode added.*
*Updated by [LADR-019](../decisions/20260422-dashboard-in-place-custom-widget-editing.md) — in-place editing from dashboard settings added for custom widgets.*

Each widget MUST be configurable with the following properties:

| Property     | Description                                              |
|-------------|----------------------------------------------------------|
| Title       | User-defined widget title                                |
| Data source | One of `pipeline_runs`, `data_quality_checks`, `data_lineage` |
| Aggregation | `count`, `sum`, `avg`, `min`, `max`, or `distinct_count` |
| Group by    | Column to group results by (e.g. `step`, `dataset_id`)  |
| Filter      | Widget-level filter (field, operator, value)             |
| Date range  | Inherit from dashboard or custom range                   |
| Size        | Grid columns × rows (1×1, 2×1, 3×1, 2×2, 3×2, 6×1, 6×2)|

**Acceptance criteria:**

- A widget configuration panel opens when selecting a widget in edit mode
- All configuration properties listed above are editable
- Changes are reflected in the widget preview immediately or on apply
- Invalid configurations show validation errors
- The widget builder provides an optional advanced JSON editor for full widget definitions (`label`, `description`, `queryConfig`, `visualType`)
- JSON input is validated before apply/save; invalid JSON cannot be persisted
- Users can apply valid JSON back into the guided form controls
- When configuring a placed custom widget from the dashboard canvas, users can edit the underlying custom widget definition in-place via JSON
- The dashboard settings panel shows an impact warning when the same custom widget is referenced by multiple dashboards

**Affected files:** `src/components/`, `src/app/dashboards/`

---

### LINS-064 — Dashboard Persistence

Dashboard definitions MUST be stored as JSON. Dashboards MUST be exportable
and importable.

**Acceptance criteria:**

- Dashboard state (layout, widget configs, filters) is serialized as JSON
- An export action produces a downloadable `.json` file
- An import action accepts a `.json` file and renders the dashboard
- Import validates the JSON schema before applying

**Affected files:** `src/app/dashboards/`, `src/types/`

---

## 7  Home & Notifications

### LINS-065 — Home View

The Home view MUST serve as an overview landing page displaying:

| Component           | Description                                          |
|--------------------|------------------------------------------------------|
| KPI counters       | Total runs, pass count, fail count, DQ pass rate %, lineage hops |
| Pipeline trend     | 7-day stacked area chart (success/warning/failed)    |
| DQ trend           | 7-day line chart with pass rate % and 90% threshold  |
| Recent failures    | Table of recent FAILED runs with step, dataset, status |
| Notification widget| On-screen status alerts (see LINS-066)               |

KPI counters MUST show a trend indicator (↑/↓/→) comparing to the previous
period. On mobile (< 768px), the counter row MUST scroll horizontally.

**Acceptance criteria:**

- Home view displays all five component types listed above
- KPI counters show current value and trend vs. previous period
- Trend charts default to a 7-day window
- Recent failures table links to Pipeline Health detail (LINS-027)
- Mobile counter row scrolls horizontally with scroll-snap

**Affected files:** `src/app/`, `src/components/`

---

### LINS-066 — Notification Widgets

Notification widgets MUST be visual-only, on-screen mini widgets that display
pipeline status alerts derived from `pipeline_runs` and `data_quality_checks`.

**Acceptance criteria:**

- Notifications are auto-generated from latest meta table data
- No external notification system (email, Slack, etc.) is required
- Notifications are dismissible per session
- Maximum 5 items visible; overflow scrolls
- Desktop: positioned fixed top-right of content area
- Mobile: single dismissible banner below top bar, auto-cycling
- Tapping a notification navigates to the relevant view

**Affected files:** `src/components/`

---

## 8  Lineage Enhancements

### LINS-067 — Column-Level Lineage Toggle

Lineage Explorer MUST support toggling between table-level and column-level
views via a `[● table ○ column]` toggle control.

**Acceptance criteria:**

- A toggle control switches between table-level and column-level DAG views
- Table-level view shows entity nodes without column detail
- Column-level view expands nodes to show column lists with type annotations
- Column-to-column edges are rendered in column-level view
- Toggle state is preserved when navigating back to the Lineage Explorer

**Affected files:** `src/app/lineage/`, `src/components/`

---

### LINS-068 — Lineage Entity Nodes

Entity nodes in the Lineage Explorer MUST display:

| Element       | Description                                        |
|--------------|---------------------------------------------------|
| Entity name  | Name of the table or dataset                      |
| Entity type  | Type label (e.g. `delta_table`, `csv`)            |
| Columns list | Expandable list of columns with data types        |
| Step         | Pipeline step that produced or consumed this entity|
| Run metadata | Column count and last-seen timestamp              |

Node states: default (`--surface` bg), hover (`--shadow-hover`), selected
(`--brand-subtle` bg with 2px `--brand` border).

**Acceptance criteria:**

- Entity nodes render all elements listed above
- Column list is collapsed by default, showing "+ N more columns" overflow
- Clicking the expand control shows all columns
- Node visual states match the design tokens specification

**Affected files:** `src/components/`

---

### LINS-069 — Lineage Column Highlighting

Clicking a column in column-level lineage view MUST highlight that column's
full lineage path (upstream and downstream) and dim all unrelated paths.

**Acceptance criteria:**

- Clicking a column highlights all edges and connected columns in the path
- Highlighted path uses `--accent` color (#C8892A)
- Unrelated nodes and edges are dimmed (reduced opacity)
- Clicking the same column again or clicking the canvas clears the highlight
- Column highlight applies `--accent-subtle` background to highlighted column
  rows

**Affected files:** `src/components/`

---

### LINS-070 — OpenLineage JSON Viewer

The OpenLineage Viewer MUST include a collapsible JSON tree viewer for raw
RunEvent inspection.

**Acceptance criteria:**

- Expanded RunEvent detail includes a "Raw JSON" section
- JSON is rendered as a collapsible tree (each key/object/array is expandable)
- A "Copy JSON" button copies the full RunEvent JSON to clipboard
- The tree viewer uses syntax highlighting for keys, strings, numbers, and
  booleans

**Affected files:** `src/app/openlineage/`, `src/components/`

---

## 9  BCBS239 Enhancements

### LINS-071 — BCBS239 Evidence Drilldown

Clicking a BCBS239 principle row MUST open an evidence detail panel showing
source checks and metrics supporting the principle score.

**Acceptance criteria:**

- Each evidence item shows: status icon, description, metric value, source
  table, and detail counts (e.g. "24 pass / 1 warn / 0 fail")
- Evidence detail panel opens as a side drawer (desktop) or bottom sheet
  (mobile)
- Evidence items link to the originating DQ checks or pipeline runs

**Affected files:** `src/app/bcbs239/`, `src/components/`

---

## 10  Theming

### LINS-072 — Dark Mode

The application MUST support light and dark theme modes with a toggle control.

**Acceptance criteria:**

- A theme toggle (☀/🌙) is present in the sidebar footer (desktop) and
  hamburger menu (mobile)
- Default theme is **light**. On first load, `localStorage` key `theme` is set
  to `"light"` if no value is stored
- An inline `<script>` in the root `<html>` element reads `localStorage.theme`
  and sets `data-theme` on `<html>` before first paint, preventing a flash of
  unstyled dark content
- `<html>` MUST carry `suppressHydrationWarning` because `data-theme` is set
  by client script before React hydrates
- Explicitly selected theme persists across sessions via `localStorage`
- Theme is applied exclusively via `data-theme` attribute on `<html>`
- OS preference (`prefers-color-scheme`) MUST NOT override an explicit stored
  theme. The `tokens.css` media query uses `:root:not([data-theme="light"])`
  so it only applies when no explicit theme has been stored
- The Tailwind `@theme` block in `globals.css` MUST define light-mode values
  only. Dark overrides MUST be expressed as `[data-theme="dark"]` CSS selectors,
  never as `@media (prefers-color-scheme: dark) @theme`. See LADR-006

**Affected files:** `src/styles/tokens.css`, `src/app/layout.tsx`,
  `src/components/navigation/sidebar.tsx`, `src/app/globals.css`

---

### LINS-073 — Local Development

Layer2 Meta Insights MUST run locally on macOS via `next dev` without Docker
or cloud dependencies.

**Acceptance criteria:**

- Running `npm install && npm run dev` starts the application on localhost
- No Docker, Kubernetes, or cloud service is required for local development
- A mock data adapter or seed data allows the application to render without
  a live Databricks connection
- README documents the local development setup

**Affected files:** `package.json`, `README.md`,
  `src/lib/`

---

## 11  Design System Requirements

### LINS-080 — Design Token File

Design tokens MUST be defined as CSS custom properties in a single
`tokens.css` file. All components MUST reference tokens rather than hardcoded
values for colors, spacing, typography, shadows, and radii.

**Acceptance criteria:**

- `src/styles/tokens.css` exists and contains all design tokens
- No component CSS or Tailwind config hardcodes values that are defined as
  tokens
- Tokens cover: colors, typography (families, sizes, weights, line heights),
  spacing scale, border radii, shadows, transitions, layout dimensions,
  z-index scale, and breakpoints

**Affected files:** `src/styles/tokens.css`

---

### LINS-081 — Brand Color Palette

The color palette MUST match the Latero website brand identity:

| Role    | Token            | Light value |
|---------|-----------------|-------------|
| Primary | `--color-brand` | `#1B3B6B`   |
| Accent  | `--color-accent`| `#C8892A`   |
| Background | `--color-bg` | `#FDFAF4`   |

Status colors: success `#10B981`, warning `#F59E0B`, error `#EF4444`.

**Acceptance criteria:**

- Light theme brand, accent, and background colors match the values above
- Dark theme provides adjusted values for readability on dark backgrounds
- Status colors are consistent across all views and components

**Affected files:** `src/styles/tokens.css`

---

### LINS-082 — Typography

Typography MUST use Inter (body text) and Fraunces (display headings and KPI
counter values) fonts.

**Acceptance criteria:**

- `--font-body` resolves to Inter with system-ui fallbacks
- `--font-display` resolves to Fraunces with Georgia/serif fallbacks
- Display headings (H1, H2) use Fraunces; section heads and body use Inter
- KPI counter values use Fraunces 700 at 36px (`--text-counter`)
- Font sizes follow the defined typography scale in `tokens.css`

**Affected files:** `src/styles/tokens.css`, `src/app/layout.tsx`

---

### LINS-083 — Touch Target Minimum

All interactive elements (buttons, links, inputs, navigation items) MUST have
a minimum touch target size of 44×44px, defined as `--touch-target-min` in
design tokens.

**Acceptance criteria:**

- `--touch-target-min: 44px` is defined in `tokens.css`
- A `.touch-target` utility class is available in `responsive.css`
- No interactive element renders smaller than 44×44px on touch devices
- Automated tests or linting verify touch target compliance

**Affected files:** `src/styles/tokens.css`,
  `src/styles/responsive.css`

---

### LINS-084 — Brand-Tinted Shadows

Shadows in light mode MUST use brand-tinted `rgba(27, 59, 107, ...)` values.
Dark mode shadows MUST use neutral `rgba(0, 0, 0, ...)` values.

**Acceptance criteria:**

- Light mode shadow tokens (`--shadow-card`, `--shadow-hover`,
  `--shadow-drawer`, `--shadow-dropdown`, `--shadow-elevated`) use
  `rgba(27, 59, 107, ...)` with varying opacity
- Dark mode shadow tokens use `rgba(0, 0, 0, ...)` with adjusted opacity
- Shadow tokens are overridden in the `[data-theme="dark"]` selector

**Affected files:** `src/styles/tokens.css`

---

### LINS-085 — Reduced Motion

All CSS transitions MUST respect the `prefers-reduced-motion` media query.
When the user prefers reduced motion, transition durations MUST be set to 0ms.

**Acceptance criteria:**

- `tokens.css` defines `--transition-fast`, `--transition-base`, and
  `--transition-slow`
- A `@media (prefers-reduced-motion: reduce)` block sets all transition
  tokens to `0ms`
- No component uses hardcoded transition durations that bypass the tokens

**Affected files:** `src/styles/tokens.css`

---

### LINS-086 — Sidebar Design Tokens

The sidebar MUST use a light design (white/cream background) with a dedicated
set of CSS custom properties. The sidebar MUST NOT use a dark navy background
in light mode.

The following tokens MUST be defined in `globals.css` under `@theme` (light)
and `[data-theme="dark"]` (dark):

| Token                         | Light value | Dark value | Purpose                    |
| ----------------------------- | ----------- | ---------- | -------------------------- |
| `--color-sidebar`             | `#FFFFFF`   | `#0A1628`  | Sidebar background         |
| `--color-sidebar-border`      | `#E8E2D8`   | `#1E3050`  | Right border and dividers  |
| `--color-sidebar-foreground`  | `#1A1208`   | `#F0EBE0`  | Primary text               |
| `--color-sidebar-muted`       | `#8A7860`   | `#7A8FA8`  | Secondary/inactive text    |
| `--color-sidebar-active-bg`   | `#DCE9F5`   | `#1A2A40`  | Active nav item background |
| `--color-sidebar-active-text` | `#1B3B6B`   | `#D4A840`  | Active nav item text       |
| `--color-sidebar-hover`       | `#F5EFE4`   | `#142038`  | Nav item hover background  |

**Acceptance criteria:**

- All sidebar CSS uses the token variables above; no hardcoded color values
- In light mode, sidebar background is visibly light (white or warm cream)
- In dark mode, sidebar background is deep navy
- Active nav items use `--color-sidebar-active-bg` and
  `--color-sidebar-active-text`
- Hover state uses `--color-sidebar-hover`

**Affected files:** `src/app/globals.css`,
  `src/components/navigation/sidebar.tsx`

---

### LINS-087 — PageHeader Component

The `PageHeader` component MUST render a visually distinct section header
that matches the Latero website editorial style.

Required elements:

| Element | Specification |
| --- | --- |
| Eyebrow | Optional. Amber (`--color-accent`), 11px, 700 weight, uppercase, 0.13em letter-spacing, prefixed by a 6×6px amber filled circle |
| Title | Fraunces, italic, 300 weight, `clamp(1.5rem, 3vw, 2.25rem)`, `--color-text`, letter-spacing -0.02em |
| Description | Optional. 14px Inter, `--color-text-muted`, max-width 560px |
| Background | Gradient from `--color-surface` to `--color-brand-subtle`; 1px border in `--color-border`; `border-radius` `--radius-xl` |
| Dot-grid texture | `radial-gradient` dot pattern, top-right quadrant only via `mask-image`, pointer-events none, decorative only |
| Actions slot | Optional. Right-aligned on `sm+` breakpoints |

**Acceptance criteria:**

- `eyebrow` prop renders with amber dot prefix when provided
- Title uses Fraunces italic light weight (300)
- Dot-grid texture does not overlap or obscure text content
- Component renders correctly without `eyebrow` or `actions` props
- Background gradient and border are visible in both light and dark mode

**Affected files:** `src/components/ui/page-header.tsx`

---

### LINS-088 — Card Hover Shadow

The `Card` component MUST use `--color-surface` (warm cream) as background and
apply an amber-tinted hover shadow using `--shadow-card-hover`.

| Token | Light value | Dark value |
| --- | --- | --- |
| `--shadow-card` | `0 2px 8px rgba(27,59,107,0.08), 0 8px 24px rgba(27,59,107,0.07)` | `0 2px 8px rgba(0,0,0,0.25), 0 8px 24px rgba(0,0,0,0.20)` |
| `--shadow-card-hover` | `0 8px 24px rgba(200,137,42,0.22), 0 2px 8px rgba(27,59,107,0.08)` | `0 8px 24px rgba(201,138,82,0.22), 0 2px 8px rgba(0,0,0,0.35)` |

**Acceptance criteria:**

- `Card` background uses `var(--color-surface)`, not `var(--color-card)` or white
- Resting shadow is `var(--shadow-card)`
- Hover shadow transitions to `var(--shadow-card-hover)` (amber-tinted)
- Border subtly lightens on hover to `rgba(27,59,107,0.15)` in light mode
- Both tokens are defined in `tokens.css` for light and dark mode

**Affected files:** `src/components/ui/card.tsx`,
  `src/styles/tokens.css`

---

### LINS-089 — Logo Assets

The application MUST display the Latero logo mark in the sidebar. Logo assets
MUST be served as static SVG files from the `public/logo/` directory.

Required files:

| File | Use |
| --- | --- |
| `latero-mark-light.svg` | Dark-on-light mark; used in sidebar when light mode is active |
| `latero-mark-dark.svg` | Light-on-dark mark; used in sidebar when dark mode is active |
| `latero-logo-light.svg` | Full wordmark for light backgrounds |
| `latero-logo-dark.svg` | Full wordmark for dark backgrounds |

**Acceptance criteria:**

- All four files are present in `public/logo/`
- Sidebar displays `latero-mark-light.svg` when `data-theme="light"`
- Sidebar displays `latero-mark-dark.svg` when `data-theme="dark"`
- Logo is rendered as an `<img>` element with explicit `width` and `height`
  attributes
- Logo links to the application home route (`/`)

**Affected files:** `public/logo/`,
  `src/components/navigation/sidebar.tsx`

---

## 12  UX Design Process

### LINS-050 — UX Designer Involvement

A UX designer MUST be involved in all view designs before implementation
begins.

**Acceptance criteria:**

- Each view has a named UX designer assigned before development starts
- UX review sign-off is recorded before implementation of each view

---

### LINS-051 — Wireframe Approval

All views MUST have wireframes approved before development.

**Acceptance criteria:**

- Wireframes exist for every view defined in this document
- Wireframes are reviewed and approved by the UX designer and product owner
- Approved wireframes are stored in the repository or linked design tool

---

### LINS-052 — Design System

The design system MUST define: color palette, typography scale, spacing scale,
component variants, and dark/light mode.

**Acceptance criteria:**

- A design system document or Tailwind theme configuration defines all tokens
- Color palette includes primary, secondary, success, warning, error, and
  neutral scales
- Dark mode and light mode are both defined and switchable
- Typography scale covers headings (h1–h4), body, caption, and code
- Spacing scale is consistent (e.g. 4px base unit)

**Affected files:** `tailwind.config.ts`, `src/styles/tokens.css`

---

### LINS-053 — Mobile-First Design

Mobile-first design approach MUST be followed — mobile layout MUST be designed
first, then scaled up to tablet and desktop.

**Acceptance criteria:**

- Wireframes show mobile layout as the base design
- CSS/Tailwind styles use min-width (mobile-first) breakpoints
- Desktop-specific styles are additive, not overrides of mobile defaults

**Affected files:** `src/components/`, `tailwind.config.ts`

---

### LINS-054 — Cross-Breakpoint Validation

UX designer MUST validate all views across breakpoints: 320px, 640px, 768px,
1024px, 1280px, 1440px, and 1920px.

**Acceptance criteria:**

- Each view is validated at all seven breakpoints before release
- Validation results are documented (screenshot or sign-off)
- Issues found during validation are resolved before release

---

## 13  Runtime Configuration & Cache

### LINS-100 — Runtime Settings Store

Layer2 Meta Insights MUST persist runtime configuration to a local settings
file (`.cache/settings.json`) without requiring an application restart.
Settings MUST take priority over environment variables.

**Acceptance criteria:**

- A `loadSettings()` function reads from `.cache/settings.json` first, then
  falls back to environment variables, then to defaults
- A `saveSettings()` function writes to `.cache/settings.json`
- The settings file persists across restarts
- Token values in API responses MUST be masked (`••••••••<last4>`)
- The settings file MUST NOT be deleted by cache clear operations

**Affected files:** `src/lib/settings.ts`, `src/app/api/settings/`

---

### LINS-101 — Editable Settings UI

The application MUST provide an editable Settings page where operators can
configure the Databricks connection and cache behaviour without editing files
or environment variables.

**Acceptance criteria:**

- Settings page exposes: Databricks host, token (masked), SQL warehouse ID,
  catalog, schema, cache TTL, and cache-only toggle
- A "Save Settings" action persists values to the runtime settings store
- A "Test Connection" action verifies Databricks connectivity and returns
  a status message
- Saving settings invalidates all client-side query cache so pages
  re-fetch with the updated configuration immediately

**Affected files:** `src/app/(dashboard)/settings/`

---

### LINS-102 — Cache-Only Mode

The application MUST support a cache-only operating mode in which no
Databricks connection is required. Cache-only mode MUST be togglable at
runtime via the Settings UI without restarting the application.

**Acceptance criteria:**

- When cache-only is enabled: data endpoints serve from file cache only;
  if no cache entry exists for the requested parameters, a 503 is returned
- When cache-only is disabled: data endpoints call Databricks first and
  write the result to file cache; if Databricks is unavailable, the endpoint
  falls back to cached data and sets `source: "fallback"` in the response
- The `SourceIndicator` component MUST render three distinct states:
  `"databricks"` (green, "Live"), `"cache"` (amber, "Cache"),
  `"fallback"` (red, "Fallback")
- The toggle can be changed and saved without restarting the server

**Affected files:** `src/lib/cache.ts`, `src/app/api/`,
  `src/components/ui/source-indicator.tsx`

---

### LINS-103 — Demo Seed Data

The application MUST provide a mechanism to populate the file cache with
synthetic demo data without a Databricks connection.

**Acceptance criteria:**

- A `POST /api/cache/seed` endpoint generates and writes synthetic records
  for pipelines, quality checks, and lineage hops covering a 30-day window
- The seed endpoint preserves existing Databricks credentials in the settings
  file when enabling cache-only mode
- A "Load Demo Data" button in the Settings UI triggers the seed endpoint
- Seeded data covers all three ESG demo datasets
  (cbsenergie, eponline, rvosde) and all four pipeline steps
  (landing_to_raw, raw_to_bronze, bronze_to_silver, silver_to_gold)
- Cache clear operations MUST NOT delete `settings.json`

**Affected files:** `src/app/api/cache/seed/`,
  `src/app/(dashboard)/settings/`, `src/lib/cache.ts`,
  `insights/scripts/seed-cache.ts`

---

### LINS-104 — Lineage Canvas Enhancements

The Lineage Explorer canvas MUST support dataset and step filters, node
position persistence, and full-screen layout.

**Acceptance criteria:**

- A dataset filter dropdown limits visible nodes and edges to the selected
  dataset; "All datasets" shows all entities
- A step filter dropdown limits visible hops to the selected pipeline step;
  options are fixed labels: "All layers", "Landing → Raw", "Raw → Bronze",
  "Bronze → Silver", "Silver → Gold"
- Node positions dragged by the user MUST be persisted in localStorage under
  the key `insights:lineage:positions` and restored on next load
- The lineage canvas MUST occupy the full viewport height minus the topbar
- Active filters MUST be shown as a badge in the top-right panel with a
  "Filtered" indicator

**Affected files:** `src/app/(dashboard)/lineage/`
