# LADR-070 — Environment-ID mismatch: latero.yml environment vs Control databricksEnvironment

**Datum:** 2026-05-10  
**Status:** ACCEPTED  

---

## Context

Na het uitvoeren van Databricks-jobs bleef de sync in Latero Control 0 rijen teruggeven
(`"Sync complete — no new records found"`). De jobs draaiden succesvol, data stond in de
Databricks meta-tabellen, maar Control importeerde niets.

### Root cause

Twee configuratiewaarden moeten overeenkomen maar lagen uit sync:

| Configuratiebestand | Sleutel | Waarde (fout) | Waarde (correct) |
|---|---|---|---|
| `latero.yml` (MDCF) | `environment` | `"dev-free"` | `"prod"` |
| `settings.json` (Control) | `databricksEnvironment` | `"dev-free"` | `"prod"` |

**Hoe de filter werkt:**  
`DatabricksAdapter.resolveEnvironmentScope()` leest `settings.databricksEnvironment` en voegt
`AND environment = '<waarde>'` toe aan alle Databricks-queries. MDCF schrijft de waarde uit
`latero.yml → environment` naar de `environment` kolom in elke meta-tabel. Als beide niet
overeenkomen, vinden er geen rijen de filter en retourneert de sync 0 records.

**Bijkomend gevolg:**  
De `lineage_projector` job materialiseert entity FQNs als
`concat(environment, '.', dataset_id, '.', target_entity)`. Met `environment = "dev-free"`
ontstonden FQNs als `dev-free.dataset_x.entity_y`, die onherkenbaar zijn voor een Control
installatie die filtert op `"prod"`.

### Waarom dit zo lang onopgemerkt bleef

- De sync gaf geen foutmelding — 0 rijen is een geldige uitkomst bij een lege date range.
- De foutmelding was generiek: `"no new records found"`.
- `installation_id` in `latero.yml` (`"esg-dev-free"`) en de installatie-IDs in Control
  (`local_dev`, `prod_ko5o09uj9`) zijn conceptueel gescheiden en hoeven **niet** overeen te
  komen. Verwarring hierover leidde tot zoeken op de verkeerde plek.

---

## Beslissing

### 1. `latero.yml` (MDCF repo)

```yaml
# voor
installation_id: "esg-dev-free"
environment: "dev-free"

# na
installation_id: "esg-prod"
environment: "prod"
```

### 2. `settings.json` (Latero Control, alle Databricks-mode installaties)

`databricksEnvironment` gewijzigd van `"dev-free"` naar `"prod"` voor:
- `prod_ko5o09uj9`
- `sso-test-acme`
- `local_dev`
- root-level defaults

### 3. Sync-diagnostics toegevoegd (eerder in deze sessie)

De sync-response bevat nu:
```json
{
  "diagnostics": {
    "environment_filter": "prod",
    "date_range": { "from": "...", "to": "..." },
    "rows_from_databricks": { "runs": 0, "dq_checks": 0, "lineage": 0, "column_lineage": 0 }
  }
}
```
De Settings-UI toont bij 0 records de actieve environment-filter en date range, zodat een
toekomstige mismatch direct zichtbaar is.

### 4. Herstelprocedure na fix

1. `latero.yml` gecommit en gepusht naar GitHub
2. `databricks bundle deploy` uitgevoerd — deployment complete
3. `lineage_projector` job getriggerd — SUCCESS (entity FQNs herschreven naar `prod.*`)
4. Productie `settings.json` bijgewerkt via Control Settings UI (`databricksEnvironment → prod`)
5. Nieuwe sync getriggerd om correcte data in te lezen

---

## Gevolgen

- **Positief:** Sync importeert nu correct alle runs, DQ-checks en lineage-hops met
  `environment = "prod"`.
- **Positief:** Entity FQNs in `lineage_entities_current` zijn nu `prod.dataset.entity`,
  herkenbaar voor Control.
- **Let op:** Historische rijen in `meta.pipeline_runs`, `meta.dq_results` en
  `meta.lineage_edges` die geschreven zijn tijdens de `dev-free` periode hebben
  `installation_id` gelijk aan de Control-sessie-installatie (niet aan MDCF's
  `installation_id`). De data is correct bewaard; alleen de herkomst-label in MDCF verschilde.

---

## Invariant voor operators

> `latero.yml → environment` **moet** gelijk zijn aan `settings.json → databricksEnvironment`
> van de bijbehorende Control-installatie.  
> Dit is de enige runtime-koppeling tussen MDCF en Latero Control.

Documenteer deze eis ook in de operator-handleiding bij nieuwe installaties.
