# LADR-026 — Postgres als enige read-store voor webapp API routes

Datum: 2026-04-24
Status: ACCEPTED

## Context

Layer2 Meta Insights ondersteunt twee databronnen voor pipeline-, kwaliteits- en
lineage-data:

1. **Databricks pull** — de originele architectuur waarbij API routes
   rechtstreeks Databricks bevragen via `DatabricksAdapter`.
2. **Push via `/api/v1/*`** — de SaaS ingest backend (LADR-025) waarbij
   Latero adapters events pushen naar Postgres.

Na de introductie van LADR-025 lezen drie van de vijf data-API routes al uit
Postgres (`/api/pipelines`, `/api/quality`, `/api/lineage`). Twee routes
bevragen Databricks nog direct:

- `GET /api/lineage/entities` → `DatabricksAdapter.getLineageEntities()`
- `GET /api/lineage/attributes` → `DatabricksAdapter.getLineageAttributes()`

Dit creëert een inconsistente architectuur: afhankelijk van de route lees je
uit een andere bron, met aparte foutafhandeling en fallback-logica.

Daarnaast werkt de Databricks pull-connector alleen als de verbinding actief
is. Voor SaaS-deployments zonder Databricks-toegang (push-only mode) moeten
alle routes uit Postgres kunnen lezen.

## Beslissing

**Postgres is de enige read-store voor alle webapp API routes.**

Databricks-data bereikt Postgres via één van twee paden:

```
Databricks (pull)  ──┐
                      ├──► Postgres ──► API routes ──► Webapp
Push via /api/v1/* ──┘
```

Concreet:

1. **Sync-mechanisme** (`src/lib/databricks-sync.ts`) haalt data op via de
   bestaande `DatabricksAdapter` en upsert die in Postgres. De sync wordt
   getriggerd via `POST /api/sync/databricks`.

2. **Entities en attributen** worden afgeleid uit de `data_lineage`-tabel
   in Postgres. De afleiding is approximatief: entiteiten hebben geen
   pre-computed status of upstream/downstream-topologie. Dit is aanvaardbaar
   voor de huidige product-fase; een aparte `lineage_entities` Postgres-tabel
   met volledige topologie is een toekomstig verbeterpunt.

3. **`DatabricksAdapter`** blijft beschikbaar voor de Databricks pull-sync
   en de cache-refresh (`/api/cache/refresh`). Hij wordt niet meer aangeroepen
   vanuit `/api/lineage/entities` of `/api/lineage/attributes`.

## Consequenties

- Alle webapp API routes hebben een werkende Postgres-verbinding nodig.
- De lineage entities/attributes in de webapp zijn altijd afkomstig uit de
  meest recente Postgres-data, ongeacht de Databricks-verbindingsstatus.
- Synced Databricks-records krijgen `installation_id = 'databricks-sync'`.
  Dit onderscheidt ze van push-ingested records en maakt cleanup mogelijk.
- De entities/attributes zijn afgeleid (geen pre-computed view). Velden als
  `latest_status`, `upstream_entity_fqns`, `downstream_entity_fqns` zijn
  altijd `UNKNOWN` / `[]` voor gesyncde records.
- Toekomstige verbetering: voeg unieke constraints toe aan Postgres-tabellen
  zodat echte UPSERT-semantiek mogelijk wordt. Huidig sync-mechanisme gebruikt
  DELETE + INSERT binnen het geselecteerde datumbereik.

## Alternatieven overwogen

- **Aparte `lineage_entities_pg` tabel**: complexer schema-beheer, niet
  nodig voor de huidige use case.
- **Beide bronnen parallel bevragen en mergen**: verhoogt complexiteit en
  onderhoudsdruk voor marginale meerwaarde.
- **Databricks als primaire bron houden voor entities/attributes**: breekt het
  principe dat API routes geen externe systemen direct bevragen.
