# LADR-062 — V2: OpenLineage Event Model als primair ingest-formaat

| Eigenschap | Waarde |
|-----------|--------|
| ID | LADR-062 |
| Datum | 2026-05-04 |
| Status | PROPOSED |
| Auteur | Leen van der Meer |
| Gerelateerd | LADR-040, LADR-025, LADR-058 |

---

## Context

Het huidige ingest-formaat (LADR-025) is een eigen JSON-schema per
endpoint-type:

```
POST /api/v1/pipeline-runs   — eigen schema
POST /api/v1/dq-checks       — eigen schema
POST /api/v1/lineage         — eigen schema
```

Het meta.* schema (LADR-040) is geïnspireerd door OpenLineage maar is niet
formeel compliant. Specifiek:

- **Namespace/name notatie**: OpenLineage gebruikt `{namespace}/{name}` als
  dataset-identifier. Het huidige systeem gebruikt `{entity}::{layer}` als
  compound key.
- **Facet-systeem**: OpenLineage definieert datasets en runs via uitbreidbare
  "facets" (SchemaFacet, DataQualityAssertionsFacet, ColumnLineageFacet, etc.).
  Het huidige systeem heeft vaste kolommen zonder facet-extensibiliteit.
- **Event types**: OpenLineage definieert START, COMPLETE, FAIL, ABORT events
  per run. Het huidige systeem accepteert één status per ingest-aanroep.
- **Job-concept**: OpenLineage modelleert jobs als `{namespace}/{name}` tuples.
  Het huidige systeem heeft een impliciete job per run.

### Waarom OpenLineage als standaard

OpenLineage is de de-facto open standaard voor lineage-data, gedragen door de
Linux Foundation. Voordelen van volledige compliance:

1. **Interoperabiliteit**: Adapters geschreven voor andere OpenLineage-compatible
   tools (Marquez, DataHub, Atlan, OpenMetadata) werken direct met Latero Control.
2. **Ecosysteem**: Apache Airflow, dbt, Spark, Flink hebben native OpenLineage emitters.
   Compliance geeft toegang tot dit ecosysteem zonder custom adapters.
3. **Standaardisatie**: Klanten hoeven geen Latero-specifiek formaat te implementeren.
4. **Toekomstbestendigheid**: De standaard evolueert via een open governance proces.

### Huidige /openlineage route

De huidige `/openlineage` pagina en `/api/lineage` export is een *output*
adapter: het vertaalt het interne formaat naar OpenLineage. Het is geen *input*
in OpenLineage formaat. V2 draait dit om: OpenLineage is primair de ingest-kant.

---

## Decision

**Adopteer het OpenLineage Event Model als het primaire ingest-formaat voor V2.**

### OpenLineage Event Model

Een OpenLineage RunEvent heeft de volgende structuur:

```json
{
  "eventType": "COMPLETE",
  "eventTime": "2026-05-04T08:00:00Z",
  "run": {
    "runId": "550e8400-e29b-41d4-a716-446655440000",
    "facets": {
      "parent": { ... },
      "nominalTime": { "nominalStartTime": "...", "nominalEndTime": "..." }
    }
  },
  "job": {
    "namespace": "latero://production",
    "name": "cbs_arbeid.bronze_transform",
    "facets": {
      "ownership": { "owners": [{ "name": "team-hr", "type": "team" }] }
    }
  },
  "inputs": [
    {
      "namespace": "latero://production",
      "name": "raw.cbs_arbeid",
      "facets": {
        "schema": { "fields": [...] },
        "dataQualityAssertions": {
          "assertions": [
            { "assertion": "row_count > 0", "success": true }
          ]
        }
      }
    }
  ],
  "outputs": [
    {
      "namespace": "latero://production",
      "name": "bronze.cbs_arbeid",
      "facets": {
        "schema": { "fields": [...] },
        "columnLineage": {
          "fields": {
            "id": { "inputFields": [{ "namespace": "...", "name": "raw.cbs_arbeid", "field": "id", "transformationType": "IDENTITY" }] }
          }
        }
      }
    }
  ]
}
```

### Nieuwe ingest endpoint

```
POST /api/v1/events
Content-Type: application/json
Authorization: Bearer <token>
```

Accepteert:
- Enkelvoudig `RunEvent` object
- Array van `RunEvent` objecten (batch)
- Content-Type: `application/json` (standaard OL media type)

**Interne verwerking:**

```
RunEvent → parse → validate → normalize → persist

COMPLETE/FAIL event → INSERT INTO meta.runs (status = SUCCESS|FAILED)
inputs[]           → INSERT INTO meta.run_io (role = INPUT)
                   + INSERT INTO meta.lineage_edges (source → target)
outputs[]          → INSERT INTO meta.run_io (role = OUTPUT)
dataQualityAssertions facet → INSERT INTO meta.quality_results
columnLineage facet → INSERT INTO meta.lineage_columns
schema facet        → INSERT INTO meta.datasets (column metadata)
ownership facet     → INSERT INTO meta.entities (owner)
```

