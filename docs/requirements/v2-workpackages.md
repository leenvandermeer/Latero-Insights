# Latero Control V2 — Werkpakketten

**Versie:** 2.0  
**Datum:** 2026-05-04  
**Auteur:** Leen van der Meer  
**Status:** COMPLETED — alle WPs geïmplementeerd (commit baf41a4)

Zie [v2-product-design.md](v2-product-design.md) voor de volledige product-context
en [docs/decisions/](../decisions/) voor de gerelateerde ADRs (LADR-059 t/m LADR-062).

---

## Volgorde en afhankelijkheden

```
WP-V2-001 (Data Model)
    │
    ├── WP-V2-002 (Run Explorer)
    │       └── WP-V2-003 (Run Detail)
    │
    ├── WP-V2-004 (Entity Registry)
    │       └── WP-V2-005 (Entity Detail)
    │
    ├── WP-V2-006 (Data Product Catalog)
    │
    └── WP-V2-007 (OpenLineage Ingest)
    
WP-V2-008 (Navigation Restructuring)   ← Afhankelijk van WP-V2-002, 004, 006
WP-V2-009 (Health Overview)            ← Afhankelijk van WP-V2-004, 006
WP-V2-010 (Lineage V2)                 ← Afhankelijk van WP-V2-003, 005
WP-V2-011 (DQ Integration)             ← Afhankelijk van WP-V2-003, 005
```

---

## WP-V2-001 — Data Model Extensions

**Omschrijving:** Implementeer de nieuwe `meta.data_products` en `meta.entities`
tabellen, de FK-uitbreiding op `meta.datasets`, en de bootstrap-logica die bestaande
datasets omzet naar entities.

**ADR:** LADR-060

**Deliverables:**
- [x] SQL migratiescript: `meta.data_products` tabel aanmaken
- [x] SQL migratiescript: `meta.entities` tabel aanmaken
- [x] SQL migratiescript: `entity_id` FK kolom toevoegen aan `meta.datasets`
- [x] SQL migratiescript: `run_facets JSONB` kolom aan `meta.runs`
- [x] SQL migratiescript: `dataset_facets JSONB` kolom aan `meta.datasets`
- [x] Bootstrap-query: vul `meta.entities` vanuit bestaande `meta.datasets`
- [x] Bootstrap-query: vul `meta.data_products` vanuit `lineage_group_id`
- [x] TypeScript types: `DataProduct`, `Entity` (in `src/types/`)
- [x] Migratie test: bestaande data blijft intact na uitvoering scripts

**Schattingen:** M (3-5 dagen)

**Risico's:**
- Bootstrap-query kan onjuiste groepering geven bij complexe lineage
- Handmatige correctie via admin nodig (fase 2 werkpakket)

---

## WP-V2-002 — Run Explorer

**Omschrijving:** Vervang de huidige `/pipelines` pagina door een volwaardige
Run Explorer met timeline-weergave, uitgebreide filters, en navigatie naar run-detail.

**ADR:** LADR-059, LADR-061

**Afhankelijk van:** WP-V2-001 (voor data product filter)

**Deliverables:**
- [x] Route: `/runs` (next.js page component)
- [x] Route: `/pipelines` → `/runs` redirect (301)
- [x] API: uitbreiding `GET /api/pipelines` met `?step=`, `?product_id=` filters
- [x] Component: `RunTimeline` — dag-gegroepeerde tijdlijn van runs
- [x] Component: `RunRow` — één rij in de tijdlijn (status, job, I/O count, duration)
- [x] Component: `RunFilters` — datum range, status, environment, step, product
- [x] Hook: `useRuns` — uitbreiding van `usePipelines` of vervanging
- [x] Paginering: cursor-based voor grote run-sets (>1000 runs/dag)
- [x] Empty state: "Geen runs gevonden voor dit filter"

**Schattingen:** M (4-6 dagen)

