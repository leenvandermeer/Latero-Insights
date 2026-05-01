# Latero Control — Current Architecture

Status: CURRENT  
Owner: Latero product

## Purpose

This document defines the current architecture of Latero Control at a product
level. It replaces older descriptions that framed the product as only a direct
Databricks visualization layer.

## System Model

Latero Control consists of two primary modules inside one repository:

1. **Web module**
   - Next.js application
   - dashboard UX
   - lineage and evidence views
   - API routes and orchestration logic

2. **Infra module**
   - local development infrastructure
   - database bootstrap
   - Docker-based development and runtime support

## Runtime Architecture

The current product uses a hybrid ingest model with a single read store:

1. Event producers can push metadata into Insights through `/api/v1/*`
2. Operators can pull metadata from Databricks through `/api/sync/databricks`
3. Insights persists canonical operational data in Postgres
4. Dashboard read APIs serve from the Insights store
5. Snapshot files in `.cache` remain available for fallback and local resilience

## Canonical Read Store

The authoritative read store for the web application is Postgres.

Core operational datasets:

- `pipeline_runs`
- `data_quality_checks`
- `data_lineage`
- `insights_installations`
- `ingest_audit`

Bootstrap SQL lives under:

- `infra/sql/init/`

## Local Development Modes

### Mode A — Web local, infra in Docker

Use:

- `npm run infra:up`
- `npm run dev`

### Mode B — Web + infra in Docker

Use:

- `npm run dev:docker:up`

In dev-container mode:

- source code remains on the host via bind mount
- `web/.cache`, `web/data`, and `web/.next` remain on the host
- only `node_modules` is stored in a Docker volume

## Repository Module Boundaries

### Web module

Primary locations:

- `web/src/`
- `web/public/`
- `web/data/`
- `web/scripts/`

### Infra module

Primary locations:

- `infra/docker/docker-compose.local.yml`
- `infra/docker/docker-compose.dev.yml`
- `infra/docker/docker-compose.prod.yml`
- `infra/docker/Dockerfile`
- `infra/docker/Dockerfile.dev`
- `infra/sql/init/`

### Supporting docs and assets

Primary locations:

- `docs/decisions/`
- `docs/requirements/`
- `docs/product/`

## Guardrails

- Browser clients must not connect directly to Databricks or Postgres
- Operational reads must use the Insights read-store model
- Databricks credentials must remain server-side
- Infra assets are a first-class module, not incidental support files
