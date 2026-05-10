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

### Fixed (2026-05-10) — Installatie-isolatie TanStack Query

- **Cross-installatie cache-bleed volledig opgelost**: alle TanStack Query keys zijn nu gescopeerd op `installationId`. Switchen tussen installaties (bijv. `local_dev` → `prod`) toont nooit meer stale data van een andere installatie.
- **`use-health`**: query key `["health"]` → `["health", installationId]`.
- **`use-incidents`**: query key `["incidents", params]` → `["incidents", installationId, params]`.
- **`use-compliance`**: query keys `["policies"]`, `["compliance"]`, `["policy-packs"]` allen uitgebreid met `installationId`.
- **`use-field-values`**: query key `["field-values"]` → `["field-values", installationId]`.
- **`settings/dashboard.tsx`**: query key `["settings"]` → `["settings", installationId]`. Mode-selector (Databricks sync / API ingest) is disabled en gedempt zolang de settings nog laden — voorkomt flash naar verkeerde modus bij installatie-switch.

### Added (2026-05-10) — Widget bibliotheek uitbreiding

- **4 nieuwe built-in widgets** toegevoegd aan de widget registry:
  - `monitored-entities` (counter): toont aantal geobserveerde entiteiten in het data estate.
  - `open-incidents` (counter): toont aantal openstaande incidenten.
  - `pipeline-health-table` (table): toont de laatste run-status per pipeline, gegroepeerd op dataset.
  - `open-incidents-table` (table): toont open incidenten met severity- en status-badges.
- **Category-fix registry**: `WidgetCategory` aligned op plural-form (`"charts"`, `"tables"`) conform `types/dashboard.ts` — charts- en tables-tab in widget picker toonden voorheen niets.
- **Widget picker drawer** toont nu built-in registry widgets met "Built-in" badge naast shared en custom widgets. "No widgets yet" verscheen voorheen altijd omdat `WIDGET_REGISTRY` niet werd ingeladen.

### Added (2026-05-06) — LADR-064 Dataset vs Entity Split

- **Structurele scheiding dataset ↔ entiteit** (`infra/sql/init/020_dataset_entity_split.sql`): Postgres-migratie die het conceptuele verschil tussen *datasets* (technische landing/raw/bronze objecten) en *entiteiten* (business objecten silver/gold) formaliseert. Voegt toe: `dataset_name` (generated column), `entity_name`, `meta.entity_sources` (brug-tabel voor 1-op-veel relaties), `source_kind`/`target_kind` op `lineage_edges`.
- **1-op-veel entity support in `meta-ingest.ts`**: `writeMetaLineage` detecteert nu automatisch bron-laag en upsert entiteiten + `entity_sources` wanneer een dataset→entity-edge geïngesteerd wordt.
- **Visueel onderscheid dataset/entity-nodes in lineage graph** (`entity-node.tsx`, `graph-view.tsx`): silver/gold nodes krijgen afgeronde hoeken (`border-radius: 12px`), subtiele achtergrond en een "ENTITY" badge. Dataset-nodes (landing/raw/bronze) behouden de huidige rechthoekige stijl. `sourceDatasetsCount` wordt getoond als "gevoed door N bronnen".
- **Entity Detail Panel bronnen-sectie** (`entity-detail-panel.tsx`): toont "Gevoed door (N)" voor entiteiten met `source_datasets`, met alle bronnen als mono-labels.
- **`node_kind`, `entity_name`, `source_datasets` in `LineageEntity` type** (`types.ts`): optionele velden voor de dataset/entity-scheiding.
- **Postgres read-API uitgebreid** (`insights-saas-read.ts`): `getLineageEntitiesFromMetaStore` geeft nu `dataset_name`, `entity_name`, `source_datasets`, `node_kind` terug.
- **Databricks adapter** (`databricks.ts`): `getLineageEntities` geeft nu `node_kind`, `entity_name`, `source_datasets` terug (optional-column safe via `preferredColumn`).
- **ADR LADR-064** (`docs/decisions/20260506-dataset-vs-entity-split.md`): architectuurbesluit vastgelegd inclusief 5 work packages, conceptueel model en migratiestrategie.