**UX-details:**
- Groepering: per dag, chronologisch aflopend
- Statusindicator: gekleurde dot (groen/geel/rood/grijs)
- I/O count: "2 in / 1 out" badge
- Klikbaar: hele rij navigeert naar `/runs/[run_id]`

---

## WP-V2-003 — Run Detail Pagina

**Omschrijving:** Nieuwe detailpagina voor één run, met vier tabs:
I/O Datasets, DQ Checks, Lineage Activity, Child Runs.

**ADR:** LADR-059

**Afhankelijk van:** WP-V2-001, WP-V2-002

**Deliverables:**
- [x] Route: `/runs/[run_id]`
- [x] API: `GET /api/runs/:run_id` — run detail met I/O, checks, lineage edges, children
  - Query: `meta.runs` + `meta.run_io` + `meta.quality_results` + `meta.lineage_edges` + child `meta.runs`
- [x] Component: `RunHeader` — status, metadata, duurtijd
- [x] Component: `RunIOTab` — tabel van input/output datasets met layer-badge en status
- [x] Component: `RunDQTab` — tabel van DQ checks met check_name, status, severity, result_value
- [x] Component: `RunLineageTab` — lijst van lineage edges bevestigd in deze run
- [x] Component: `RunChildrenTab` — lijst van child runs (orchestrator chains)
- [x] Cross-navigatie: vanuit RunIOTab → `/entities/[fqn]`
- [x] Cross-navigatie: vanuit RunDQTab → `/quality?run_id=[run_id]`
- [x] Breadcrumb: `Runs > [run_id]`
- [x] Hook: `useRunDetail` voor `GET /api/runs/:run_id`

**Schattingen:** L (6-8 dagen)

**Risico's:**
- `meta.run_io` is mogelijk niet gevuld door alle bestaande adapters
  → Toon lege tab met melding "Geen I/O data beschikbaar — upgrade adapter"
- Grote runs kunnen tientallen DQ checks hebben → paginering op check-tab

---

## WP-V2-004 — Entity Registry

**Omschrijving:** Vervang de huidige `/datasets` pagina door een Entity Registry
met status-overzicht, filter op data product, en navigatie naar entity-detail.

**ADR:** LADR-060, LADR-061

**Afhankelijk van:** WP-V2-001

**Deliverables:**
- [x] Route: `/entities`
- [x] Route: `/datasets` → `/entities` redirect (301)
- [x] API: `GET /api/entities` — lijst van entiteiten met geaggregeerde status
  - Query: `meta.entities JOIN meta.datasets JOIN meta.runs` (laatste status per laag)
- [x] Component: `EntityList` — tabel met entity_id, display_name, data product, status per laag, DQ pass rate
- [x] Component: `EntityStatusBadge` — kleurgecodeerde status (SUCCESS/WARNING/FAILED/UNKNOWN)
- [x] Filter: data product, status, source system
- [x] Zoekbalk: op entity_id of display_name
- [x] Kolommen: Entity, Data Product, Landing, Raw, Bronze, Silver, Gold, DQ%, Laatste run
- [x] Hook: `useEntities` voor `GET /api/entities`

**Schattingen:** M (4-5 dagen)

**UX-details:**
- Elke laag heeft een kleurgecodeerde cel in de rij
- UNKNOWN = grijs (geen runs voor die laag)
- Lege entiteiten (geen enkele run ooit) worden weergegeven maar gemarkeerd

---

## WP-V2-005 — Entity Detail Pagina

**Omschrijving:** Nieuwe detailpagina voor één entiteit, met cross-layer status,
run-geschiedenis, DQ samenvatting, en link naar entity lineage.

**ADR:** LADR-060, LADR-061

**Afhankelijk van:** WP-V2-001, WP-V2-004

**Deliverables:**
- [x] Route: `/entities/[fqn]`
- [x] Route: `/entities/[fqn]/quality`
- [x] Route: `/entities/[fqn]/lineage`
- [x] API: `GET /api/entities/:fqn` — entity detail
  - Cross-layer status tabel (één rij per laag: dataset_id, laatste run, status, DQ%)
