# No-Developer Workflow for Latero Insights Integration

**TL;DR:** Geen developer-notebooks meer nodig. Maak een manifest, run `apply --executor builtin`.

Voor SaaS-first gebruik je dezelfde flow met `apply --executor insights-saas`.

---

## Workflow without developers

### 1. Manifest voorbereiding (non-technical)

Maak een JSON-bestand met je integratie-intent. Voorbeeld: `insights_manifest.json`

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
    "schedule": "0 */30 * * * "
  },
  "openmetadata_sync": {
    "enabled": false
  }
}
```

Vereiste velden:
- `installation_id` — stabiele identificatie van deze Latero installatie
- `adapter` — moet `"databricks"` zijn
- `meta_target.catalog` en `meta_target.schema` — waar Latero meta-tabellen komen
- `lineage_projector.enabled` en `schedule` — of lineage projectie enablen (cron format)

---

### 2. Valideer manifest (voordat je iets doet)

```bash
python -m latero.insights_self_service validate \
  --manifest insights_manifest.json
```

Output: `"status": "ok"` als alles klopt, anders fouten.

---

### 3. Bekijk plan (wat gaat er gebeuren?)

```bash
python -m latero.insights_self_service plan \
  --manifest insights_manifest.json
```

Output: Lijst met acties (bijv. `ensure_databricks_meta_tables`, `ensure_databricks_lineage_projector_job`)

---

### 4. Dry-run (veilig testen)

```bash
python -m latero.insights_self_service apply \
  --manifest insights_manifest.json \
  --dry-run
```

Output: Wat ZOUDEN we doen (geen echte veranderingen).

---

### 5. Apply met built-in executor (ECHTE provisioning)

```bash
export DATABRICKS_HOST="https://myworkspace.cloud.databricks.com"
export DATABRICKS_TOKEN="dapi123456..."

python -m latero.insights_self_service apply \
  --manifest insights_manifest.json \
  --executor builtin
```

De `builtin` executor:
- ✅ Maakt meta-tabellen aan in Databricks
- ✅ Maakt lineage_projector job aan (of update)
- ✅ Maakt openmetadata_sync job aan (optioneel)
- ✅ Geen hardcoded code; pure API calls

### 5b. Apply met Insights SaaS executor (één productmodel)

Gebruik dit wanneer Latero Insights als SaaS backend draait en events centraal opslaat.

```bash
python -m latero.insights_self_service apply \
  --manifest insights_manifest.json \
  --executor insights-saas
```

Benodigde manifest-sectie:

```json
"saas_target": {
  "saas_url": "http://localhost:3010/api/v1",
  "api_token": "sk_test_local_insights"
}
```

Resultaat:
- ✅ Connectivity-check naar Insights API
- ✅ Testevent naar SaaS ingest-pipeline
- ✅ Geen lokale meta-table provisioning meer nodig voor dashboarding

---

### 6. Verify (klaar?)

```bash
python -m latero.insights_self_service verify \
  --manifest insights_manifest.json
```

Output: `"status": "ok"` betekent drift-vrij (alles is gedaan).

---

## Zero-code deployment in Databricks

Ga naar Databricks > Workflows > Create Job:

1. **Job name:** `latero-insights-orchestrate`

2. **Task type:** Notebook
   - **Path:** `/Shared/_orchestrate_insights_self_service`
   
3. **Parameters:**
   ```
   manifest_path = /Workspace/Shared/insights_manifest.json
   ```

4. **Cluster:** Any cluster with Python 3.10+

5. **Schedule:** Daily or on-demand

Run → Logs show success/failure → Done.

---

## Environment variables for production

Set via Databricks Secrets or Job Config:

```bash
DATABRICKS_HOST = your-workspace-url
DATABRICKS_TOKEN = dapi...
```

The `builtin` executor reads these and provisions everything.

---

## What changed from old approach?

| Old | New |
|-----|-----|
| ❌ Developer writes custom executor code | ✅ Built-in executor (API calls) |
| ❌ Manual SQL scripts or dbt | ✅ API-driven provisioning |
| ❌ Sensitive to configuration drift | ✅ Automatic drift detection |
| ❌ Every environment needs custom work | ✅ Manifest-driven (same for all) |

SaaS runtime update:
- Latero Insights Docker bootstrap maakt nu de ingest-database en kern-tabellen automatisch aan via `sql/init/001_insights_saas_init.sql`.
- Daardoor kan de Databricks/notebook-kant focussen op pipelineconfig en event-adaptering naar SaaS.

---

## Troubleshooting

**"manifest must be valid"**
→ Run `validate --manifest` and check errors

**"DATABRICKS_HOST and DATABRICKS_TOKEN must be set"**
→ Ensure env vars are exported before `apply`

**"Could not create job"**
→ Check Databricks token has `jobs/manage` permissions; check workspace URL format

**"apply completed but verify found pending actions"**
→ One or more actions failed. Re-run `apply` (idempotent).

---

## Next: CI/CD Integration

Add to GitHub Actions / GitLab CI to auto-provision on manifest commit:

```yaml
- name: Latero Insights Apply
  env:
    DATABRICKS_HOST: ${{ secrets.DATABRICKS_HOST }}
    DATABRICKS_TOKEN: ${{ secrets.DATABRICKS_TOKEN }}
  run: |
    python -m latero.insights_self_service apply \
      --manifest examples/insights_manifest.json \
      --executor builtin
```

Manifest changes → CI validates → auto-applies. No manual intervention.
