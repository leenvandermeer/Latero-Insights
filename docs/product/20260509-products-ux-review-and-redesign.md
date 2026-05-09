# Products UX Review And Redesign

## Context

De huidige product-ervaring voelt nog niet als een volwassen operating surface voor data products. De kernproblemen zitten niet alleen in styling, maar in informatiearchitectuur, browseability en de vraag of een productdetailpagina echt antwoord geeft op: "what is in this product, what is the current trust, and what should I do next?"

Deze review kijkt naar:

- `/catalog?tab=products`
- `/products`
- `/products/[id]`

## Key Findings

### 1. Two parallel homes create product ambiguity

Data products bestaan nu tegelijk als:

- een tab in `Catalog`
- een aparte registry onder `/products`

Dat creëert overlap in plaats van hiërarchie. Voor gebruikers voelt dit als twee half-primaries in plaats van één duidelijke thuisbasis.

### 2. Product detail is not member-centric enough

De detailpagina toont wel trust, incidents en metadata, maar niet sterk genoeg de daadwerkelijke samenstelling van het product. Een business user of operator wil eerst zien:

- welke entities in dit product zitten
- wat hun health is
- welke trace-entrypoints relevant zijn

### 3. The lineage tab is too thin

De huidige `Lineage` tab is vooral een launcher naar `/lineage`. Daardoor voelt de tab leeg en onvolledig. Ook zonder volledige embedded graph moet deze tab minimaal product-scoped traceingangen bieden.

### 4. Product creation allows low-integrity products

Een data product zonder members is in de praktijk een zwak object. Als `display_name` de enige harde validatie is, dan krijg je te veel producten die UX-matig wel bestaan maar operationeel weinig betekenen.

### 5. Catalog cards behave more like CRUD tiles than assets

In `Catalog` zijn productcards nog te veel beheerkaarten. De primaire actie hoort `Open product` te zijn. Edit/delete zijn secundair.

## Best-Practice Direction

### Product model

Een data product moet minimaal leesbaar zijn als:

- business object
- governed asset bundle
- operational surface

Dat betekent:

- duidelijke members
- owner + domain + SLA zichtbaar
- trust en incidents direct contextualized
- trace-entrypoints per member

### Information architecture

Aanbevolen model:

- `Catalog` = discovery and creation surface
- `/products` = product registry
- `/products/[id]` = primary operating surface

Dus niet twee concurrerende homes, maar:

- Catalog voor browse/create
- Product detail voor operate/investigate

### Interaction pattern

Standaard productpatroon:

1. Find product
2. Open detail
3. Inspect members
4. Review trust/incidents
5. Jump into lineage or evidence from a specific member

## Work Package

### WP1 — Product Detail Foundation

- Add `Member entities` section to product overview
- Show entity status and highest visible layer
- Add direct actions:
  - `Open entity`
  - `Open trace`

### WP2 — Product Integrity In Create/Edit

- Require at least one member entity
- Surface product completeness expectations more clearly
- Keep owner/domain recommended, with later completeness prompts

### WP3 — Catalog Card Behavior

- Make product cards clearly navigable to `/products/[id]`
- Keep edit/delete secondary
- Improve CTA hierarchy

### WP4 — Product-Scoped Lineage

- Replace empty lineage launcher with product-scoped entry list
- Provide trace entry points per member entity
- Keep optional full-page lineage jump for deep exploration

### WP5 — Registry Enrichment

- Add stronger browse filters such as owner and product readiness
- Surface products missing owner, SLA, or members

## Phase 1 Implementation

This first implementation slice focuses on:

- member-centric product overview
- stronger creation validation
- better catalog card navigation
- a more useful product lineage tab

These changes improve real operator usability without requiring a full IA rewrite in one step.
