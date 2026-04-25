# Latero Insights Infra Module

This directory contains the infrastructure module of Latero Insights.

Main contents:

- `docker/` — Docker Compose files, Dockerfiles, Caddy config
- `sql/init/` — Postgres bootstrap SQL

Typical use from the repository root:

```bash
npm run infra:up
npm run infra:logs
npm run infra:down
```

Docker file locations:

- `infra/docker/docker-compose.local.yml`
- `infra/docker/docker-compose.dev.yml`
- `infra/docker/docker-compose.prod.yml`
