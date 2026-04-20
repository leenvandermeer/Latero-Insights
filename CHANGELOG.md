# Changelog

All notable changes to Layer2 Meta Insights are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