- [x] API: `GET /api/entities/:fqn/runs` — run-geschiedenis voor deze entiteit
- [x] API: `GET /api/entities/:fqn/quality` — DQ checks voor alle lagen
- [x] API: `GET /api/entities/:fqn/lineage` — lineage subgraph voor entiteit
- [x] Component: `EntityHeader` — display_name, data product badge, health status
- [x] Component: `LayerStatusTable` — tabel met één rij per laag
- [x] Component: `EntityRunHistory` — recentste N runs voor deze entiteit (alle lagen)
- [x] Component: `EntityDQSummary` — check categorieën met trend (7-daags)
- [x] Cross-navigatie: vanuit LayerStatusTable → `/runs/[run_id]`
- [x] Cross-navigatie: "Bekijk lineage" → `/entities/[fqn]/lineage`
- [x] Breadcrumb: `Entities > [entity_fqn]`

**Schattingen:** L (7-9 dagen)

**Risico's:**
- Entity zonder runs op alle lagen → toon UNKNOWN met toelichting
- FQN bevat mogelijk speciale tekens → URL-encoding afdwingen

---

## WP-V2-006 — Data Product Catalog

**Omschrijving:** Nieuwe `/catalog` pagina met een overzicht van alle data products,
hun health score, en doorlink naar data product detail.

**ADR:** LADR-060, LADR-061

**Afhankelijk van:** WP-V2-001, WP-V2-004

**Deliverables:**
- [x] Route: `/catalog`
- [x] Route: `/catalog/[product_id]`
- [x] API: `GET /api/data-products` — lijst van data products met health scores
- [x] API: `GET /api/data-products/:id` — data product detail met entiteiten
- [x] Component: `CatalogGrid` — grid van data product cards
- [x] Component: `DataProductCard` — naam, domein, owner, health badge, entity count
- [x] Component: `DataProductDetail` — header + entiteiten-lijst
- [x] Filter: domein, owner, health status
- [x] Hook: `useDataProducts`, `useDataProduct`
- [x] Admin: basis data product beheer (naam, beschrijving, owner, domein bewerken)
  - Initieel als JSON-edit in admin interface, later als form

**Schattingen:** M (5-6 dagen)

**Risico's:**
- Auto-gedetecteerde data products kunnen onjuist zijn
- Admin-beheerfunctie voor handmatige correctie is vereist maar uitdagend in scope

---

## WP-V2-007 — OpenLineage Ingest

**Omschrijving:** Implementeer het primaire OpenLineage ingest-endpoint
(`POST /api/v1/events`) dat RunEvent objecten verwerkt en opslaat in `meta.*`.

**ADR:** LADR-062

**Afhankelijk van:** WP-V2-001

**Deliverables:**
- [x] API: `POST /api/v1/events` — OpenLineage RunEvent ingest
- [x] Parser: RunEvent → `meta.runs` INSERT/UPDATE
- [x] Parser: `inputs[]` → `meta.run_io` (role=INPUT) + `meta.lineage_edges`
- [x] Parser: `outputs[]` → `meta.run_io` (role=OUTPUT) + `meta.lineage_edges`
- [x] Facet: `SchemaFacet` → kolom-metadata in `meta.datasets`
- [x] Facet: `DataQualityAssertionsFacet` → `meta.quality_results`
- [x] Facet: `ColumnLineageFacet` → `meta.lineage_columns`
- [x] Facet: `OwnershipFacet` → `meta.entities.owner`
- [x] Facet: `ParentRunFacet` → `meta.runs.parent_run_id`
- [x] Facet: overige → opslaan in `run_facets`/`dataset_facets` JSONB kolom
- [x] Namespace mapping: `namespace/name` → `entity_id::layer` (met configureerbare regels)
- [x] Batch ingest: array van RunEvents in één request
- [x] TypeScript types: `OpenLineageRunEvent`, `JobFacets`, `DatasetFacets`, `RunFacets`
- [x] Validatie: strict JSON schema validatie met foutmeldingen
- [x] Backward compatibility: legacy endpoints blijven werken (deprecated header)

