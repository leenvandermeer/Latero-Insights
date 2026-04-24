# Latero — Configuratiemodel

## Doel

Latero moet configureerbaar zijn als product, niet slechts importeerbaar als code in één consumer-repository. Dit document definieert de product-owned configuratiegrens waarop Latero runtime-componenten mogen vertrouwen, en de migratiegrenzen waar consumer-specifieke config-vertaling moet leven.

**De kernregel:** `latero.framework` en `latero.adapters.*` mogen uitsluitend vertrouwen op een gevalideerd Latero runtime contract. Ze mogen geen ruwe consumer repository-config direct lezen.

---

## Eigendomsgrens

| Domein | Eigenaar | Voorbeelden |
| --- | --- | --- |
| Product schema-versioning | Latero | `config_schema_version` |
| Installatie-identiteit | Latero | `installation_id` |
| Geïnstalleerde editie/modules | Latero | `edition`, `modules` |
| Platform adapter profiles | Latero | adapter type, tabeladressen, bootstrap target |
| Managed policy bundles | Latero | standaard defaults, protected controls |
| Effective-policy resolutieregels | Latero | precedentie, hard-fail bij ontbrekende policy |
| Dataset-businessbetekenis | Consumer | domeinnamen, leverancierslogica, transformatieregels |
| Dataset contracts | Consumer | bronschema, nullable-regels, contractbestandslocaties |
| Repository-layout | Consumer | `config/`, notebookpaden, dbt-mapstructuur |
| Legacy repository bridge | Consumer integration layer | vertaling van repository-config naar Latero runtime contract |

---

## Canoniek productconfiguratiebestand

Latero bezit één canoniek rootdocument:

```yaml
config_schema_version: "1"
installation:
  installation_id: "esg-dev-free"
  environment: "dev"
  edition: "core"
  modules:
    - "policy-engine"
    - "databricks-adapter"

adapter_profiles:
  default: "databricks_main"
  profiles:
    databricks_main:
      adapter: "databricks"
      bootstrap_target:
        catalog: "workspace"
        schema: "meta"
      tables:
        pipeline_runs: "workspace.meta.pipeline_runs"
        data_quality_checks: "workspace.meta.data_quality_checks"
        data_lineage: "workspace.meta.data_lineage"
    snowflake_main:
      adapter: "snowflake"
      bootstrap_target:
        database: "LATERO"
        schema: "META"
      tables:
        pipeline_runs: "LATERO.META.PIPELINE_RUNS"
        data_quality_checks: "LATERO.META.DATA_QUALITY_CHECKS"
        data_lineage: "LATERO.META.DATA_LINEAGE"

policy:
  bundle: "latero.core.v1"
  overlays:
    datasets:
      cbsenergie:
        steps:
          landing_to_raw:
            metadata_directory_pattern:
              severity: "high"
              mode: "observe"

runtime:
  steps:
    raw_to_bronze:
      adapter_profile: "databricks_main"
      scope_contract:
        time_interval: "yearly"
        required_scope:
          - "reporting_year"
          - "dataset_version"
```

---

## Runtime contract

Na validatie consumeert Latero runtime een resolved contract met stabiele velden. Het minimale resolved runtime contract bevat:

- `config_schema_version`
- `installation_id`
- `adapter_profiles`
- `effective_policy`
- `runtime_steps`

`installation_id` is een Latero-owned veld. Het stroomt vanuit de consumer config via de config bridge naar `runtime_config["installation_id"]`, en vandaar naar `create_event_logger()`, die het doorgeeft aan de adapter-constructor. Elke rij die naar een meta-tabel wordt geschreven bevat deze waarde.

```python
LateroRuntimeConfig = {
    "config_schema_version": "1",
    "installation_id": "esg-dev-free",
    "adapter_profiles": {
        "databricks_main": {
            "adapter": "databricks",
            "tables": {
                "pipeline_runs": "workspace.meta.pipeline_runs",
                "data_quality_checks": "workspace.meta.data_quality_checks",
                "data_lineage": "workspace.meta.data_lineage",
            },
        },
    },
    "effective_policy": {
        "landing_to_raw": {
            "metadata_directory_pattern": {"severity": "high", "mode": "observe"},
        },
        "raw_to_bronze": {
            "raw_checksum": {"severity": "high", "mode": "enforce"},
        },
    },
    "runtime_steps": {
        "raw_to_bronze": {
            "adapter_profile": "databricks_main",
        },
    },
}
```

---

## check_policy structuur

Check policy is een geneste structuur: `step → check_id → {severity, mode}`.

```yaml
check_policy:
  landing_to_raw:
    landing_files_present:
      severity: high
      mode: enforce
    raw_checksum:
      severity: high
      mode: enforce
    duplicate_hash:
      severity: low
      mode: observe
  raw_to_bronze:
    contract_compliance:
      severity: high
      mode: enforce
    rowcount_reconciliation:
      severity: high
      mode: enforce
```

**Precedentievolgorde (hoog naar laag):**

1. Product-managed base bundle
2. Editie/module defaults
3. Omgevingsoverlays
4. Dataset-scoped overlays
5. Consumer-approved overrides

Later gedefinieerde lagen overschrijven eerdere lagen voor hetzelfde `step.check_id`. Een ontbrekende `step.check_id` in de resolved effective policy is een harde fout — geen stille default.

---

## Adapter profiles

Adapter profiles bevatten uitsluitend runtime-relevante adapter-configuratie:

- adapter-identiteit (`adapter: "databricks"`)
- bootstrap target (catalog, schema)
- metadata-tabeladressen (drie fully qualified namen)

Ze zijn geen algemene deployment- of infrastructuurcontainer. Operationele settings horen alleen in het product-contract als Latero runtime ze direct nodig heeft.

---

## De consumer bridge

`lib/config_bridge.py` is de huidige ESG-specifieke brug die de repository-config (`config/datasets.yml`) vertaalt naar het Latero runtime contract. Dit is een tijdelijke migratielaag die buiten `latero/` leeft.

**Toegestaan:**

- `lib.config_bridge.build_runtime_config(repository_config)`
- notebook/bootstrap-code die de bridge aanroept vóór Latero

**Niet toegestaan:**

- `latero.framework.register_dq_check(..., repository_config=...)` als langetermijn-publiek contract
- helpers binnen `latero/` die de consumer repository-layout aannemen

---

## Officiële integratiereeks

```text
1. build_runtime_config(...)
2. validate_runtime_config(...)
3. resolve_effective_policy(...)
4. create_event_logger(...)
```

Consumer-specifieke legacy-bridging mag plaatsvinden vóór stap 1, maar niet binnen `latero.framework` of `latero.adapters.*`.

---

## Zie ook

- [Architectuur](architectuur.md) — framework kern, adapter contract
- [Aan de slag](../implementatie/aan-de-slag.md) — integratie-instructies
