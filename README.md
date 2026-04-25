# Latero Insights

Metadata operations workspace for the Latero Meta Data Control Framework.

This repository now contains one product split into two explicit modules:

1. **Web module** — the Next.js application in `web/`
2. **Infra module** — Docker/runtime/bootstrap assets in `infra/`

There is also a supporting documentation and product-assets area under `docs/`.

## Current Architecture

Latero Insights now runs on a hybrid ingest architecture with a single read store:

1. Push ingest: runtimes can publish events to `/api/v1/*`
2. Pull ingest: operators can run `POST /api/sync/databricks`
3. Canonical persistence: Insights stores metadata in Postgres
4. Read APIs: dashboards read from the Insights store
5. Snapshot fallback: `.cache` remains available for fallback and local resilience

In practice, that means the web module is no longer just a Databricks visualizer. It is an application layer on top of an Insights read store, while the infra module provides the local services and bootstrap SQL needed to run that architecture.

## Module Map

### 1. Web Module

Purpose:
- product UI
- API routes
- dashboarding
- lineage exploration
- settings and operational workflows

Main locations:
- `web/src/app`
- `web/src/components`
- `web/src/contexts`
- `web/src/hooks`
- `web/src/lib`
- `web/src/styles`
- `web/src/types`
- `web/public`
- `web/data`
- `web/scripts`

### 2. Infra Module

Purpose:
- local development infrastructure
- database bootstrap
- Docker-based parity with later deployment environments

Main locations:
- `infra/docker/docker-compose.local.yml`
- `infra/docker/docker-compose.dev.yml`
- `infra/docker/docker-compose.prod.yml`
- `infra/docker/Dockerfile`
- `infra/docker/Dockerfile.dev`
- `infra/docker/Caddyfile`
- `infra/sql/init`

Services in local infra:
- Postgres
- Redis
- Azurite

### 3. Docs and Product Assets

Purpose:
- ADRs and requirements
- integration contracts
- product collateral and reference assets

Main locations:
- `docs/decisions`
- `docs/requirements`
- `docs/product`
- `CHANGELOG.md`

## Repository Layout

```text
web/
  data/                 Local writable app data (shared widgets, overrides)
  public/               Static assets
  scripts/              App-local scripts
  src/                  Latero Insights web module
infra/
  docker/               Compose files, Dockerfiles, Caddy config
  sql/
    init/               Postgres bootstrap SQL for local/dev infra
docs/
  decisions/            Architecture Decision Records
  product/              Product collateral and assets
  requirements/         Normative requirements and integration guides
```

## Quick Start

### Option A — Web Local, Infra in Docker

Recommended for everyday development.

```bash
npm install
cp web/.env.example web/.env.local
npm run infra:up
npm run dev
```

Open:
- `http://localhost:3000`

This mode means:
- infra module runs in Docker
- web module runs locally with hot reload

### Option B — Web + Infra in Docker

Useful when you want dev environment parity inside containers.

```bash
npm install
cp web/.env.example web/.env.local
npm run dev:docker:up
```

Open:
- `http://localhost:3010`

This mode means:
- infra module runs in Docker
- web module also runs in Docker as a dev server
- source code still lives on the host via bind mount

## Local Infra Setup

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

This starts:
- Postgres on `localhost:5432`
- Redis on `localhost:6379`
- Azurite on `localhost:10000-10002`

### Reset local database

```bash
npm run infra:reset-db
```

### Follow or stop infra

```bash
npm run infra:logs
npm run infra:down
```

## Dev Container Notes

`infra/docker/docker-compose.dev.yml` is intentionally a dev-only overlay for the web module.

Behavior:
- the repository is bind-mounted into the container
- source code stays on the host
- `web/.cache`, `web/data`, and `web/.next` stay on the host
- only `node_modules` lives in a Docker volume

Commands:

```bash
npm run dev:docker:up
npm run dev:docker:logs
npm run dev:docker:down
```

## Environment Setup

Copy:

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

Depending on your ingest mode, also configure Databricks credentials in `web/.env.local`.

## Operational Model

Latero Insights is best understood as:

- **Web module**: user experience and operational workflows
- **Infra module**: local runtime services and bootstrap assets

That split is logical, but the two modules are still intentionally kept in one repository because:
- they evolve together
- local setup depends on both
- the product is still deployed and developed as one system

## Scripts

```bash
npm run dev              # Web module locally
npm run build
npm run start
npm run lint
npm run seed

npm run infra:up         # Infra module in Docker
npm run infra:logs
npm run infra:down
npm run infra:reset-db

npm run dev:docker:up    # Web + infra in Docker for development
npm run dev:docker:logs
npm run dev:docker:down
```

## Naming

The product name is **Latero Insights**.

Older documents may still reference:
- `Layer2 Meta Insights`
- `Latero Meta Insights`

Those should be treated as legacy names while the documentation is being harmonized.