**Schattingen:** XL (10-14 dagen)

**Risico's:**
- Namespace/name → dataset_id mapping heeft edge cases → uitgebreide testcoverage vereist
- OpenLineage spec evolueert; de implementatie moet versie-agnostisch zijn voor facets
- Batch-ingest: atomiciteit (alles of niets per event) vs. partial success

---

## WP-V2-008 — Navigation Restructuring

**Omschrijving:** Herstructureer de navigatie, routes, breadcrumbs en redirects
conform de V2 navigatiestructuur (LADR-061).

**ADR:** LADR-061

**Afhankelijk van:** WP-V2-002, WP-V2-004, WP-V2-006 (routes moeten bestaan)

**Deliverables:**
- [x] Nav config: update `nav-config.ts` naar V2 structuur
- [x] Navigatiemenu: nieuwe secties OBSERVE / EXPLORE / CUSTOMIZE
- [x] Route: `/openlineage` → `/lineage` redirect (301) + verwijder pagina
- [x] Export button: `[Export OL JSON]` knop in `/lineage` pagina
- [x] Route: `/dashboard` → `/dashboards` redirect (301)
- [x] Route: `/pipelines` → `/runs` redirect (301)
- [x] Route: `/datasets` → `/entities` redirect (301)
- [x] Breadcrumb component: `Breadcrumb` met contextbehoud via URL params
- [x] Active nav-item highlighting op basis van huidige route
- [x] Mobile nav: update voor nieuwe structuur

**Schattingen:** S (2-3 dagen)

---

## WP-V2-009 — Health Overview

**Omschrijving:** Implementeer de nieuwe homepage (`/`) als een Health Overview
dashboard met estate health scores, data product kaarten, en recent activity feed.

**ADR:** LADR-061

**Afhankelijk van:** WP-V2-004, WP-V2-006

**Deliverables:**
- [x] Route: `/` → Health Overview (vervangt lege dashboard)
- [x] API: `GET /api/health/estate` — geaggregeerde health: products, entities, DQ pass rate, last sync
- [x] Component: `EstateHealthSummary` — 4 tellers (products, issues, entities, DQ%)
- [x] Component: `DataProductHealthList` — data products met kleurgecodeerde health
- [x] Component: `RecentActivityFeed` — laatste 10 runs/checks, meest recent eerst
- [x] Component: `OpenIssuesList` — open FAILED DQ checks met severity
- [x] Automatische refresh: elke 60 seconden (via TanStack Query staleTime)
- [x] "Lege estate" state: instructies voor eerste ingest

**Schattingen:** M (4-5 dagen)

---

## WP-V2-010 — Lineage Graph V2

**Omschrijving:** Uitbreiding van de bestaande lineage graph met run-triggered
highlighting, impact analysis, en column lineage toggle.

**ADR:** LADR-059, LADR-060

**Afhankelijk van:** WP-V2-003, WP-V2-005

**Deliverables:**
- [x] Run-triggered highlighting: highlight edges van geselecteerde run
  - Koppeling: `meta.lineage_edges.last_observed_run` → run selectie in UI
- [x] Impact analysis: "Toon downstream" knop per node
  - BFS downstream subgraph vanuit geselecteerde entiteit
  - Kleurcodering op basis van huidige status
- [x] Column lineage toggle: klik op edge → toon kolom-flows als sub-panel
- [x] Data product filter: uitbreiding van bestaand dataset-focus filter
- [x] Export knop: [Export OL JSON] in de lineage-toolbar
- [x] Entity detail panel: slide-in panel bij node-klik (zonder navigatie)
  - Toont: status, laatste run, DQ pass rate, [Open entiteit →] link

