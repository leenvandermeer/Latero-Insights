# LADR-025 — Insights SaaS ingest backend in Next.js with Postgres bootstrap

Datum: 2026-04-24
Status: ACCEPTED

## Context

Layer2 Meta Insights started as a Databricks-read visualization product.
For the unified SaaS direction, the platform also needs an ingest backend that
accepts runtime events from Latero adapters and stores them in
Insights-managed storage.

Without this backend layer:

- MDCF SaaS adapters cannot deliver events end-to-end
- the product remains dashboard/read-first instead of control-plane capable
- tenant scoping and API-token governance remain implicit

## Decision

Layer2 Meta Insights will implement the first SaaS ingest backend directly in
its Next.js server routes, backed by Postgres provisioned through local Docker
bootstrap.

The implementation includes:

1. Versioned ingest API under `/api/v1`:
   - `POST /api/v1/pipeline-runs`
   - `POST /api/v1/dq-checks`
   - `POST /api/v1/lineage`
   - `GET /api/v1/health`
   - `GET /api/v1/installations/{installation_id}/status`
2. Bearer-token authorization for `/api/v1/*` with installation-bound
   verification against `insights_installations`.
3. Postgres bootstrap via `docker-compose.local.yml` and
   `sql/init/001_insights_saas_init.sql`.
4. Core ingest tables in Insights-owned storage:
   - `insights_installations`
   - `pipeline_runs`
   - `data_quality_checks`
   - `data_lineage`
   - `ingest_audit`
5. Compatibility with MDCF dual-write rollout (Databricks local meta tables
   plus SaaS event delivery).

## Consequences

Positive:

- closes the strategic gap between SaaS positioning and actual backend
  capability
- enables MDCF adapter-based endpoint configuration for real event ingestion
- creates an explicit product boundary for tenant-scoped metadata evidence

Trade-offs:

- ingest processing currently runs in the Next.js server tier
- multi-tenant IAM and billing remain out of scope for this iteration
- asynchronous worker separation is still a future design step

## Follow-up

- introduce dedicated async ingest worker plane and queue-backed retries
- add organization/workspace tenancy beyond installation token model
- formalize rate-limit policy as product requirement and operational SLO
- keep API contract aligned with MDCF integration guide and OpenAPI contract
