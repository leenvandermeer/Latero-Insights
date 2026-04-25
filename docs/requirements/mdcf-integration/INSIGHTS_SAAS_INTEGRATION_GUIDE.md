# Latero Insights SaaS Integration Guide

**Status:** SaaS-first architecture implemented  
**Target:** Zero local meta-tables; all events stream to Latero Insights SaaS

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ Your Databricks / Snowflake Pipeline                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  from latero.adapters.insights_saas import InsightsEventLogger
│                                                               │
│  logger = InsightsEventLogger(                               │
│    saas_url="https://api.latero-insights.app/v1",          │
│    api_token="sk_live_abc123...",                          │
│    installation_id="latero-prod"                            │
│  )                                                           │
│                                                               │
│  logger.log_pipeline_run(...)  ──┐                          │
│  logger.log_dq_check(...)      ├──→ HTTPS POST              │
│  logger.log_lineage(...)       ──┐                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ Latero Insights SaaS                                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  /api/v1/pipeline-runs  ──→ events.pipeline_runs           │
│  /api/v1/dq-checks      ──→ events.dq_checks               │
│  /api/v1/lineage        ──→ events.lineage                 │
│                                                               │
│  ✅ Auth: Bearer token                                       │
│  ✅ Validation: installation_id check                        │
│  ✅ Rate limiting: 1000 events/min                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
        │                  │                  │
        ▼                  ▼                  ▼
    ┌────────┐        ┌────────┐        ┌────────┐
    │Pipeline│        │   DQ   │        │Lineage │
    │ Runs   │        │ Checks │        │ Graph  │
    └────────┘        └────────┘        └────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
                    ┌─────────────┐
                    │  Dashboards │
                    │  & Reports  │
                    └─────────────┘
