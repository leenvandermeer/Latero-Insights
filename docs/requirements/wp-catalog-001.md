# WP-CAT-001 — Catalog CRUD + Navigation Restructuring

**Status:** COMPLETED  
**Datum:** 2026-05-07  
**Auteurs:** UX Designer Agent, Requirements Engineer Agent, Tech Lead  

---

## Probleemstelling

De `/catalog` pagina toont data products maar heeft geen UX om ze aan te maken, te bewerken of te verwijderen. De API ondersteunt alleen `GET`. Daarnaast bezetten Datasets, Entities en Catalog drie losse navigatie-items in EXPLORE, wat niet schaalt.

---

## Doelstelling

1. Catalog wordt de centrale hub voor data-exploratie met CRUD voor data products.
2. EXPLORE krimpt van 4 naar 2 items — Datasets en Entities worden tabs binnen Catalog.
3. Nieuwe LINS-requirements voor CRUD worden geformaliseerd.

---

## Requirements

### Van toepassing (bestaand)
| ID | Omschrijving |
|---|---|
| LINS-002 | API MUST lezen uit Insights Postgres store |
| LINS-003 | Geen DB-credentials in de browser |
| LINS-015 | Alle UI-tekst in het English |
| LINS-016 | Alle queries gefilterd op `active_installation_id` |

### Nieuw (dit WP)
| ID | MUST/SHOULD | Omschrijving |
|---|---|---|
| LINS-022 | MUST | Catalog ondersteunt CRUD voor data products via `/api/data-products` |
| LINS-023 | MUST | Data product bevat minimaal: `display_name`, optioneel `description`, `owner`, `domain`, `tags` |
| LINS-024 | MUST | Entity-koppeling (`data_product_id` op `meta.entities`) is beheerbaar vanuit catalog UI |
| LINS-025 | MUST | Health-status per data product is zichtbaar (aggregaat van gekoppelde entities) |
| LINS-026 | MUST | DELETE van een data product ontkoppelt entities (zet `data_product_id = NULL`), verwijdert de entities niet |
| LINS-027 | SHOULD | Catalog navigeert door naar `/entities/[fqn]` vanuit data product detail |
| LINS-028 | SHOULD | Lege staat toont call-to-action als er geen data products zijn |

---

## Navigatiewijziging

**Voor:**
```
EXPLORE
  Datasets
  Entities
  Catalog
  Lineage
```

**Na:**
```
EXPLORE
  Catalog    ← tabs: Data Products | Entities | Datasets
  Lineage    ← tabs: Overview | Graph | Chains | Columns
```

- Pagina's `/datasets` en `/entities` worden volledig verwijderd
- Geen redirects — clean break, geen architectuurschuld
- Geen ADR vereist (geen normatieve requirement beschermt huidige structuur)

---

## UX Ontwerp

### Navigatie
Catalog krijgt tab-navigatie bovenaan de pagina, gelijk aan Lineage:
```
[Data Products]  [Entities]  [Datasets]
```

### Tab: Data Products

**Lege staat:**
- Gecentreerd, `Package` icon (48px, muted)
- Kop: "No data products yet"
- Subtekst: "Group your entities into a reusable data product."
- CTA: `+ New data product` (primary button)

**Lijst (card grid):**
- 3 kolommen ≥1280px, 2 kolommen ≥768px, 1 kolom mobiel
- Per card: naam + SLA badge | domain tag | beschrijving (2 regels) | `N entities · owner · Updated Xd ago`
- Hover: `ring-1 ring-brand` + `...` menu (Edit / Delete)
- Delete: confirmatiedialoog ("Removes the data product, entities are kept.")

**Slide-over panel (create/edit, 480px):**
| Veld | Type | Verplicht |
|---|---|---|
| Name | text input | ja |
| Description | textarea (3 rows) | nee |
| Owner | text input | nee |
| Domain | text input | nee |
| SLA tier | select: Bronze / Silver / Gold | nee |
| Entities | multi-select combobox (bestaande entities) | ja, min 1 |

Entiteit multi-select: live zoeken, geselecteerde entities als chips (scrollbaar bij >6).

**Detail pagina `/catalog/[id]`:**
- Twee kolommen: entities tabel links (naam, layer, last_run, status), metadata rechts (owner, domain, SLA, created, updated)
- `Edit data product` knop opent slide-over pre-filled

### Tabs: Entities & Datasets
Bestaande `EntityRegistry` en `DatasetRegistry` componenten, verplaatst als tab-content. Geen functionele wijziging.

---

## Technische scope

### WP-1 — SQL migratie
- Verifieer `installation_id` kolom op `meta.data_products`
- Voeg toe indien ontbreekt: `ALTER TABLE meta.data_products ADD COLUMN IF NOT EXISTS installation_id UUID REFERENCES meta.installations(installation_id)`

### WP-2 — API routes
| Route | Methode | Omschrijving |
|---|---|---|
| `/api/data-products` | `POST` | Nieuw data product aanmaken |
| `/api/data-products/[id]` | `GET` | Detail ophalen |
| `/api/data-products/[id]` | `PUT` | Data product bijwerken incl. entity-koppeling |
| `/api/data-products/[id]` | `DELETE` | Verwijderen + entities ontkoppelen |

Alle routes: session auth + `installation_id` scope (LINS-016).

### WP-3 — Frontend: Catalog hub
- `/catalog` wordt hub met tab-navigatie
- `DataProductList` component (card grid + empty state)
- `DataProductSlideOver` component (create/edit)
- `/catalog/[id]` detail pagina

### WP-4 — Frontend: navigatiewijziging
- Sidebar: Datasets en Entities verwijderen als losse items, Catalog als enig EXPLORE-item naast Lineage
- 302 redirects in `next.config.ts`: `/datasets` → `/catalog?tab=datasets`, `/entities` → `/catalog?tab=entities`
- BottomNav bijwerken

### WP-5 — Hook + query updates
- `useDataProducts` hook uitbreiden met mutaties (create/update/delete via TanStack Query `useMutation`)
- Cache invalidatie na mutaties

---

## Acceptatiecriteria

1. Catalog toont lege staat met CTA als er geen data products zijn
2. Data product aanmaken via slide-over werkt, entity multi-select toont alleen bestaande entities
3. Edit en Delete werken vanuit card `...` menu
4. Delete ontkoppelt entities, verwijdert ze niet
5. Detail pagina `/catalog/[id]` toont entities met status
6. `/datasets` en `/entities` redirecten correct naar catalog tabs
7. Sidebar heeft 2 EXPLORE-items (Catalog, Lineage)
8. Alle UI-tekst is English (LINS-015)
9. Alle API-calls zijn tenant-scoped (LINS-016)
