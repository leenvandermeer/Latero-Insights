# Latero Control V2 — Product Design

**Versie:** 2.0-draft  
**Datum:** 2026-05-04  
**Auteur:** Leen van der Meer  
**Status:** DRAFT — ter review

---

## 1. Probleemanalyse V1

### 1.1 Fundamentele modelspanning

Databricks data-engineering pipelines kennen twee structureel verschillende lagen:

**Dataset-gedreven lagen (landing, raw, bronze)**
- Eén bronbestand of bron-API levert één dataset op
- Naamgeving volgt de bron: `cbs_arbeid`, `hr_employees`
- De relatie bron → dataset is 1:1

**Entiteit-gedreven lagen (silver, gold)**
- Eén bronze dataset wordt opgesplitst in N gespecialiseerde entiteiten
- De relatie bronze → silver is 1:N
- Voorbeeld: `bronze::cbs_arbeid` → `silver::cbs_arbeid_transactions` + `silver::cbs_arbeid_persons`

V1 modelleert alles als "datasets met een laag-label" (LADR-058). Dit werkt voor
de lineage-graph, maar beantwoordt niet de operationele vragen:

> "Wat is de status van cbs_arbeid als geheel, door alle lagen heen?"  
> "Welke DQ checks hoorden bij de run die de bronze tabel heeft aangemaakt?"  
> "Als silver::cbs_arbeid_transactions faalt, wat is de upstream oorzaak?"

### 1.2 UX-problemen

| Probleem | Impact |
|----------|--------|
| Geen run-detailpagina | Operationele debugging vereist meerdere pagina's combineren |
| Geen entity cross-layer view | Status per entiteit is niet zichtbaar in één scherm |
| Home is lege dashboard | Nieuwe gebruikers weten niet waar te beginnen |
| Pipelines ≠ Datasets koppeling | Runs en datasets zijn losstaande concepten in de UI |
| OpenLineage als aparte pagina | Technisch export-formaat gepresenteerd als navigatie-bestemming |
| Geen impact analyse | "Wat is er downstream van deze entiteit?" is niet beantwoordbaar |
| DQ checks zonder run-context | Checks zichtbaar op eigen pagina maar niet naast de run die ze voortbracht |

### 1.3 Data die beschikbaar maar niet benut is

Het `meta.*` schema bevat rijkere data dan de UI toont:

- `meta.run_io` — welke datasets een run heeft gelezen en geschreven (nooit getoond)
- `meta.runs.parent_run_id` — orchestrator-hiërarchie (nooit getoond)
- `meta.lineage_edges.observation_count` — hoe betrouwbaar een edge is (nooit getoond)
- `meta.lineage_edges.last_observed_run` — welke run een edge heeft bevestigd (nooit getoond)
- `meta.lineage_columns.transformation_type` — kolom-transformatie semantiek (getoond in OL export, niet in graph)
- `meta.jobs` — job-definities (nooit bevraagd door de webapp)

---

## 2. V2 Visie

**Latero Control V2** is een **data observability platform** dat data-engineering
teams helpt begrijpen wat er in hun pipelines gebeurt, op drie niveaus:

| Niveau | Vraag | Concept |
|--------|-------|---------|
| **Estate** | Hoe gezond is mijn data-landschap? | Data Product + Health Score |
| **Entity** | Wat is de status van entiteit X door alle lagen? | Entity cross-layer view |
| **Run** | Wat is er in deze uitvoering precies gebeurd? | Run Detail + I/O + DQ |

### 2.1 Kernprincipes

1. **Run als anchor**: Elke status, elke DQ check, elke lineage edge is herleidbaar
   naar een specifieke run. De run is de eenheid van uitvoering.

2. **Drie-laags hiërarchie**: Data Product → Entity → Dataset.
   Status-vragen zijn beantwoordbaar op elk niveau.

3. **Drill-down, niet jump**: Navigatie verloopt via contextbehoudende drill-down.
   Van run-overzicht naar run-detail naar entity-detail naar lineage.

4. **OpenLineage as a standard**: Ingest en export volgen de OpenLineage spec.
   Latero Control is interoperabel met het OL-ecosysteem.

5. **Health first**: De homepage toont direct de gezondheid van de data-estate,
   zonder configuratie.

---

## 3. Data Model V2

### 3.1 Hiërarchie

```
meta.data_products          — logische groepering van entiteiten
    │
    └── meta.entities       — logisch concept, laag-onafhankelijk
              │
              └── meta.datasets  — fysiek artifact per laag (bestaand, LADR-058)
                      │
                      ├── meta.runs          — uitvoeringen
                      ├── meta.run_io        — I/O per run
                      ├── meta.quality_rules — check-definities
                      └── meta.quality_results — check-resultaten per run
```

