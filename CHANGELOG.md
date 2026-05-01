# Changelog

All notable changes to Latero Control are documented here.

## Naming Note

This repository is currently being harmonized around the product name
`Latero Control`.

Older entries may still refer to:
- `Layer2 Meta Insights`
- `Latero Meta Insights`

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Databricks pull-to-Postgres sync endpoint: `POST /api/sync/databricks` (optional `from`/`to`, default last 7 days).
- Sync orchestration library (`syncFromDatabricks`) with range validation and per-domain sync counters.
- Partial unique indexes for `databricks-sync` records in bootstrap SQL to support idempotent sync behavior.
- New requirements/work-package documentation for admin and operations:
  - `docs/requirements/admin-app-separation-workpackages.md`
  - `docs/requirements/security-guidelines.md`
  - `docs/requirements/go-live-checklist.md`

### Fixed
- **Grid layout overflow on MacBook Pro and other ≥1280px viewports** (LADR-014): `useContainerWidth()` from `react-grid-layout` v2 initializes at `1280px` and registers its `ResizeObserver` in `useEffect([])`. Because `DashboardCanvas` returns `null` until `mounted=true`, the container element does not yet exist when the effect runs — the observer never fires and `width` stays permanently at `1280px`. On viewports narrower than 1280px (e.g. sidebar-adjusted content area) the grid overflowed and right-side widgets (Dataset Health) were clipped. Replaced `useContainerWidth` with a custom `ResizeObserver` in `useEffect([mounted])` that starts observing only after the container is in the DOM.
- **Tenant Data Isolation Security Hardening (LADR-029, LINS-016):**
  - **Shared Widget API**: Added `requireSession()` authentication to all shared widget endpoints (`GET`, `POST`, `PATCH`, `DELETE`). Widgets now filtered by `installation_id` at server-side; added `installation_id: string` field to `SharedWidgetDef` type.
  - **Personal Dashboards**: Namespaced localStorage key by installation (`insights-dashboard-store-v1:{installation_id}`). `DashboardProvider` now uses `useInstallation()` hook and reloads dashboard state on installation switch, preventing cross-tenant dashboard visibility.
  - **Settings/Sync Routes**: Added `requireSession()` checks to `/api/settings` (GET/PUT) and `/api/sync/databricks` (POST) to prevent unauthenticated access and enforce tenant isolation.
  - **Result**: Strict server-side tenant data isolation now enforced. No installation's data is visible in another installation's context except in admin aggregation views.
- `useBreakpoint` initial state was hardcoded `"lg"`, causing a sidebar flash on ≥1280px viewports at page load. Fixed with a lazy `useState` initializer reading `window.innerWidth` directly.
- `transition-all` on `<main>` replaced with `transition-[padding-left]` to prevent unintended CSS transitions on sidebar toggle.
- **Dark mode sidebar contrast** (`--color-sidebar-muted`) raised from `#7A8FA8` to `#A0B5CC` to meet WCAG AA contrast requirements on section labels and inactive nav items.
- Databricks sync is now idempotent within range scope via `ON CONFLICT ... DO UPDATE` for sync rows.
- Lineage entities derived from Postgres now include computed statuses (`latest_status`, `end_to_end_status`) and adjacency (`upstream_entity_fqns`, `downstream_entity_fqns`) instead of defaulting to `UNKNOWN`/empty.
- Lineage attribute derivation now ignores empty-string attributes (`NULLIF(..., '')`) to reduce noisy mappings.
- Admin route guard behavior no longer bounces unauthenticated users from `/admin` to `/pipelines` via `/`; redirect now preserves admin intent using `next=/admin`.
- Post-login redirect intent handling now respects safe `next` values so admin users return to requested admin pages after authentication.
- Settings flow restored for Databricks runtime configuration input and test from the dashboard settings UI.
- Tenant-scoped runtime settings resolution enforced across `/api/settings`, `/api/test-connection`, and `/api/health` for the active installation context.

