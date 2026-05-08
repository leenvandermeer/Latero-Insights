# LADR-065 — Catalog Hub: data product CRUD en navigatieherstructurering

**Status:** ACCEPTED  
**Datum:** 2026-05-07  
**Auteur:** Leen van der Meer  
**Vervangt:** geen  
**Gerelateerd:** LADR-060 (Data Product / Entity / Dataset hiërarchie), LADR-061 (V2 navigation), WP-CAT-001

---

## Context

De `/catalog` pagina toonde een read-only lijst van data products. Er was geen UX om data products aan te maken, te bewerken of te verwijderen. De API had alleen een `GET` handler. Tegelijk bezetten Datasets, Entities en Catalog drie losse navigatieposities in EXPLORE, wat niet schaalbaar is naarmate het product groeit.

---

## Beslissing

### 1. Catalog wordt een hub met tab-navigatie

`/catalog` krijgt drie tabs via `CatalogHub`:

| Tab | Inhoud |
|---|---|
| Data Products | Card grid + slide-over CRUD |
| Entities | Entity-lijst met layer-statussen |
| Datasets | Dataset-lijst met laagfilter |

Dit volgt het patroon van de Lineage Explorer (Overview / Graph / Chains / Columns).

### 2. Volledige CRUD voor data products

Nieuwe API-routes naast de bestaande `GET /api/data-products`:

| Route | Methode | Functie |
|---|---|---|
| `/api/data-products` | `POST` | Nieuw data product + entity-koppeling |
| `/api/data-products/[id]` | `GET` | Detail met entity-aggregate |
| `/api/data-products/[id]` | `PUT` | Update velden + entity-koppeling (detach-all, re-attach) |
| `/api/data-products/[id]` | `DELETE` | Ontkoppel entities (`SET NULL`), verwijder product |

Alle routes: session-auth + `installation_id` scope.  
Entity-koppeling: `meta.entities.data_product_id` FK (nullable).  
DELETE: entities worden ontkoppeld, niet verwijderd.

### 3. SLA tier als first-class veld

`meta.data_products.sla_tier` toegevoegd als `TEXT CHECK (IN ('bronze','silver','gold'))`.  
Visueel zichtbaar als gekleurd badge (bronze = oranje, silver = cyaan, gold = geel).

### 4. Navigatiereductie: EXPLORE 4 → 2

EXPLORE-sectie van de sidebar bevat voortaan alleen:
- **Catalog** (hub met tabs)
- **Lineage**

De losse `/datasets` en `/entities` pagina's zijn volledig verwijderd. Geen redirects — clean break.

### 5. Frontend-componenten

| Component | Locatie |
|---|---|
| `CatalogHub` | `catalog/catalog-hub.tsx` — tab-container |
| `DataProductList` | `catalog/data-product-list.tsx` — card grid, empty state, delete dialog |
| `DataProductSlideOver` | `catalog/data-product-slide-over.tsx` — create/edit panel, entity multi-select |
| `EntityTab` | `catalog/entity-tab.tsx` — entity-lijst met laagpills |
| `DatasetTab` | `catalog/dataset-tab.tsx` — dataset-lijst met laagfilter |

Hooks: `useCreateDataProduct`, `useUpdateDataProduct`, `useDeleteDataProduct` (TanStack Query `useMutation`) in `hooks/use-data-products.ts`.

### 6. Estate Health API

Nieuwe route `GET /api/estate-health` levert samenvatting voor de Overview:
- `data_product_count`, `entity_count`, `issue_count`, `dq_pass_rate`, `last_run_at`

`useEstateHealth` hook toegevoegd aan `use-data-products.ts`.

---

## Overwogen alternatieven

**Aparte `/catalog/new` pagina** — verworpen; slide-over is sneller en context-behoudend.  
**Entities en Datasets als losse routes bewaren** — verworpen; navigatieruimte is beperkt, de user vroeg expliciet om clean break zonder redirects.

---

## Consequenties

- `/datasets` en `/entities` URLs bestaan niet meer. Bookmarks zijn ongeldig (bewust geaccepteerd).
- Dataset-rijen per `(dataset_id, layer)` vereisen composiet React key in de dataset-tabel.
- `useEstateHealth` is een extra API-call op de Overview — lage belasting (enkelvoudige aggregaat-query).
- `meta.data_products.sla_tier` is optioneel; bestaande rijen zonder SLA-waarde zijn compatibel.
