# LADR-066 — Lineage: entiteit-centrische focus, cross-chain upstream en visuele node-navigatie

**Status:** ACCEPTED  
**Datum:** 2026-05-07  
**Auteur:** Leen van der Meer  
**Vervangt:** gedeeltelijk LADR-022 (dataset focus filter)  
**Gerelateerd:** LADR-058 (layer-scoped entity model), LADR-015 (Lineage Explorer model)

---

## Context

De Lineage Graph had een **dataset focus** dropdown die de grafiek filterde op een dataset-keten (bijv. `cbs_arbeid`). Dit introduceerde twee problemen:

1. **Entiteiten met meerdere upstream-bronnen waren niet volledig zichtbaar.** Een gold-entiteit als `gold_gemeente_esg_score` kan meerdere silver-bronnen uit verschillende ketens nodig hebben. Na filteren op één keten verdwenen de andere silver-inputs, waardoor het goud-node "zwevend" leek.

2. **De selector was dataset-centrisch.** Gebruikers denken in entiteiten (bijv. `gold_gemeente_esg_score (gold)`), niet in ruwe dataset-namen (bijv. `gemeente_esg_score`).

---

## Beslissing

### 1. Dataset-selector vervangen door entiteit-selector

De `datasetFocus` state (dataset naam) is vervangen door `entityFocus` (exacte `layer::name` key).

De toolbar toont:
- **Laagfilter-pills** (All / Landing / Raw / Bronze / Silver / Gold) — filtert de entiteiten in de dropdown
- **Entity-selector** — toont elke unieke entiteit als `naam (laag)`, gesorteerd op laag → naam

Focus-logica: `extractFromEntityKey(entityKey, allEntities)` — bidirectionele BFS vanuit de geselecteerde entiteit, identiek aan de vroegere `extractChain` maar geseed op `lineageNodeKey(e) === entityKey` in plaats van `datasetKey(e) === anchor`. `extractChain` is verwijderd.

### 2. Cross-chain upstream zichtbaarheid bij Upstream-viewpoint

Bij viewMode `"upstream"` of `"downstream"` gebruikt de grafiek `normalizedEntities` (alle entities) als BFS-bron, niet `focusedEntities` (de huidige keten).

```
graphEntities =
  viewMode === "upstream"  → computeUpstreamKeys(selectedNodeId, normalizedEntities)
  viewMode === "downstream" → computeDownstreamKeys(selectedNodeId, normalizedEntities)
  viewMode === "all"        → focusedEntities
```

Dit maakt het mogelijk om te zien dat `gold_gemeente_esg_score` meerdere silver-bronnen heeft, ook als die bronnen uit een andere dataset-keten komen.

### 3. handleNavigateTo gebruikt normalizedEntities

Node-navigatie vanuit het detail-panel loopt nu altijd via de volledige `normalizedEntities` set, zodat cross-chain navigatie werkt ongeacht de actieve focus.

### 4. Entity-teller in de toolbar

De entiteitsteller toont `N of M` als er een entity-focus actief is of een viewpoint-trace loopt.

---

## Werkwijze voor multi-source gold-entiteiten

1. Selecteer `gold_gemeente_esg_score (gold)` in de entity-selector.
2. De grafiek toont de volledige keten: alle upstream datasets en entities die direct of indirect naar dit goud-node leiden.
3. Klik op het goud-node → selecteer "Upstream" in de viewpoint-toggle.
4. De grafiek rebuildt vanuit `normalizedEntities`: alle silver-bronnen verschijnen, inclusief die uit andere ketens.

### 5. Visuele parent/child navigatie op nodes

Elk entity-node toont op hover of selectie een navigatiebalk onderaan het node:

```text
[← 2]                    [3 →]
```

- `← N` = aantal upstream parents; klikken activeert upstream viewpoint voor dit node
- `N →` = aantal downstream children; klikken activeert downstream viewpoint
- De knoppen roepen `setSelectedNodeId(nodeId) + setViewMode(direction)` aan — identiek aan de toolbar-knoppen, maar inline op het node

### 6. TraceRole en hop distance per node

Zodra een node geselecteerd is, berekent de grafiek voor elk node in de view via BFS-met-afstand (`computeUpstreamDistances`, `computeDownstreamDistances`) een `traceRole` en `hopDistance`. Deze worden geïnjecteerd in de node data en visueel weergegeven:

| Role | Visueel | Betekenis |
| --- | --- | --- |
| `anchor` | Blauwe glow + **ANCHOR** badge | Het geselecteerde node zelf |
| `upstream` | Blauwe border + `N hops away` | Directe of indirecte parent |
| `downstream` | Gouden border + `N hops away` | Directe of indirecte child |
| `both` | Brand border | Zit in zowel upstream als downstream pad |
| `neutral` | Gedimde opacity (0.12) | Niet verbonden met de trace |

`hopDistance` = aantal BFS-stappen van het anchor-node. Staat als `N hops away` onderaan elk bereikbaar node.

---

## Overwogen alternatieven

**Ghost-edges** — upstream-bronnen buiten de huidige keten muted tonen. Verworpen: voegt visuele ruis toe; de gebruiker wil inzoomen, niet de volledige grafiek met extra lagen bekijken.

**Node-detail panel met upstream-lijst** — klikbaar paneel naast de grafiek. Geïmplementeerd als bestaand `EntityDetailPanel`; de node-knoppen zijn een aanvulling hierop, niet een vervanging.

---

## Consequenties

- `extractChain` verwijderd. Vervanging `extractFromEntityKey` heeft identieke tijdscomplexiteit (bidirectionele BFS O(n²) worst case, praktisch lineair op sparse grafen).
- Bij Upstream/Downstream viewpoint kan de grafiek tijdelijk meer nodes tonen dan de entity-focus verwacht — dit is bewust gedrag.
- `initialFocus` URL-parameter mapt nu op `lineageNodeKey` (exact `layer::name`) in plaats van op `datasetKey`.
- Elke node-selectie triggert twee BFS-runs (upstream + downstream) over `graphEntities`. Verwaarloosbaar bij huidige schaal; bij >500 nodes opnieuw evalueren.