### Changed
- Hybrid ingest model formalized: push (`/api/v1/*`) + pull sync (`/api/sync/databricks`) both write to Postgres as single read store.
- Lineage read APIs are now consistently Postgres-backed (`/api/lineage`, `/api/lineage/entities`, `/api/lineage/attributes`).
- LINS-011 updated (LADR-013): sidebar auto-expand threshold raised from 1024px to 1280px for better content width on common laptop resolutions (1024–1279px now collapses by default, user can expand)
- `useBreakpoint` gains `isSmallDesktop` flag (1024–1279px)
- Sidebar viewport-reactive collapse logic updated to match new thresholds
- Dashboard layout padding adjusted: `xl:px-6` instead of `lg:px-6`
- `overflow-x-hidden` added to root layout to prevent horizontal overflow
- **Exclusive drawer state**: `DashboardSettingsDialog` and `NewDashboardModal` can no longer be open simultaneously; opening one closes the other.
- **Dashboard name affordance**: pencil icon appears on hover next to the dashboard title for user dashboards, making inline rename discoverable without entering full edit mode.
- **Mobile "More" → bottom sheet**: tapping "More" in the bottom navigation now opens a slide-up sheet listing all secondary routes, instead of navigating directly to `/settings`.
- **Lineage mode labels** simplified to "By Run / Latest / Full Chain" (previously "Run History / Current Structure / Pipeline Chain"); descriptive tooltips retained.
- **`PublishWidgetDialog`** rebuilt as a collapsible right-side drawer, consistent with `DashboardSettingsDialog` and `NewDashboardModal`.
- `slideUpSheet` keyframe animation added to `globals.css` for the mobile bottom sheet.
- `latero.io` → `latero.nl` across all UI references.
- MDCF expanded to "Meta Data Controle Framework" in the About page and OpenLineage viewer.
- About page rewritten in English with Latero Control as the primary product card.
- Lineage Explorer stats bar removed (duplicate of canvas top-right panel); filter bar made collapsible with active-filter count badge.
- Dashboard grid spacing fixed: `gap-3` between grid and widget picker, `pr-1` on grid wrapper to prevent widget picker overlap.
- Login gate copy now explicitly clarifies that API keys are for ingest/API usage and not for browser login.
- Duplicate navigation entry points removed to reduce UX ambiguity:
  - removed sidebar installation picker block in dashboard nav
  - removed duplicate dashboard switcher from dashboard header

## [0.1.0] — 2026-04-20

### Added
- Initial release of Layer2 Meta Insights (`@layer2/meta-insights`)
- Dashboard builder with drag-and-drop widget placement (`react-grid-layout` v2)
- Three-tier widget model: `system` (registry), `shared` (server JSON store), `personal` (localStorage)
- System dashboards: Pipelines (`/pipelines`), Data Quality (`/quality`), BCBS239 (`/bcbs239`)
- Custom widget wizard at `/dashboard/widget-builder` (4-step, client-side QueryEngine)
- Shared widget library API (`GET/POST/DELETE /api/widgets/shared`) with `data/shared-widgets.json` persistence
- Runtime settings UI (`/settings`) with Databricks connectivity test (`/api/test-connection`)
- Cache-only demo mode with synthetic seed data (`POST /api/cache/seed`, `scripts/seed-cache.ts`)
- Three-state source indicator: Live / Cache / Fallback
- Light/dark theme toggle via `data-theme` attribute (LADR-006)
- Lineage graph viewer (`/lineage`) powered by `@xyflow/react`
- OpenLineage event log viewer (`/openlineage`)
- Datasets overview (`/datasets`)
- Responsive layout: expanded/collapsed sidebar (≥1024px), bottom navigation (<768px)
- PWA manifest with install support on Android and iOS
- Typed data adapter interface for Databricks SQL Warehouse (`src/lib/adapters/`)
- TanStack Query v5 hooks per domain entity (`src/hooks/`)
- Typed API client with `ApiClientError` and response envelope (`src/lib/api/`)
- Rate limiting on public API endpoints (`src/lib/rate-limit.ts`)
- Design token system in `src/styles/tokens.css`
- `CLAUDE.md` project instructions
- Agent team: Tech Lead, UX Designer, Requirement Engineer, Developer, Document Writer, Code Review

### Architecture Decisions
- LADR-003: Layer2 Meta Insights standalone web frontend
- LADR-004: Runtime settings store
- LADR-005: Cache-only demo mode
- LADR-006: Theme architecture (data-theme as single source of truth)
- LADR-007: Dashboard Builder unified model
- LADR-008: Dashboard Builder implementation
- LADR-009: Widget library navigation and drag placement
- LADR-010: Canvas CTA pattern and smart placement algorithm
- LADR-011: Remove static dashboard views
- LADR-012: Shared widget library three-tier model
- LADR-013: Adaptive navigation breakpoints (sidebar 1280px threshold)
- LADR-014: Grid container width — custom ResizeObserver tied to mounted state
