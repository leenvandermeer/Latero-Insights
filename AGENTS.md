# AGENTS.md — Latero Insights

## Project

**Latero Insights** (`@layer2/meta-insights`) is a standalone responsive
Next.js application for metadata operations, dashboarding, lineage exploration,
and operational evidence workflows on top of the Latero MDCF model.

The current product architecture is no longer just a direct Databricks-reader.
It now consists of:

- a **web module** in `src/`
- an **infra module** for local/dev runtime support (`docker-compose*.yml`, `sql/init/`)

Canonical operational data is persisted in Postgres. The product still supports
Databricks connectivity for pull-sync and integration scenarios, but dashboard
read APIs are backed by the Insights read store.

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
data/                   Local writable app data (shared widgets, overrides)
docs/                   ADRs, requirements, and product assets
  decisions/            Architecture Decision Records (LADR-xxx)
  product/              Product assets and collateral
  requirements/         Normative product and integration requirements
public/                 Static assets, PWA manifest
scripts/                Local scripts and utilities
sql/
  init/                 Postgres bootstrap SQL for local/dev infra
src/
  app/                  Next.js App Router pages and API routes
    (dashboard)/        Dashboard layout group (DashboardProvider scope)
    api/                Server-side API routes
  components/           Shared UI components
  contexts/             React context (DashboardContext)
  hooks/                TanStack Query hooks per domain entity
  lib/                  Core logic: settings, cache, sync, read APIs, adapters
  styles/               tokens.css (design tokens), responsive.css
  types/                TypeScript types (dashboard.ts)
infra/
  docker/               Compose files, Dockerfiles, Caddy config
  sql/                  Postgres bootstrap SQL for local/dev infra
```

## Key Architecture Rules

- **Every view is a dashboard.** Fixed pages (`/pipelines`, `/quality`,
  `/bcbs239`) are system dashboards rendered by `DashboardCanvas`. There are
  no hardcoded page layouts.
- **Three widget tiers:** `system` (registry.ts, built-in), `shared`
  (`/api/widgets/shared`, JSON-persisted in `data/shared-widgets.json`),
  `personal` (localStorage, per-browser).
- **Read APIs are store-backed.** The primary dashboard APIs read from the
  Insights read store, not directly from Databricks.
- **Databricks access stays server-side.** Pull sync and integration logic must
  stay in server-side code; no credentials are exposed to the browser.
- **Infra and web are one system.** Treat Docker/SQL/bootstrap assets as a
  first-class repo module, not as incidental leftovers.
- **Dashboard store v1 uses localStorage** (`insights-dashboard-store-v1`).
  Shared widget definitions and some overrides also persist to local JSON files
  under `data/`.
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
| `POST /api/sync/databricks` | Pull sync from Databricks into Insights store |
| `GET /api/pipelines` | Pipeline runs |
| `GET /api/quality` | DQ check results |
| `GET /api/lineage` | Lineage data |
| `POST /api/v1/*` | Push ingest endpoints for Latero runtimes |
| `GET/POST/DELETE /api/widgets/shared` | Shared widget library |

## Engineering Guardrails

- Do not put Databricks credentials or API tokens in any component or page.
- Do not add direct `fetch()` calls to API routes from client components — use
  the typed API client in `src/lib/api/` and the query hooks in `src/hooks/`.
- Do not write SQL in components.
- Do not store widget definitions as system widgets without a registry entry.
- Do not persist shared widgets to localStorage — shared widgets use the
  server-side JSON store.
- Do not bypass the read-store model by reintroducing direct browser-side
  reads from Databricks or Postgres.
- Never place `@theme` blocks inside `@media` queries — this breaks the
  `data-theme` override mechanism (see LADR-006).

## Documentation Conventions

- ADRs live in `docs/decisions/` with prefix `LADR-` and format
  `YYYYMMDD-title.md`.
- Requirements live in `docs/requirements/current-product-requirements.md`
  with IDs `LINS-xxx`.
- ADR index: `docs/decisions/index.md`.
- Language: Dutch for decision context sections where applicable; English for
  technical specifications.

## What Not To Do

- Do not couple this repository to the Latero MDCF Python package or demo
  config files.
- Do not write directly back into customer-managed Databricks meta tables.
- Do not create new top-level directories without an ADR.
- Do not move system widget logic into shared or personal tiers.