### 3.2 Nieuwe tabellen

```sql
-- Data Products
CREATE TABLE meta.data_products (
    data_product_id   TEXT PRIMARY KEY,        -- bijv. "cbs_arbeid"
    display_name      TEXT NOT NULL,
    description       TEXT,
    owner             TEXT,
    domain            TEXT,
    tags              JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Entities (was computed, nu persistent)
CREATE TABLE meta.entities (
    entity_id         TEXT PRIMARY KEY,        -- bare FQN, bijv. "cbs_arbeid_transactions"
    data_product_id   TEXT REFERENCES meta.data_products,
    display_name      TEXT,
    description       TEXT,
    source_system     TEXT,
    owner             TEXT,
    tags              JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- FK van datasets naar entities
ALTER TABLE meta.datasets
    ADD COLUMN entity_id TEXT REFERENCES meta.entities(entity_id);

-- Ruwe facet-opslag voor OpenLineage compliance
ALTER TABLE meta.runs     ADD COLUMN run_facets     JSONB;
ALTER TABLE meta.datasets ADD COLUMN dataset_facets JSONB;
```

### 3.3 Status-aggregatie

**Dataset-status**: Laatste run-status voor `dataset_id`.

**Entity-status** (cross-layer aggregaat):
```
FAILED   → als één of meer lagen FAILED zijn
WARNING  → als één of meer lagen WARNING zijn (en geen FAILED)
SUCCESS  → als alle lagen met bekende runs SUCCESS zijn
UNKNOWN  → als er geen runs zijn voor één of meer verwachte lagen
```

**Data Product-status**: Aggregaat van alle entiteiten (zelfde logica, één niveau hoger).

**DQ pass rate**: Percentage SUCCESS checks in de afgelopen N dagen
(configureerbaar, default 7 dagen), per dataset of entiteit.

---

## 4. UX Model V2

### 4.1 Navigatiestructuur

```
/                           → Health Overview
/runs                       → Run Explorer
/runs/[run_id]              → Run Detail
/catalog                    → Data Product Catalog
/catalog/[product_id]       → Data Product Detail
/entities                   → Entity Registry
/entities/[fqn]             → Entity Detail (cross-layer)
/entities/[fqn]/quality     → Entity DQ History
/entities/[fqn]/lineage     → Entity Lineage Subgraph
/lineage                    → Globale Lineage Graph
/quality                    → DQ Check Explorer
/dashboards                 → Custom Dashboards
/dashboards/[id]            → Specifiek Dashboard
```

### 4.2 Schermontwerpen (wireframe-niveau)

#### Health Overview (`/`)

