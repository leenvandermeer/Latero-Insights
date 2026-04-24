# LADR-022 — Lineage graph: layer-aware entity labels, dataset focus filter en virtual file node deduplicatie

Date: 2026-04-24
Status: ACCEPTED
Owner: Layer2 Meta Insights product
Related: [LADR-015](20260420-lineage-entity-model-redesign.md), [LADR-017](20260422-lineage-dataset-titling-and-openlineage-job-label.md)

---

## Context

Na de introductie van het dataset-first entiteitsmodel (LADR-015) en de dataset-titling correctie (LADR-017) bleven drie problemen zichtbaar in de lineage graph bij live Databricks-data:

**1. Dubbele RAW-entiteit.** Bij pipelines die een bestand (`.parquet`, `.csv`) inlezen als RAW-stap en dit ook als echte entiteit in `lineage_entities_current` hadden staan, toonde de graph zowel de echte `cbs_arbeid RAW` tabelentiteit als een virtuele bestandsnode `cbs_arbeid_2025_... RAW`. De gebruiker zag twee RAW-objecten waar er één bedoeld was.

**2. Identieke labels voor alle lagen.** `lineageDatasetLabel()` gaf voor alle lagen de dataset-groepnaam terug (bijv. `cbs_arbeid`). Voor silver- en gold-entiteiten is dit onjuist: vanuit één bronze-dataset kunnen meerdere silver-entiteiten gevoed worden (bijv. `cbs_arbeid_transactions`, `cbs_arbeid_income`). Door allemaal hetzelfde label te tonen was de 1:n relatie onzichtbaar en overlapten nodes.

**3. Geen dataset-focus mogelijkheid.** Met 48+ entiteiten was de volledige graph moeilijk leesbaar. Er was geen manier om snel in te zoomen op één dataset-chain (landing → raw → bronze → silver → gold) zonder de rest manueel te verbergen via de layer- of statusfilter.

---

## Decision

### 1. Virtual file node deduplicatie

Wanneer er voor een bronze-entiteit al een echte RAW-entiteit bestaat met dezelfde `datasetKey`, wordt geen virtuele bestandsnode aangemaakt. De edge-builder verbindt de bestaande RAW-entiteit dan direct met de bronze-entiteit via de reguliere `upstream_entity_fqns`-logica.

Rationale: de virtuele bestandsnode is een fallback voor situaties waar er geen entiteit in `lineage_entities_current` staat maar wel een bestandsreferentie in de hop-data. Als beide aanwezig zijn, is de entiteit leidend.

### 2. Layer-aware entity labels

`lineageDatasetLabel()` in `lineage-utils.ts` wordt layer-bewust:

- **Landing, Raw, Bronze** → dataset-groepnaam (bijv. `cbs_arbeid`). Deze lagen hebben een 1:1 relatie met de dataset; de groepsnaam geeft voldoende context.
- **Silver, Gold** → laatste FQN-segment met layer-suffix gestript (bijv. `cbs_arbeid_transactions`, `cbs_arbeid_income`). Deze lagen hebben een potentieel n:1 relatie met de bovenliggende bronze-dataset; de entiteit-specifieke naam is nodig voor onderscheid.

De `lineageDatasetKey()` functie (gebruikt voor chain-groepering in Overview en Chains) blijft ongewijzigd: die moet altijd de groepnaam teruggeven voor correcte aggregatie.

### 3. Row-layout voor silver/gold

De rij-toewijzing in de graph-builder gebruikte `datasetKey(entity)` als positiesleutel voor alle lagen. Voor silver/gold met dezelfde `datasetKey` resulteerde dit in overlappende nodes op dezelfde rij.

Nieuwe `rowKey(entity)` functie:
- Silver/gold → `lineageEntityKey(entity)` (uniek per entiteit)
- Overige lagen → `datasetKey(entity)` (gegroepeerd per dataset)

De sort-volgorde van rijen gebruikt een samengestelde sleutel (`datasetKey::layerIndex::entity_fqn`) zodat silver/gold-entiteiten visueel gegroepeerd blijven nabij hun bronze-parent.

### 4. Dataset focus filter

Een dataset-dropdown wordt toegevoegd aan de graph-toolbar (prominent, buiten het collapsible Filters-paneel). Bij selectie:

1. `extractChain(anchor, allEntities)` verzamelt alle entiteiten in de chain via:
   - Directe leden: `datasetKey(entity) === anchor`
   - Groepsleden: zelfde `lineage_group_id` als een direct lid
   - BFS-expansie: entiteiten bereikbaar via `upstream_entity_fqns` / `downstream_entity_fqns` refs
2. Alleen de chain-entiteiten worden doorgegeven aan `buildGraph()`.
3. De entity-teller in de toolbar toont `6 of 48 entities`.
4. Reset wist ook de dataset-selectie.

De dropdown toont alleen dataset-namen van landing/raw/bronze-entiteiten (de chain-roots). Silver/gold-entiteiten volgen impliciet via de BFS-expansie.

---

## Consequences

- De graph toont nooit meer een dubbele RAW-node voor dezelfde dataset.
- Silver/gold-entiteiten zijn individueel identificeerbaar en overlappen niet.
- De 1:n relatie van bronze naar silver is nu visueel zichtbaar in de graph-layout.
- Gebruikers kunnen de volledige end-to-end chain van één dataset isoleren in één klik.
- `lineageDatasetLabel()` gedraagt zich anders voor silver/gold; plaatsen die de functie aanroepen voor chain-identificatie moeten `lineageDatasetKey()` blijven gebruiken.

---

## Implementation Notes

**`lineage-utils.ts`** — `lineageDatasetLabel()`:
```typescript
export function lineageDatasetLabel(entity: LineageEntity): string {
  const layer = entity.layer.toLowerCase();
  if (layer === "silver" || layer === "gold") {
    const last = entity.entity_fqn.split(".").filter(Boolean).at(-1) ?? entity.entity_fqn;
    const stripped = stripKnownSuffixes(last);
    return stripped || last;
  }
  return lineageDatasetKey(entity);
}
```

**`graph-view.tsx`** — key changes:
- `rowKey(entity)`: returns `lineageEntityKey(entity)` for silver/gold, `datasetKey(entity)` otherwise.
- `seenRowKeys` map with composite sort key ensures silver/gold rows are sorted near their dataset group.
- Virtual file node block guards with `entities.some(e => e.layer === "raw" && datasetKey(e) === datasetKey(bronzeEntity))`.
- `extractChain(anchor, allEntities)`: BFS via `fqnIndex` map for O(n) lookups per iteration.
- `datasetOptions` derived from non-silver/gold entities only.
- All internal references updated from `normalizedEntities` to `focusedEntities` after focus is applied.
- `X_SPACING` increased from 360 to 400 to accommodate wider node labels.

**`entity-node.tsx`** — label rendering:
- `truncate` replaced with `line-clamp-2` to allow two-line wrapping.
- Node width changed from `min-w-[180px] max-w-[240px]` to `min-w-[200px] max-w-[280px]`.

---

## Follow-up Backlog

1. Persist dataset-focus selection in URL query params so users can share a focused graph view via link.
2. Highlight the selected dataset chain in the Overview and Chains tabs when navigating from a focused graph.
3. Evaluate whether `extractChain` BFS should also traverse `lineage_attributes_current` for column-level connectivity.