### Added (2026-05-04)

- **Datasets Explorer** (`/datasets`) — nieuwe pagina in de Explore-sectie die alle geobserveerde datasets uit `meta.datasets` toont, ongeacht laag. Inclusief layer-filter tabs (All / Landing / Raw / Bronze / Silver / Gold), search en tabel met medallion layer badges, platform, entity type, group_id, laatste run-status en last-seen tijdstip. Elke rij linkt naar de lineage graph met `?focus=<fqn>`. Zichtbaar voor raw/bronze-only implementaties die nog geen entiteiten hebben (LADR-063).
- **Quality Check Detail** (`/quality/[result_id]`) — drill-down pagina vanuit de quality explorer. Toont check details (dataset, step, category, severity, mode, policy version, executed at, run ID) en resultaat (result value, threshold, check result, message). Run ID linkt naar `/runs/[id]`. Bereikbaar via "Details →" link per rij in de kwaliteitstabel.
- **API `GET /api/quality/[result_id]`** — endpoint voor DQ check detail, gefilterd op `installation_id` uit de sessie.
- **API `GET /api/datasets`** — installation-scoped endpoint voor dataset-inventarisatie met layer- en search-filters.
- **Hook `useDatasets`** — TanStack Query hook voor de datasets API.
- **"Datasets" in sidebar** — eerste item in EXPLORE-sectie vóór Entities.

### Fixed (2026-05-04)

- **Externe leverancier-nodes (bijv. "latero") zichtbaar in lineage graph en chain readiness**: datasets zonder bekende pipeline-laag (`NULL` / `unknown`) werden opgenomen in `getLineageEntitiesFromMetaStore`. Filter `AND d.layer IN ('landing','raw','bronze','silver','gold')` toegevoegd aan de hoofdquery en aan de `upstream_keys`/`downstream_keys` CTEs.
- **Auto-sync FK-fout** (`datasets_installation_id_fkey`): `triggerAutoSyncIfDue` riep `syncFromDatabricks(range, undefined)` aan, waardoor de sync schreef naar `installation_id = 'databricks-sync'` — een niet-bestaande installatie. De route-handlers geven nu hun `installationId` door aan `triggerAutoSyncIfDue`, die het doorstuurt naar `syncFromDatabricks`.
- **`step`-kolom leeg in quality explorer**: query hardcodeerde `step` als `''`. Fixed via `LEFT JOIN meta.runs` en `COALESCE(r.step, '')`.
- **`check_name` ontbrak in quality tabel**: extended SQL met `COALESCE(qru.check_name, qr.check_id) AS check_name`. Kolom getoond als primaire naam in de Check-kolom, check_id als mono-subtext.

### Added (2026-05-03)

- **Uitlogknop in tenant sidebar** — "Log out" knop (rood, met `LogOut`-icoon) toegevoegd onderaan de sidebar, na de theme-toggle. Werkt in zowel collapsed (icoon + tooltip) als expanded state. Roept `POST /api/auth/logout` aan en redirect naar `/`.

### Fixed (2026-05-03)