```
┌─────────────────────────────────────────────────────────────────┐
│ Latero Control                            Last sync: 2m ago      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ESTATE HEALTH                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ 12       │  │ 3        │  │ 47       │  │ 94%      │       │
│  │ Data     │  │ ⚠ Issues │  │ Entities │  │ DQ Pass  │       │
│  │ Products │  │          │  │          │  │ Rate     │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                  │
│  DATA PRODUCTS                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ● CBS Arbeid          HR        ✓ 4/4 entities   8m ago │   │
│  │ ⚠ Klantprofiel        Finance   ⚠ 1/3 entities   2h ago │   │
│  │ ● Finance Rapportage  Finance   ✓ 2/2 entities  12m ago │   │
│  │ ✗ HR Medewerkers      HR        ✗ 1/2 entities  45m ago │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  RECENT ACTIVITY                    OPEN ISSUES                  │
│  ┌────────────────────────┐  ┌─────────────────────────────┐   │
│  │ ✓ cbs_arbeid.bronze  8m│  │ ✗ row_count_check  HIGH     │   │
│  │ ✓ cbs_arbeid.silver 10m│  │   hr_employees::silver      │   │
│  │ ✗ hr_employees.silver  │  │   Run: 2026-05-04-hr-003    │   │
│  │   45m ago  • FAILED    │  │                             │   │
│  │ ✓ finance_q1.gold  52m │  │ ⚠ freshness_check  MEDIUM  │   │
│  └────────────────────────┘  └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### Run Explorer (`/runs`)

```
┌─────────────────────────────────────────────────────────────────┐
│ Run Explorer                                                     │
│ [Datum: 2026-05-04] [Status: Alle▼] [Product: Alle▼] [Zoek...]│
├─────────────────────────────────────────────────────────────────┤
│ Vandaag — 14 runs (12 ✓, 1 ⚠, 1 ✗)                           │
│                                                                  │
│ 08:12  ✓  cbs_arbeid.bronze_transform    34s   2 in / 1 out    │
│ 08:08  ✓  cbs_arbeid.raw_ingest          12s   1 in / 1 out    │
│ 07:45  ✗  hr_employees.silver_transform  FAILED  —             │
│           └─ Klik voor details →                                │
│ 07:30  ✓  hr_employees.bronze_transform  28s   1 in / 1 out    │
│                                                                  │
│ Gisteren — 18 runs (18 ✓, 0 ⚠, 0 ✗)                          │
│ ...                                                              │
└─────────────────────────────────────────────────────────────────┘
```

#### Run Detail (`/runs/[run_id]`)

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Runs / hr_employees.silver_transform                          │
│ Run 2026-05-04-hr-003             ✗ FAILED  45m ago  • 12s     │
│ Step: silver_transform  Env: production                         │
├──────────┬──────────────┬───────────────┬─────────────────────-┤
│ I/O      │ DQ Checks    │ Lineage       │ Child Runs           │
├──────────┴──────────────┴───────────────┴─────────────────────-┤
│                                                                  │
│ [I/O TAB ACTIEF]                                                │
│                                                                  │
│ INPUT                                                            │
│ ┌──────────────────────────────────────────────────────┐       │
│ │ bronze::hr_employees    ✓ SUCCESS  08:02  2.1M rows  │       │
│ └──────────────────────────────────────────────────────┘       │
│                                                                  │
│ OUTPUT                                                           │
│ ┌──────────────────────────────────────────────────────┐       │
│ │ silver::hr_employees    ✗ FAILED   —    0 rows       │       │
│ │  [→ Bekijk entiteit]                                 │       │
│ └──────────────────────────────────────────────────────┘       │
│                                                                  │
│ DQ CHECKS (3 uitgevoerd)                                         │
│ ┌───────────────────────────────────────────────────────┐      │
│ │ ✗ row_count > 0         HIGH    completeness  FAILED  │      │
│ │   Verwacht: > 0  Gemeten: 0                           │      │
│ │ ✓ schema_check          MEDIUM  schema        SUCCESS │      │
│ │ ✓ freshness_check       LOW     freshness     SUCCESS │      │
│ └───────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

#### Entity Detail (`/entities/[fqn]`)

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Entities / hr_employees                                        │
│ HR Employees              [CBS Arbeid] [HR] ⚠ DEGRADED          │
│ Bron: HR systeem  Owner: team-hr                                 │
├──────────────────────────────────────────────────────────────────┤
│ LAYER STATUS                                                     │
│ ┌──────────┬───────────────────────┬──────────┬────────┬──────┐ │
│ │ Laag     │ Dataset               │ Laatste  │ Status │  DQ  │ │
│ ├──────────┼───────────────────────┼──────────┼────────┼──────┤ │
│ │ landing  │ file://hr_data.csv    │ 08:01    │ ✓      │ —   │ │
│ │ raw      │ raw::hr_employees     │ 08:02    │ ✓      │ 100% │ │
│ │ bronze   │ bronze::hr_employees  │ 08:05    │ ✓      │ 98%  │ │
│ │ silver   │ silver::hr_employees  │ 07:45    │ ✗ FAIL │ 33%  │ │
│ │ gold     │ gold::hr_employees    │ Gisteren │ ✓      │ 100% │ │
│ └──────────┴───────────────────────┴──────────┴────────┴──────┘ │
│                                                                  │
│ [Recente Runs]  [DQ Samenvatting]  [Bekijk Lineage →]           │
│                                                                  │
│ RECENTE RUNS                                                     │
│  ✗ 2026-05-04 07:45  silver_transform  FAILED       →           │
│  ✓ 2026-05-03 08:12  silver_transform  SUCCESS  28s →           │
│  ✓ 2026-05-02 08:05  silver_transform  SUCCESS  31s →           │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Lineage Graph V2

De huidige lineage graph (React Flow, layer-columns) wordt uitgebreid met:

**Run-triggered highlighting:**
- Selecteer een run → highlight edges die in die run zijn bevestigd
- Niet-gerakte edges worden gedimd

**Impact analysis:**
- Klik op een entiteit → "Impact" knop
- Toont downstream subgraph: alle entiteiten die afhankelijk zijn van dit node
- Kleurcodering op basis van status

**Column lineage toggle:**
- Klik op een edge → toon de kolom-flows (IDENTITY, AGGREGATION, DERIVED, etc.)
- Visueel als sub-edges of als paneel naast de graph

**Data product filtering:**
- Filter op data product (bestaand dataset-focus, uitgebreid)
- Toont alle entiteiten van een data product met hun onderlinge verbindingen

**Export:**
- Download als OpenLineage JSON (vervangt `/openlineage` route)
- Knoppen: [Export OL JSON] [Export PNG]

---

## 5. API Oppervlak V2

### 5.1 Nieuwe endpoints

| Method | Route | Doel |
|--------|-------|------|
| `POST` | `/api/v1/events` | OpenLineage RunEvent ingest (primair) |
| `GET` | `/api/runs/:run_id` | Run detail met I/O, DQ, lineage |
| `GET` | `/api/data-products` | Lijst van alle data products |
| `GET` | `/api/data-products/:id` | Data product met entiteiten en health |
| `GET` | `/api/entities` | Lijst van alle entiteiten |
| `GET` | `/api/entities/:fqn` | Entity detail met cross-layer status |
| `GET` | `/api/entities/:fqn/runs` | Run-geschiedenis per entiteit |
| `GET` | `/api/entities/:fqn/quality` | DQ check-geschiedenis per entiteit |
| `GET` | `/api/entities/:fqn/lineage` | Lineage subgraph voor entiteit |
| `GET` | `/api/health/estate` | Geaggregeerde estate health score |

### 5.2 Bestaande endpoints (ongewijzigd of uitgebreid)

| Route | Wijziging |
|-------|-----------|
| `GET /api/pipelines` | Filter uitgebreid met `job_id`, `step`, `product_id` |
| `GET /api/quality` | Filter uitgebreid met `run_id`, `entity_fqn` |
| `GET /api/lineage` | Ongewijzigd |
| `GET /api/lineage/entities` | Query op `meta.entities` i.p.v. computed |
| `GET /api/lineage/attributes` | Ongewijzigd |
| `POST /api/v1/pipeline-runs` | DEPRECATED (blijft werken tot V2 GA + 6m) |
| `POST /api/v1/dq-checks` | DEPRECATED (blijft werken tot V2 GA + 6m) |
| `POST /api/v1/lineage` | DEPRECATED (blijft werken tot V2 GA + 6m) |

---

## 6. Adoptie van Open Standaarden

### 6.1 OpenLineage (primair)

- Ingest via OpenLineage RunEvent formaat (LADR-062)
- Facets: Schema, ColumnLineage, DataQualityAssertions, Ownership, NominalTime, ParentRun
- Export: volledig OL-conforme JSON download

### 6.2 Marquez API compatibiliteit (optioneel)

Latero Control implementeert de Marquez REST API voor tools die Marquez als
backend verwachten:

```
GET  /api/v1/namespaces
GET  /api/v1/namespaces/{namespace}/jobs
GET  /api/v1/namespaces/{namespace}/datasets
POST /api/v1/lineage
```

### 6.3 DataHub / Atlan export (toekomst)

Via een adapter-laag die de `meta.*` data vertaalt naar het respectievelijke
catalogus-formaat. Dit valt buiten V2 scope maar de data is beschikbaar.

---

## 7. Migratie van V1 naar V2

### 7.1 Geen breaking changes aan de ingest-kant

- Legacy endpoints blijven werken (deprecated, niet verwijderd)
- Bestaande Latero MDCF adapters werken ongewijzigd in V2
- Na V2 GA: 6 maanden deprecatie-periode, daarna sunset

### 7.2 Database migratie

Additive changes only (geen DROP, geen schema-breaks):

```sql
-- Stap 1: Nieuwe tabellen aanmaken
CREATE TABLE meta.data_products (...);
CREATE TABLE meta.entities (...);

