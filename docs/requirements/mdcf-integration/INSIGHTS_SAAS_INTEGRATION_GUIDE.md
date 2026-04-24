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