**Schattingen:** L (7-10 dagen)

**Risico's:**
- Impact analysis BFS kan bij grote grafen traag zijn → depth limit instellen (default: 3 hops)
- Column lineage sub-panel is visueel complex in de React Flow graph

---

## WP-V2-011 — DQ-Run Integration

**Omschrijving:** Koppel DQ checks aan runs en entiteiten in de bestaande
Quality-pagina, en zorg voor bidirectionele navigatie.

**ADR:** LADR-059

**Afhankelijk van:** WP-V2-003, WP-V2-005

**Deliverables:**
- [x] Quality pagina: filter op `run_id` (URL param `?run_id=`)
- [x] Quality pagina: filter op `entity_fqn` (URL param `?entity=`)
- [x] Quality tabel: kolom "Run" met link naar `/runs/[run_id]`
- [x] Quality tabel: kolom "Entity" met link naar `/entities/[fqn]`
- [x] API uitbreiding: `GET /api/quality?run_id=&entity_fqn=`
- [x] DQ trend: uitbreiding met entity-filter (niet alleen globaal)
- [x] Severity badge: consistent kleurgebruik (HIGH=rood, MEDIUM=oranje, LOW=geel)

**Schattingen:** S (2-3 dagen)

---

## Totaal overzicht

| WP | Naam | Grootte | Afhankelijkheden |
|----|------|---------|------------------|
| WP-V2-001 | Data Model Extensions | M | — |
| WP-V2-002 | Run Explorer | M | 001 |
| WP-V2-003 | Run Detail Pagina | L | 001, 002 |
| WP-V2-004 | Entity Registry | M | 001 |
| WP-V2-005 | Entity Detail Pagina | L | 001, 004 |
| WP-V2-006 | Data Product Catalog | M | 001, 004 |
| WP-V2-007 | OpenLineage Ingest | XL | 001 |
| WP-V2-008 | Navigation Restructuring | S | 002, 004, 006 |
| WP-V2-009 | Health Overview | M | 004, 006 |
| WP-V2-010 | Lineage Graph V2 | L | 003, 005 |
| WP-V2-011 | DQ-Run Integration | S | 003, 005 |

**Totale schatting:** ~60-80 ontwikkeldagen (1 developer)  
**Fasering:** Zie hieronder voor aanbevolen sprint-volgorde

---

## Aanbevolen fasering

### Fase 1 — Fundament (Sprint 1-2, ~2 weken)
- WP-V2-001: Data Model Extensions
- WP-V2-007: OpenLineage Ingest (parallel starten)

### Fase 2 — Operationele flow (Sprint 3-4, ~2 weken)
- WP-V2-002: Run Explorer
- WP-V2-003: Run Detail
- WP-V2-004: Entity Registry

### Fase 3 — Estate intelligence (Sprint 5-6, ~2 weken)
- WP-V2-005: Entity Detail
- WP-V2-006: Data Product Catalog
- WP-V2-011: DQ-Run Integration

### Fase 4 — UX samenhang (Sprint 7-8, ~2 weken)
- WP-V2-008: Navigation Restructuring
- WP-V2-009: Health Overview
- WP-V2-010: Lineage Graph V2

---

## Definition of Done (per werkpakket)

- [x] TypeScript types gedocumenteerd in `src/types/`
- [x] API routes gedocumenteerd in `docs/requirements/current-api-reference.md`
- [x] SQL migraties: getest op lokale Postgres (`insights-local-postgres`)
- [x] Redirects: getest op zowel GET als browser-navigatie
- [x] Mobile: component werkt op 375px viewport breedte
- [x] Dark mode: component toont correct in beide themes
- [x] Loading state: skeleton of spinner aanwezig
- [x] Error state: foutmelding zichtbaar bij API fout
- [x] Empty state: instructieve melding bij lege dataset
