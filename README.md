# Latero Control

**Latero Control** is a standalone metadata operations product for data teams.
It provides pipeline monitoring, data quality visibility, lineage exploration,
and operational evidence workflows.

Latero Control is a self-contained product, positioned for SaaS delivery.
It connects to your data environment through one of two integration modes —
no custom platform coupling required.

## Integration modes

**API mode** — Latero runtimes push pipeline events to `/api/v1/*`. Data lands
directly in the Insights store. Choose this when you run Latero in your own
pipelines.

**Databricks mode** — Operators trigger a pull sync via `POST /api/sync/databricks`.
Latero Control pulls pipeline, quality and lineage data from a Databricks SQL
Warehouse into the Insights store. Databricks access is always server-side.

Both modes write to the same Postgres read store. The dashboard layer is identical
regardless of which mode is active.

## Repository structure

The repository contains two modules:

```text
web/                    Next.js application (product UI, API routes, dashboards)
infra/                  Local development infrastructure (Docker, Postgres bootstrap)
docs/                   ADRs and product requirements
```

### Web module

```text
web/src/
  app/                  Next.js App Router pages and API routes
    (dashboard)/        Dashboard layout group
    api/                Server-side API routes
  components/           Shared UI components
  hooks/                TanStack Query hooks per domain entity
  lib/                  Core logic: settings, sync, read APIs
  styles/               Design tokens and responsive styles
  types/                TypeScript types
web/data/               Shared widget library (shared-widgets.json)
web/public/             Static assets, PWA manifest
```

### Infra module

```text
infra/docker/           Compose files, Dockerfiles, Caddy config
infra/sql/              Postgres bootstrap SQL
```

Services in local infra:
- Postgres on `localhost:5432`
- Redis on `localhost:6379`
- Azurite on `localhost:10000-10002`

## Quick Start

### Option A — Web local, infra in Docker

Recommended for everyday development.

```bash
npm install
cp web/.env.example web/.env.local
npm run infra:up
npm run dev
```

Open: `http://localhost:3000`

### Option B — Web + infra in Docker

Useful for development environment parity inside containers.

```bash
npm install
cp web/.env.example web/.env.local
npm run dev:docker:up
```

Open: `http://localhost:3010`

## Local infra

### Install Docker Desktop

```bash
brew install --cask docker
open -a Docker
```

Verify:

```bash
docker --version
docker compose version
```

### Start infra

```bash
npm run infra:up
```

### Reset local database

```bash
npm run infra:reset-db
```

### Follow or stop infra

```bash
npm run infra:logs
npm run infra:down
```

## Daily workflow

```bash
# 1. Start Postgres (and Redis / Azurite)
docker compose -f infra/docker/docker-compose.local.yml up -d

# 2. Start the web dev server
npm --workspace web run dev
```

App runs at **http://localhost:3000**.

### Restart dev server (without losing data)

```bash
pkill -f "next dev" || true
npm --workspace web run dev
```

### Restart Postgres

```bash
docker compose -f infra/docker/docker-compose.local.yml restart postgres
```

### Status check

```bash
curl -s http://localhost:3000/api/health
docker exec insights-local-postgres pg_isready -U insights -d insights
```

### Full reset (deletes all data)

```bash
pkill -f "next dev" || true
docker compose -f infra/docker/docker-compose.local.yml down -v
docker compose -f infra/docker/docker-compose.local.yml up -d
npm --workspace web run dev
```

> **Note:** `-v` removes the Postgres volume including all stored data.

## Dev container

`infra/docker/docker-compose.dev.yml` is a dev-only overlay for the web module.

- The repository is bind-mounted into the container
- Source code stays on the host
- `web/.cache`, `web/data`, and `web/.next` stay on the host
- Only `node_modules` lives in a Docker volume

```bash
npm run dev:docker:up
npm run dev:docker:logs
npm run dev:docker:down
```

## Environment setup

```bash
cp web/.env.example web/.env.local
```

Typical local values:

```env
POSTGRES_URL=postgresql://insights:insights@localhost:5432/insights
REDIS_URL=redis://localhost:6379
AZURE_STORAGE_BLOB_ENDPOINT=http://127.0.0.1:10000/devstoreaccount1
AZURE_STORAGE_QUEUE_ENDPOINT=http://127.0.0.1:10001/devstoreaccount1
```

For Databricks mode, also configure Databricks credentials in `web/.env.local`.

## Scripts

```bash
npm run dev              # Web module locally
npm run build
npm run start
npm run lint

npm run infra:up         # Infra module in Docker
npm run infra:logs
npm run infra:down
npm run infra:reset-db

npm run dev:docker:up    # Web + infra in Docker for development
npm run dev:docker:logs
npm run dev:docker:down
```

