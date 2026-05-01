# AGENTS.md — Latero Control

## Project

**Latero Control** (`@layer2/meta-insights`) is a standalone metadata operations
product for data teams. It provides pipeline monitoring, data quality visibility,
lineage exploration, and operational evidence workflows.

Latero Control is a self-contained product, positioned for SaaS delivery.
It is not a demo dashboard and not coupled to any specific data platform or runtime.

The product supports two integration modes:

1. **API mode** — Latero runtimes push events to `/api/v1/*`. Canonical data is
   stored in Postgres. Dashboards read from the Insights store.
2. **Databricks mode** — Operators pull data via `POST /api/sync/databricks` into
   the same Insights store.

The repository is split into two explicit modules:

- a **web module** under `web/`
- an **infra module** for local/dev runtime support under `infra/`

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
web/
  data/                 Local writable app data (shared widgets, overrides)
  public/               Static assets, PWA manifest
  scripts/              App-local scripts
  src/
    app/                Next.js App Router pages and API routes
      (dashboard)/      Dashboard layout group (DashboardProvider scope)
      api/              Server-side API routes
    components/         Shared UI components
    contexts/           React context (DashboardContext)
    hooks/              TanStack Query hooks per domain entity
    lib/                Core logic: settings, cache, sync, read APIs
    styles/             tokens.css (design tokens), responsive.css
    types/              TypeScript types (dashboard.ts)
infra/
  docker/               Compose files, Dockerfiles, Caddy config
  sql/                  Postgres bootstrap SQL for local/dev infra
docs/
  decisions/            Architecture Decision Records (LADR-xxx)
  requirements/         Normative product requirements (LINS-xxx)
  product/              Product assets and collateral
```

## Key Architecture Rules

- **Every view is a dashboard.** Fixed pages (`/pipelines`, `/quality`,
  `/bcbs239`) are system dashboards rendered by `DashboardCanvas`. There are
  no hardcoded page layouts.
- **Three widget tiers:** `system` (registry.ts, built-in), `shared`
  (`/api/widgets/shared`, JSON-persisted in `data/shared-widgets.json`),
  `personal` (localStorage, per-browser).
- **Read APIs are store-backed.** All dashboard data reads from the Insights
  Postgres store. No browser-side reads from Databricks or any other data platform.
- **All external connectivity is server-side.** No credentials or direct data
  platform connections are exposed to the browser.
- **Infra and web are one system.** Treat Docker/SQL/bootstrap assets as a
  first-class repo module, not as incidental leftovers.
- **Dashboard store v1 uses localStorage** (`insights-dashboard-store-v1`).
  Shared widget definitions persist in `data/shared-widgets.json`.
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
| `POST /api/test-connection` | Databricks connectivity check (Databricks mode) |
| `GET /api/health` | Health check |
| `POST /api/sync/databricks` | Pull sync from Databricks into the Insights store |
| `POST /api/v1/*` | Push ingest endpoints for Latero runtimes |
| `GET /api/pipelines` | Pipeline runs |
| `GET /api/quality` | DQ check results |
| `GET /api/lineage` | Lineage data |
| `GET/POST/DELETE /api/widgets/shared` | Shared widget library |

## Engineering Guardrails

- Do not put Databricks credentials or API tokens in any component or page.
- Do not add direct `fetch()` calls to API routes from client components — use
  the typed API client in `src/lib/api/` and the query hooks in `src/hooks/`.
- Do not write SQL in components or pages.
- Do not store widget definitions as system widgets without a registry entry.
- Do not persist shared widgets to localStorage — shared widgets use the
  server-side JSON store.
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

- Do not couple this repository to the Latero Metadata Control Framework Python
  package or any demo configuration.
- Do not add a writable connection to Databricks meta tables.
- Do not introduce a separate database — the JSON file store is intentional
  for single-tenant deployments.
- Do not create new top-level directories without an ADR.
- Do not move system widget logic into shared or personal tiers.