-- Stap 2: FK toevoegen aan datasets
ALTER TABLE meta.datasets ADD COLUMN entity_id TEXT REFERENCES meta.entities;

-- Stap 3: Bootstrap-data invullen
INSERT INTO meta.entities SELECT DISTINCT split_part(dataset_id,'::',1), ... FROM meta.datasets;

-- Stap 4: Nieuwe kolommen voor facet-opslag
ALTER TABLE meta.runs     ADD COLUMN run_facets     JSONB;
ALTER TABLE meta.datasets ADD COLUMN dataset_facets JSONB;
```

### 7.3 URL redirects

```
/pipelines     → /runs          (301)
/datasets      → /entities      (301)
/dashboard     → /dashboards    (301)
/openlineage   → /lineage       (301)
```

### 7.4 Widget system

Bestaande custom widgets en system overrides blijven werken.
Nieuwe system-dashboards (`system:overview`, `system:catalog`) worden
beschikbaar als template naast de bestaande.

---

## 8. Niet in scope voor V2

- DataMesh data contracts en self-serve infrastructure
- Real-time streaming events (V1 is batch-ingest)
- Multi-tenant lineage federation (installaties zien elkaars lineage niet)
- Schema registry (toekomstig, via SchemaFacet data)
- Automatische DQ regel-generatie
- ML feature store integratie