### Namespace → dataset_id mapping

OpenLineage namespace/name wordt omgezet naar het interne dataset_id:

```
{namespace}/{name} → {layer}::{entity_name}

Regels:
1. Extraheer layer uit de name (eerste segment als het een laagkeyword is)
2. Normaliseer namespace naar installation_id via registry
3. Fallback: gebruik name als entity_id, layer = "unknown"
```

Voorbeeld:
```
namespace: "latero://production"
name:      "bronze.cbs_arbeid"
→ dataset_id: "cbs_arbeid::bronze"
```

### Ondersteunde facets (V2 scope)

| Facet | Bron | Doel |
|-------|------|------|
| `SchemaFacet` | inputs/outputs | Schema-metadata in `meta.datasets` |
| `DataQualityAssertionsFacet` | inputs/outputs | DQ resultaten in `meta.quality_results` |
| `ColumnLineageFacet` | outputs | Kolom-lineage in `meta.lineage_columns` |
| `OwnershipFacet` | job | Owner in `meta.entities` |
| `NominalTimeFacet` | run | Geplande starttijd in `meta.runs` |
| `ParentRunFacet` | run | `parent_run_id` in `meta.runs` |
| `DocumentationFacet` | job/dataset | Beschrijving in `meta.entities`/`meta.datasets` |

Overige facets worden opgeslagen in een `facets JSONB` kolom voor
toekomstige verwerking.

### Backward compatibility: legacy endpoints

De bestaande endpoints blijven beschikbaar maar worden gemarkeerd als deprecated:

```
POST /api/v1/pipeline-runs   → DEPRECATED, redirects naar /api/v1/events intern
POST /api/v1/dq-checks       → DEPRECATED, redirects naar /api/v1/events intern
POST /api/v1/lineage         → DEPRECATED, redirects naar /api/v1/events intern
```

Sunset datum: 6 maanden na GA release van V2.

### Marquez API compatibiliteit

Optioneel: Implementeer de Marquez REST API surface voor tooling die Marquez
als backend verwacht:

```
GET  /api/v1/namespaces
GET  /api/v1/namespaces/{namespace}/jobs
GET  /api/v1/namespaces/{namespace}/datasets
POST /api/v1/lineage   (Marquez ingest endpoint - hetzelfde als OL endpoint)
```

Dit maakt Latero Control direct bruikbaar als Marquez-vervanger.

---

## OpenLineage als output (export)

De bestaande `/api/lineage` export wordt bijgewerkt naar volledig OL-conforme
output. De `/openlineage` UI-pagina wordt omgezet naar een ExportButton in
de Lineage-pagina die:

1. OpenLineage JSON (alle edges) downloadt als `.json`
2. Marquez-compatible endpoint aanroept (indien Marquez integratie actief)

---

## Gevolgen

### Positief

- Airflow, dbt, Spark kunnen direct lineage pushen via hun native OL emitters
- Externe catalogi (DataHub, Atlan) kunnen lineage consumeren via Marquez API
- Facet-systeem maakt het mogelijk om onbekende metadata op te slaan zonder schema-migraties
- DQ assertions zijn nu deel van het lineage-event, niet een apart endpoint
- Column lineage is standaard geïntegreerd in het event model

### Negatief / Risico's

- Complexere event-parser dan de huidige losse endpoints
- Namespace/name → dataset_id mapping heeft edge cases bij ongebruikelijke namen
- Bestaande Latero-adapters (Python MDCF package) moeten worden bijgewerkt
- OpenLineage spec evolueert; wijzigingen in facet-schema's vereisen aanpassing

### Database wijzigingen

Nieuwe kolom voor ruwe facet-opslag:
```sql
ALTER TABLE meta.runs ADD COLUMN run_facets JSONB;
ALTER TABLE meta.datasets ADD COLUMN dataset_facets JSONB;
```

Geen breaking changes aan bestaande kolommen.

---

## Alternatieven overwogen

**Alternatief A: Eigen formaat behouden, alleen export verbeteren**
Afgewezen. Het ecosysteem-voordeel zit primair op de ingest-kant.
Klanten met bestaande Airflow/dbt setups kunnen dan niet zonder adapter.

**Alternatief B: OTLP (OpenTelemetry) als standaard**
Overwogen voor observability (traces, metrics, logs). OTLP is complementair aan
OpenLineage maar modeleert geen data lineage. Toekomstige integratie van OTLP voor
run-metrics (latency, throughput) is mogelijk als aanvulling op OL voor lineage.

**Alternatief C: dbt artifacts formaat**
Te specifiek. dbt is één van de tools in het ecosysteem; het formaat is niet
generiek genoeg voor alle data-platforms die Latero Control moet ondersteunen.