- **SSO policy niet gevonden voor `acme.test`-domein**: `getAuthPolicyByDomain` queried `s.allowed_domains` (kolom van `installation_sso_config`), maar die kolom bestaat niet in die tabel — `allowed_domains` staat in `installation_auth_policy` (`p`). Query gecorrigeerd naar `p.allowed_domains`. Gevolg was dat `bob@acme.test` altijd `local_only` terugkreeg en nooit een SSO-knop zag.
- **"Sign-in failed due to a network error" bij lokale login**: de login route gooit bij onverwachte DB-fouten een HTML 500-pagina; de client kan dat niet als JSON parsen en toont "network error". De `handleLogin`-logica is nu gewikkeld in een try-catch die altijd een JSON-response retourneert.
- **`is_break_glass` kolom ontbrak in runtime-schema**: de kolom staat alleen in de `007_sso_auth.sql` infra-migratie, niet in `ensureAuthSchema()`. Op verse omgevingen die `ensureAuthSchema` oproepen vóór de migratie is gedraaid faalde de `isBreakGlassUser`-query met een column-not-found error. Kolom nu ook toegevoegd via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `ensureAuthSchema`.
- **Dubbel loginformulier bij `local_only` policy**: voor `local_only` was `showLocalForm === true` én `!isSsoAvailable === true` tegelijk, waardoor zowel het SSO-fallback-form als het aparte local_only-form tegelijk renderden. Het redundante `{!isSsoAvailable && <form>}` blok is verwijderd (52 regels).
- **Icoon overlapt invoertekst in login-inputs**: Tailwind `pl-9` en de `style`-prop werkten naast elkaar; de klasse won niet consistent. Padding nu via `paddingLeft: "2.5rem"` direct in de `style`-prop gezet.
- **Login-scherm UX afwijkend van design system**: titel gebruikte Inter i.p.v. Fraunces (`--font-display`), buttons hadden `rounded-lg` i.p.v. pill-shape (`borderRadius: 100`), inputs hadden `8px` i.p.v. `12px` radius (`--radius-input`). Alle drie hersteld conform `wireframes.md` en `sso-auth-ux.md`.

### Added (2026-05-01)

- **Settings: "Sync now" button** — triggers `POST /api/sync/databricks` directly from the Settings page; shows record count and duration on completion; invalidates all TanStack Query caches so every page reloads with fresh data.
- **Settings: immediate status feedback** — health query is refetched after a successful connection test so the Databricks status dot updates without waiting for the 60s poll interval.
- **About page: dual-input-mode section** — Technical Foundation card now explains both API ingest and Databricks sync as peer modes writing to the same Postgres store, replacing the old MDCF-runtime framing.
- LADR-030: Installation-scoped DatabricksAdapter settings resolution.
- LADR-031: Slim page header pattern voor alle dashboard-pagina's.

### Fixed (2026-05-01)

- **Databricks sync failing with "Missing configuration"** (LADR-030): `DatabricksAdapter` called `loadSettings()` with no installation ID, reading root-level settings. The Settings UI writes settings scoped to the active installation (`settings.json → scoped[installationId]`). Fixed by threading `installationId` through the adapter constructor and all helper functions (`executeStatement`, `fqTable`, `resolveEnvironmentScope`, `describeColumns`). Health route, sync route and sync library updated to pass the session installation ID.
- **Lineage empty state showing date-range copy**: "No data for this date range" was the `EmptyState` component from OpenLineage. Lineage has no date range filter; replaced with a dedicated state: "No lineage data available" with Retry and Settings buttons.
- **Lineage graph crash when layer-header nodes present**: `filteredNodes` called `.toLowerCase()` on `data.label` for all nodes unconditionally. Layer-header nodes have no `data.label`, causing a `TypeError` that unmounted the React tree and made the sidebar disappear. Fixed with an `if (n.type === "layerHeader") return n;` guard.

### Changed (2026-05-01)

- **Slim page header pattern** (LADR-031): all dashboard pages now use the `<PageHeader>` slim toolbar — icon inline (no box), `text-[17px]` title, env pill (color-coded) on the right, actions in the same row. Removes gradient card with eyebrow, description and org pill. Recovers ±80–120px vertical space per page.
- Settings page rewritten to reflect the current architecture: two-column layout, status row (Databricks dot + cache info), data-source selector (Databricks sync / API ingest), compact field grid, inline cache controls. Removed `Card`/`Badge` wrappers and all explanatory paragraph text.
- `DashboardCanvas` header aligned with slim pattern: edit-mode accent border, env pill inline, no gradient background.

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
