# LADR-061 — V2: Navigation en routing herstructurering

| Eigenschap | Waarde |
|-----------|--------|
| ID | LADR-061 |
| Datum | 2026-05-04 |
| Status | PROPOSED |
| Auteur | Leen van der Meer |
| Gerelateerd | LADR-059, LADR-060, LADR-015, LADR-027, LADR-031 |

---

## Context

De huidige navigatiestructuur is:

```
/ Dashboard    → lege canvas (geen out-of-the-box widgets)
/ Pipelines    → lijst van pipeline runs
/ Quality      → lijst van DQ checks
/ Datasets     → dataset-overzicht met lineage-context
/ Lineage      → lineage graph (drie perspectieven)
/ OpenLineage  → technische export in OL-formaat
```

### Geconstateerde problemen

**1. Ontbrekend startpunt**
De `/ Dashboard` route start leeg. Nieuwe gebruikers weten niet wat ze moeten
doen. Er is geen "health overview" die direct vertelt hoe het systeem er voor staat.

**2. Pipelines-pagina is een lijst zonder context**
De runs-lijst toont status, maar klikken op een run doet niets.
Er is geen run-detailpagina. DQ checks zijn op een aparte pagina, niet naast
de run die ze heeft voortgebracht.

**3. Datasets en Lineage zijn conceptueel verwarrend**
De Datasets-pagina toont entiteiten (layer-scoped), niet "datasets" in de
traditionele zin. Lineage heeft een eigen pagina maar datasets hebben ook
lineage-context. Een gebruiker weet niet waar hij "zijn dataset" moet zoeken.

**4. OpenLineage als aparte pagina**
OpenLineage is een export-formaat, geen navigatie-bestemming.
Het hoort in de lineage-pagina als exportfunctie, niet als aparte route.

**5. Geen drill-down patroon**
Van runs kun je niet naar entiteiten navigeren.
Van entiteiten kun je niet naar hun DQ checks navigeren.
Van DQ checks kun je niet terug naar de run navigeren.
Elke pagina staat op zichzelf.

**6. Geen entity-detail pagina**
Er is geen pagina die één entiteit toont over alle lagen heen:
"Wat is de status van `cbs_arbeid_transactions` van landing tot gold?"

---

## Decision

**Herstructureer de navigatie rond drie primaire workflows met een coherent
drill-down patroon.**

### Drie workflows

| Workflow | Vraag | Startpunt |
|----------|-------|-----------|
| **Operate** | Wat is er gerund en hoe ging het? | `/runs` |
| **Understand** | Hoe zit mijn data-landschap in elkaar? | `/catalog` of `/lineage` |
| **Monitor** | Hoe gezond is mijn data-estate? | `/` (home) |

### Nieuwe routing structuur

```
/                           → Health Overview (nieuw, was: lege dashboard)
/runs                       → Run Explorer (was: /pipelines)
/runs/[run_id]              → Run Detail (nieuw)
/catalog                    → Data Product Catalog (nieuw)
/catalog/[product_id]       → Data Product Detail (nieuw)
/entities                   → Entity Registry (was: /datasets)
/entities/[fqn]             → Entity Detail – cross-layer view (nieuw)
/entities/[fqn]/quality     → Entity DQ history (nieuw)
/entities/[fqn]/lineage     → Entity lineage subgraph (nieuw)
/lineage                    → Globale lineage graph (hernoemt: was /lineage)
/quality                    → DQ Check Explorer (blijft, uitgebreid)
/dashboards                 → Custom dashboards (was: /)
/dashboards/[id]            → Specifiek dashboard
```

**Verwijderd:**
- `/openlineage` — wordt ExportButton in `/lineage`

**Redirects:**
- `/pipelines` → `/runs` (301 permanent)
- `/datasets` → `/entities` (301 permanent)
- `/dashboard` → `/dashboards` (301 permanent)

### Navigatiemenu V2

```
[Latero Control logo]

OBSERVE
  ⊙ Overview          /
  ▶ Runs              /runs

EXPLORE
  ⊟ Catalog           /catalog
  ◻ Entities          /entities
  ⟳ Lineage           /lineage
  ✓ Quality           /quality

CUSTOMIZE
  ⊞ Dashboards        /dashboards

[Settings / Admin]
```

### Drill-down patroon

Het centrale navigatiepatroon in V2 is contextbehoud bij drill-down:

```
Run Explorer (/runs)
  └── Run Detail (/runs/[run_id])
        ├── I/O Dataset → Entity Detail (/entities/[fqn])
        │     ├── Entity Lineage (/entities/[fqn]/lineage)
        │     └── Entity DQ History (/entities/[fqn]/quality)
        └── DQ Check → Quality Explorer (gefilterd op run_id)

Catalog (/catalog)
  └── Data Product (/catalog/[product_id])
        └── Entity Detail (/entities/[fqn])

Lineage Graph (/lineage)
  └── Node click → Entity Detail panel (slide-in, geen navigatie)
        └── "Open full page" → /entities/[fqn]
```

### Breadcrumb en context-preservatie

Elke detail-pagina toont een breadcrumb die de navigatiepad weergeeft:

```
Runs > Run 2026-05-04-001 > cbs_arbeid::bronze > Entity: cbs_arbeid_transactions
```

Breadcrumb-state wordt opgeslagen in de URL (query params) zodat de
terugknop werkt zoals verwacht.

---

## Pagina-specificaties (samenvatting)

### `/` — Health Overview

**Doel:** Snelle operationele status van de gehele data-estate.

**Componenten:**
- Health score per data product (kleurgecodeerd: groen/geel/rood)
- "Last run" indicator: wanneer is er voor het laatst iets gerund?
- Failing runs in de afgelopen 24 uur (counter + lijst)
- Open DQ failures per severity
- Lineage coverage score (% entiteiten met bekende lineage)
- Recent activity feed (laatste 10 runs/checks, meest recent eerst)

**Data:** Combinatie van `/api/runs`, `/api/quality`, `/api/entities`.

### `/runs` — Run Explorer

**Doel:** Chronologische tijdlijn van alle pipeline-uitvoeringen.

**Componenten:**
- Timeline-weergave per dag, swimlane per job-naam of step
- Filter: datum, status, environment, step, data product
- Zoekbalk: job-naam, dataset-naam, run_id
- Kolommen: run_id, job, step, datasets (I/O count), status, duration, tijdstip
- Klik op rij → `/runs/[run_id]`

### `/runs/[run_id]` — Run Detail

**Doel:** Volledig inzicht in één uitvoering.

**Componenten:**
- Header: run metadata (status, step, environment, duration, started_at)
- I/O Datasets tab: gelezen en geschreven datasets (met layer-badge en status)
- DQ Checks tab: alle checks uit deze run (check_name, status, severity, result)
- Lineage Activity tab: edges bevestigd in deze run
- Child Runs tab: stap-hiërarchie (indien parent_run_id aanwezig)

### `/entities/[fqn]` — Entity Detail

**Doel:** Cross-layer overzicht van één logische entiteit.

**Componenten:**
- Header: entity_fqn, display_name, data product badge, source system
- Layer status tabel: één rij per laag (landing/raw/bronze/silver/gold)
  - Kolommen: laag, dataset_id, laatste run datum, run status, DQ pass rate, records
- Run history tab: laatste N runs die deze entiteit (in enige laag) hebben geraakt
- DQ Summary tab: check categorie breakdown met trend
- Knop: "Bekijk lineage" → `/entities/[fqn]/lineage`

### `/catalog` — Data Product Catalog

**Doel:** Overzicht van alle data products met hun health.

**Componenten:**
- Grid van data product cards (naam, domein, owner, health score, entity count)
- Filter: domein, owner, health status
- Klik op card → `/catalog/[product_id]`

---

## Gevolgen

### Positief

- Coherente drill-down flow van "wat is er gerund" naar "hoe zit mijn data in elkaar"
- Health Overview als startpagina geeft direct inzicht zonder configuratie
- Entity Detail pagina beantwoordt de kernvraag "status per entiteit in de keten"
- OpenLineage export verdwijnt als aparte navigatie-bestemming

### Negatief / Risico's

- Significante routeringswijziging; bestaande bookmarks breken (gemitigeerd door redirects)
- De Health Overview vereist geaggregeerde data die via meerdere joins moet worden
  opgehaald; caching strategie moet worden herzien
- Widget-systeem: bestaande systeem-dashboards (`system:pipelines`, `system:quality`)
  worden deels vervangen door native pagina's; migratie-pad moet worden gedocumenteerd

### Bestaande pagina's

| Huidige route | V2 lot |
|--------------|--------|
| `/` (dashboard) | → `/dashboards` (redirect), `/` wordt Health Overview |
| `/pipelines` | → `/runs` (redirect), hergebruik van `usePipelines` hook |
| `/quality` | Blijft, uitgebreid met entity-filter en run-link |
| `/datasets` | → `/entities` (redirect) |
| `/lineage` | Blijft, export-knop vervangt `/openlineage` route |
| `/openlineage` | Verwijderd als route, export-button in `/lineage` |

---

## Alternatieven overwogen

**Alternatief A: Huidige structuur behouden, alleen detail-pagina's toevoegen**
Deels bruikbaar. De redirects en detail-pagina's zijn hoe dan ook nodig.
Maar de Health Overview als startpunt is essentieel voor het operationele gebruik
en kan niet worden gerealiseerd zonder de home-route te herdefiniëren.

**Alternatief B: Alles als dashboard (LADR-007 voorzetting)**
Afgewezen voor structurele data-views. Data product, entity en run detail zijn
vaste schemas met specifieke componenten. Ze als configureerbare dashboards bouwen
voegt complexiteit toe zonder waarde. Custom dashboards blijven beschikbaar voor
vrije analyses.

**Alternatief C: Tabs in plaats van aparte routes voor entity sub-views**
Overwogen voor entity quality en entity lineage. Gekozen voor aparte routes
zodat directe links mogelijk zijn (bijv. vanuit een DQ-alert e-mail direct naar
`/entities/cbs_arbeid_transactions/quality`).
