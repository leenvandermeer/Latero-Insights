# LADR-063 — Datasets Explorer: zichtbaarheid voor alle pipeline-lagen in Explore

**Datum:** 2026-05-04  
**Status:** ACCEPTED  
**Auteur:** Tech Lead (Latero Control)

---

## Context

Latero Control toont in de Explore-sectie momenteel **Entities** (`meta.entities`) als primaire
inventarisatieview. Entities zijn hogere-orde businessconcepten die typisch pas in de
silver/gold-laag verschijnen en expliciete registratie vereisen via de Latero runtime.

Gebruikers die uitsluitend raw- en bronze-pipelines draaien — wat in de praktijk de beginfase
van elke implementatie is — zien daardoor niets in de Explore-sectie. De data is aanwezig in
`meta.datasets` (de lager-niveau tabel die alle geobserveerde pipeline-datasets bijhoudt), maar
is niet bereikbaar via de UI.

Dit is een onboarding-barrière: een eerste Databricks-run met alleen raw/bronze-stappen levert
geen zichtbaar resultaat op in Explore.

---

## Besluit

We voegen een **Datasets** pagina toe op `/datasets` in de Explore-sectie van de sidebar.  
Deze pagina leest rechtstreeks uit `meta.datasets` en toont **alle geobserveerde datasets**,
ongeacht layer of entity-koppeling.

### Features v1

- **Layer-filter tabs:** All | Landing | Raw | Bronze | Silver | Gold
- **Search** op `object_name` en `fqn`
- **Tabel:** object_name (primair), fqn (subtext), layer badge, platform, entity_type, group_id, last_seen_at
- **Geen detail-pagina** in v1 — dataset-rij linkt direct naar lineage graph (via fqn als focus-param)
- **API route:** `GET /api/datasets?layer=&q=` — server-side, session-geauthenticeerd, installation-scoped

### Layer badge kleuren (medallion)

| Layer    | Kleur token               |
|----------|---------------------------|
| landing  | `--color-text-muted` (grijs) |
| raw      | blauw (info-tint)         |
| bronze   | oranje (warning-tint)     |
| silver   | cyan                      |
| gold     | geel                      |

---

## Alternatieven overwogen

### 1. Entities uitbreiden met raw/bronze
Afgewezen: entities zijn business-objecten. Raw/bronze datasets zijn pipeline-artefacten, geen
entiteiten in de bedrijfsontologische zin. Vermengen verstoort de semantiek van `/entities`.

### 2. Catalog uitbreiden met datasets-tab
Afgewezen: de Catalog is georganiseerd rond Data Products → Entities. Raw/bronze datasets horen
daar semantisch niet bij en zouden de Catalog-navigatie vertroebelen.

### 3. Datasets opnemen in lineage-view
Afgewezen als vervanging: lineage is een graaf-representatie, niet geschikt als inventarisatie-
overzicht voor operationeel monitoring.

---

## Gevolgen

- Nieuwe route `/datasets` onder `(tenant)/(dashboard)/`
- Nieuwe API `GET /api/datasets` — leest `meta.datasets`, scoped op `installation_id`
- Sidebar `EXPLORE_NAV` krijgt een "Datasets"-item vóór "Entities"
- Nieuwe hook `useDatasets` in `src/hooks/`
- Geen breaking changes; bestaande `/entities` en `/catalog` ongewijzigd

---

## Relaties

- Gebouwd op het schema uit LADR-040 (`meta.datasets`)
- Complementair aan LADR-060 (data product/entity/dataset hiërarchie)
- Onboarding zichtbaarheid als beschreven in LINS-020 (installation-aware UX)