```

---

## Implementation Phases

### ✅ Phase 1: Framework Ready (DONE)

**In Latero Metadata Control Framework:**

- ✅ `latero/adapters/insights_saas.py` — Event logger (pipeline runs, DQ checks, lineage)
- ✅ `latero/insights_saas_executor.py` — SaaS-only executor (connectivity check, event streaming test)
- ✅ CLI support: `--executor insights-saas`
- ✅ Tests: 14 passing (event logging, executor, manifest validation)

### ✅ Phase 2: SaaS Backend Foundation (DONE)

**In Latero Insights SaaS repo:**

- ✅ Docker Postgres bootstrap with ingestion schema (`sql/init/001_insights_saas_init.sql`)
- ✅ Core event tables initialized automatically on first `npm run infra:up`
- ✅ API endpoints (Next.js route handlers under `/api/v1`):
  - `POST /api/v1/pipeline-runs`
  - `POST /api/v1/dq-checks`
  - `POST /api/v1/lineage`
  - `GET /api/v1/health`
  - `GET /api/v1/installations/{installation_id}/status`

- ✅ Event storage foundation (PostgreSQL)
  - `pipeline_runs` table
  - `data_quality_checks` table
  - `data_lineage` table
  - `insights_installations` table
  - `ingest_audit` table

- ✅ Auth and tenant enforcement
  - Bearer token validation on `/api/v1/*`
  - Installation ID enforcement via `insights_installations`
  - Rate limiting applied per API route

**See:** `docs/framework/INSIGHTS_SAAS_API_CONTRACT.yml` (full OpenAPI 3.0 spec)

### ✅ Phase 3: Collector Adapter Endpoints (DONE — WP-5.1 through WP-5.6)

**In Latero Insights SaaS repo:**

- ✅ `POST /api/v1/ingest` — unified ingest endpoint for `latero-core` adapter events
  - Accepts JSON array of events dispatched by `event_type`
  - Supports: `pipeline_run`, `data_quality_check`, `lineage`
  - `evidence` MAP stored as-is in `payload`
  - `hop_kind` stored and filtered on lineage queries
  - Partial-success response: returns per-event `accepted`/`rejected` result
- ✅ `POST /api/v1/license/validate` — license validation (WP-5.1)
  - Validates `installation_id` + `api_key` against `insights_installations`
  - Returns `subscription_tier` and `valid_until`
  - Records `adapter_version` per call in `adapter_version_log` (LLIC-003)
  - Response codes: 200 / 401 / 403 / 400
- ✅ Schema version enforcement (WP-5.6)
  - `schema_version >= 1.0, < 2.0` accepted
  - `schema_version >= 2.0` rejected with 422
- ✅ Lineage hop_kind filter (WP-5.3)
  - Entity graph, upstream/downstream counts, and attribute lineage filtered on `data_flow` hops
  - Context hops excluded from coverage and depth calculations
- ✅ DB migration: `sql/init/002_license_and_installations.sql`
  - `insights_installations`: `label`, `subscription_tier`, `valid_until` columns added
  - `adapter_version_log` table added

**Key management API (admin):**

- ✅ `GET /api/v1/installations` — list all installations (requires `INSIGHTS_ADMIN_TOKEN`)
- ✅ `POST /api/v1/installations` — create installation, returns one-time `api_key`
- ✅ `PATCH /api/v1/installations/{id}` — update label / active / tier / valid_until
- ✅ `DELETE /api/v1/installations/{id}` — revoke installation (sets `active = false`)
- ✅ Settings UI: `InstallationsManager` component in `/settings` page

### ✅ Phase 3: Framework Notebooks Updated (DONE)

**After SaaS is ready, update notebooks to use SaaS logger:**

```python
# OLD (local)
from latero.adapters.databricks import DeltaEventLogger
logger = DeltaEventLogger(spark=spark, ...)
logger.log_pipeline_run(...)  # → local meta.pipeline_runs

# NEW (SaaS)
from latero.adapters.insights_saas import InsightsEventLogger
logger = InsightsEventLogger(
    saas_url=dbutils.secrets.get("insights", "saas_url"),
    api_token=dbutils.secrets.get("insights", "api_token"),
    installation_id="latero-prod"
)
logger.log_pipeline_run(...)  # → SaaS API
```

Current implementation state:

- Databricks step notebooks can mirror event writes to Insights SaaS through `build_step_logger()`.
- Existing Databricks meta tables remain available only for compatibility and controlled fallback.
- MDCF runtime bridge passes `saas_target` through to runtime config when provided.

Design choice:

- Default mode is non-blocking dual-write for safe rollout.
- Set `LATERO_INSIGHTS_SAAS_STRICT=true` to enforce fail-fast SaaS delivery.

Notebook-side configuration options:

1. Runtime config pass-through (preferred):

```yaml
# config/datasets.yml
saas_target:
  saas_url: "http://localhost:3010/api/v1"
  api_token: "sk_test_local_insights"
```

1. Environment fallback (Databricks job/task env):

```bash
LATERO_INSIGHTS_SAAS_URL=http://localhost:3010/api/v1
LATERO_INSIGHTS_SAAS_TOKEN=sk_test_local_insights
LATERO_INSIGHTS_SAAS_STRICT=false
```

`LATERO_INSIGHTS_SAAS_STRICT=true` makes SaaS delivery blocking (fail-fast).

---

## Quick Start (SaaS-first)

### 1. Create SaaS manifest

```json
{
  "manifest_version": "1.0",
  "installation_id": "latero-prod",
  "environment": "production",
  "adapter": "databricks",
  "meta_target": {
    "catalog": "hive_metastore",
    "schema": "latero_meta"
  },
  "lineage_projector": {
    "enabled": true,
    "schedule": "0 */30 * * *"
  },
  "saas_target": {
    "saas_url": "https://api.latero-insights.app/v1",
    "api_token": "sk_live_YOUR_TOKEN_HERE"
  }
}
```

### 2. Validate and test connectivity

```bash
python -m latero.insights_self_service validate \
  --manifest saas_manifest.json

# ✅ status: ok
```

### 3. Dry-run (safe)

```bash
python -m latero.insights_self_service apply \
  --manifest saas_manifest.json \
  --executor insights-saas \
  --dry-run

# Output: actions marked as "planned_only"
```

### 4. Apply (real)

```bash
python -m latero.insights_self_service apply \
  --manifest saas_manifest.json \
  --executor insights-saas

# Output: health check passes, test event succeeds ✅
```

### 5. Verify

```bash
python -m latero.insights_self_service verify \
  --manifest saas_manifest.json

