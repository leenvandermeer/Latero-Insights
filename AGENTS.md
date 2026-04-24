# AGENTS.md — Layer2 Meta Insights

## Project

**Layer2 Meta Insights** (`@layer2/meta-insights`) is a standalone responsive
Next.js web application that visualizes pipeline metadata, data quality, and
data lineage stored in the Latero MDCF meta tables. It is a Latero product, not
a demo artifact.

It reads from three standard meta tables written by the Latero runtime:

- `pipeline_runs`
- `data_quality_checks`
- `data_lineage`

These tables live in Databricks Unity Catalog (Delta). Snowflake support is
deferred to a future release.

## Tech Stack

- **Framework:** Next.js 15 (App Router, TypeScript)
- **Styling:** Tailwind CSS v4, CSS custom properties in `src/styles/tokens.css`
- **Data fetching:** TanStack Query v5 (`@tanstack/react-query`)
- **Dashboard grid:** `react-grid-layout` v2
- **Lineage graph:** `@xyflow/react`
- **Icons:** Lucide React
- **Package:** `@layer2/meta-insights`

## Repository Structure

```text
data/                   Shared widget library (shared-widgets.json)
docs/                   ADRs and product requirements
  decisions/            Architecture Decision Records (LADR-xxx)
  requirements/         Normative product requirements (LINS-xxx)
public/                 Static assets, PWA manifest
scripts/                Seed cache CLI (seed-cache.ts)
src/
  app/                  Next.js App Router pages and API routes
    (dashboard)/        Dashboard layout group (DashboardProvider scope)
    api/                Server-side API routes (proxied to Databricks)
  components/           Shared UI components
  contexts/             React context (DashboardContext)
  hooks/                TanStack Query hooks per domain entity
  lib/                  Core logic: cache, settings, adapters, API client
  styles/               tokens.css (design tokens), responsive.css
  types/                TypeScript types (dashboard.ts)
```

## Key Architecture Rules

- **Every view is a dashboard.** Fixed pages (`/pipelines`, `/quality`,
  `/bcbs239`) are system dashboards rendered by `DashboardCanvas`. There are
  no hardcoded page layouts.
- **Three widget tiers:** `system` (registry.ts, built-in), `shared`
  (`/api/widgets/shared`, JSON-persisted in `data/shared-widgets.json`),
  `personal` (localStorage, per-browser).
- **Data adapter interface.** All Databricks SQL calls go through the typed
  adapter in `src/lib/adapters/`. No raw SQL in components or pages.
- **API proxy only.** All data platform calls are server-side API routes.
  No credentials are exposed to the browser.
- **Read-only.** No DML against any data platform table.
- **Dashboard store v1 uses localStorage** (`insights-dashboard-store-v1`).
  Server persistence (`/api/dashboards`) is deferred (P4).
- **Runtime settings** are stored in `.cache/settings.json` and take priority
  over environment variables. Token values are stored in plaintext — operators
  must secure filesystem access.
- **Theme:** `data-theme` attribute on `<html>` is the single source of truth.
  `@theme` in `globals.css` defines light-mode values only; dark overrides live
  in `[data-theme="dark"]` selectors in `tokens.css`.
- **QueryEngine** is client-side. Custom widget queries operate on the JSON
  payload already fetched from API routes — they do not generate SQL.

## API Surface

| Route | Purpose |
|-------|---------|
| `GET/PUT /api/settings` | Runtime configuration |
| `POST /api/test-connection` | Databricks connectivity check |
| `GET /api/health` | Health check |
| `GET /api/pipelines` | Pipeline runs |
| `GET /api/quality` | DQ check results |
| `GET /api/lineage` | Lineage data |
| `POST /api/cache/seed` | Generate synthetic demo data |
| `GET/POST/DELETE /api/widgets/shared` | Shared widget library |

## Engineering Guardrails

- Do not put Databricks credentials or API tokens in any component or page.
- Do not add direct `fetch()` calls to API routes from client components — use
  the typed API client in `src/lib/api/` and the query hooks in `src/hooks/`.
- Do not write SQL in components. All queries go through the adapter interface.
- Do not store widget definitions as system widgets without a registry entry.
- Do not persist shared widgets to localStorage — shared widgets use the
  server-side JSON store.
- Do not add writable database tables. The application is read-only toward
  the Latero meta tables; `data/shared-widgets.json` is the only writable store.
- Never place `@theme` blocks inside `@media` queries — this breaks the
  `data-theme` override mechanism (see LADR-006).

## Documentation Conventions

- ADRs live in `docs/decisions/` with prefix `LADR-` and format
  `YYYYMMDD-title.md`.
- Requirements live in `docs/requirements/insights-product.md` with IDs
  `LINS-xxx`.
- ADR index: `docs/decisions/index.md`.
- Language: Dutch for decision context sections where applicable; English for
  technical specifications.

## What Not To Do

- Do not couple this repository to the Latero MDCF Python package or demo
  config files.
- Do not add a writable connection to Databricks meta tables.
- Do not introduce a separate database — the JSON file store is intentional
  for single-tenant deployments.
- Do not create new top-level directories without an ADR.
- Do not move system widget logic into shared or personal tiers.
