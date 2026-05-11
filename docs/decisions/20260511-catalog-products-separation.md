# LADR-076 — Catalog/Products separation: één eigenaar per domein

**Status:** ACCEPTED  
**Datum:** 2026-05-11  
**Auteur:** Tech Lead

---

## Context

Latero Control heeft twee navigatie-items onder EXPLORE: **Products** (`/products`) en
**Catalog** (`/catalog`). Beide tonen een lijst van data products:

- `/products` toont data products met health-indicatoren, trust scores, readiness-status, en
  een deep-dive detailpagina (`/products/[id]`).
- `/catalog?tab=products` toont exact dezelfde data products maar met CRUD-acties
  (edit/delete/create via `DataProductList` + `DataProductSlideOver`).

Deze overlap zorgt voor verwarring:

1. **Dubbele mentale modellen.** Gebruikers weten niet waar ze naartoe moeten voor product-beheer.
2. **Dubbele codebase.** `SlaBadge`, product-filtering en product-kaarten zijn in twee
   afzonderlijke componenten gedupliceerd.
3. **Tegenstrijdige navigatie-intentie.** Catalog positioneert zich als data-estate browser
   (entities, datasets, pipelines), maar bevat ook een volledig CRUD-scherm voor products.

---

## Besluit

**Eén eigenaar per domein:**

| Route | Eigenaar | Verantwoordelijkheid |
|-------|----------|----------------------|
| `/products` | Operationele hub | Lijst, health, trust scores, CRUD, deep-dive detail |
| `/catalog` | Estate browser | Datasets, entities, overview-statistieken |

De **"Data Products" tab in `/catalog`** wordt verwijderd. In plaats daarvan wordt de
bestaande CTA in de Catalog-overview ("Open data products") doorgelinkt naar `/products`.

De `DataProductList` component en `DataProductSlideOver` blijven bestaan maar worden
alleen vanuit `/products` gebruikt. De `ProductRegistry` in `/products` krijgt de
"New product" knop en edit/delete-acties.

---

## Alternatieven overwogen

**A. Catalog als enige bron voor products (products-route samenvoegen)**  
Verworpen: `/products/[id]` heeft een rijke detail-pagina met tabs (Overview, Issues,
Lineage, Evidence) die los staat van de catalog-browse-flow.

**B. Beide routes behouden met duidelijkere labels**  
Verworpen: lost de duplicatie en de cognitieve belasting niet op. Gebruikers zien nog
steeds twee keer dezelfde lijst.

---

## Consequenties

- Catalog-tab "Data Products" verdwijnt uit de tab-bar en de URL-parameter `?tab=products`
  heeft geen effect meer.
- De Catalog-overview CTA "Open data products" linkt naar `/products` (externe navigatie).
- `ProductRegistry` (`/products`) wordt de enige plek voor product-aanmaak en -beheer.
- Geen API-routes wijzigen; data-model ongewijzigd.
- `DataProductList` en `DataProductSlideOver` blijven beschikbaar voor eventueel hergebruik.