# status: ok → integration ready
```

---

## Event Payloads (what SaaS receives)

Two formats are accepted: the **legacy per-type format** (via the individual endpoints) and
the **collector event format** (via `POST /api/v1/ingest`). New integrations should use
the collector format via the unified ingest endpoint.

### Collector event format (POST /api/v1/ingest)

Send a JSON array. All events in a batch must share the same `installation_id`.

```json
[
  {
    "event_type": "pipeline_run",
    "schema_version": "1.2",
    "run_id": "550e8400-e29b-41d4-a716-446655440000",
    "dataset_id": "cbsenergie",
    "step": "landing_to_raw",
    "installation_id": "latero-prod-nl",
    "environment": "production",
    "status": "SUCCESS",
    "started_at": "2026-04-25T09:00:00Z",
    "finished_at": "2026-04-25T09:02:10Z",
    "evidence": { "files_processed": 3, "rows_written": 4812 }
  },
  {
    "event_type": "data_quality_check",
    "schema_version": "1.2",
    "run_id": "550e8400-e29b-41d4-a716-446655440000",
    "dataset_id": "cbsenergie",
    "step": "landing_to_raw",
    "check_id": "row_count_positive",
    "check_status": "SUCCESS",
    "severity": "high",
    "check_mode": "enforce",
    "installation_id": "latero-prod-nl",
    "environment": "production",
    "evidence": { "row_count": 4812 }
  },
  {
    "event_type": "lineage",
    "schema_version": "1.2",
    "run_id": "550e8400-e29b-41d4-a716-446655440000",
    "dataset_id": "cbsenergie",
    "step": "landing_to_raw",
    "source_ref": "landing.cbsenergie",
    "target_ref": "raw.cbsenergie",
    "lineage_scope": "entity",
    "relation_type": "derived_from",
    "hop_kind": "data_flow",
    "installation_id": "latero-prod-nl",
    "environment": "production",
    "evidence": {}
  }
]
```

### Legacy format (POST /api/v1/pipeline-runs etc.)

### Pipeline Run

```json
{
  "event_type": "pipeline_run",
  "timestamp_utc": "2026-04-24T10:30:00Z",
  "dataset_id": "cbsenergie",
  "run_id": "run-20260424-103000",
  "step": "landing_to_raw",
  "status": "success",
  "execution_seconds": 120,
  "installation_id": "latero-prod",
  "environment": "production",
  "source_system": "cbs"
}
```

### DQ Check

```json
{
  "event_type": "data_quality_check",
  "timestamp_utc": "2026-04-24T10:30:00Z",
  "dataset_id": "cbsenergie",
  "check_id": "row_count_check",
  "check_name": "Row count > 1000",
  "status": "passed",
  "severity": "high",
  "run_id": "run-20260424-103000",
  "step": "landing_to_raw",
  "installation_id": "latero-prod",
  "environment": "production"
}
```

### Lineage

```json
{
  "event_type": "data_lineage",
  "timestamp_utc": "2026-04-24T10:30:00Z",
  "dataset_id": "cbsenergie",
  "input_entity": "landing/cbsenergie",
  "output_entity": "raw/cbsenergie",
  "run_id": "run-20260424-103000",
  "step": "landing_to_raw",
  "hop_kind": "data_flow",
  "installation_id": "latero-prod",
  "environment": "production"
}
```

---

## Testing Against Sandbox

Latero Insights SaaS should provide sandbox environment:

```bash
# Test token (no rate limits, separate storage)
sk_test_sandbox_abc123

# Test manifest
{
  "manifest_version": "1.0",
  "installation_id": "sandbox-test",
  "environment": "test",
  "adapter": "databricks",
  "saas_target": {
    "saas_url": "https://sandbox-api.latero-insights.app/v1",
    "api_token": "sk_test_sandbox_abc123"
  }
}

# Test
python -m latero.insights_self_service apply \
  --manifest sandbox_manifest.json \
  --executor insights-saas
```

---

## Next Steps

1. **For Latero Insights team:**
   - Review `INSIGHTS_SAAS_API_CONTRACT.yml`
   - Implement API endpoints
   - Set up event storage
   - Provide test tokens

2. **For Latero framework team:**
   - After SaaS is live: update notebooks to use `InsightsEventLogger`
   - Remove local meta-table logic (optional; can keep for hybrid mode)
   - Deploy test manifest to validate integration

3. **For operations:**
   - Get API token from Latero Insights team
   - Create production manifest with token
   - Deploy via `apply --executor insights-saas`
   - Monitor via dashboards in SaaS

---

## FAQ

**Q: Can I keep local meta-tables and sync to SaaS?**
A: Yes, that's "Hybrid mode". Use local `DeltaEventLogger` + background sync job. Not covered in this doc, but ask if needed.

**Q: What if SaaS API is down?**
A: Pipeline continues, events are lost. For high-availability, implement local queue + async retry (future enhancement).

**Q: How do I monitor events in SaaS?**
A: Visit `https://latero-insights.app/installations/{installation_id}` dashboard (once live).

**Q: Can multiple Databricks workspaces use the same SaaS?**
A: Yes. Each workspace gets its own `installation_id` and token. All data aggregates in one SaaS account.
