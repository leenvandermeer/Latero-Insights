# LADR-015 — Lineage Explorer: nieuw entiteitsmodel en drie-perspectief UX

**Datum:** 2026-04-20
**Status:** ACCEPTED
**Auteur:** Tech Lead
**Vervangt/uitbreidt:** LADR-003 (lineage-sectie), vervangt canonical-modus
**Nadere UX-richtlijn:** [LADR-016](20260422-progressive-disclosure-dashboard-ux.md)

---

## Context

Het Latero MDCF-framework schrijft lineage-data nu naar drie gespecialiseerde
meta-tabellen. Layer2 Meta Insights las voorheen één `data_lineage`-tabel met
hop-records (source/target per pipeline run, datum-gefilterd). De nieuwe
tabelstructuur biedt:

- **`lineage_entities_current`** — per entiteit per laag: `entity_fqn`, `layer`,
  `latest_status`, `end_to_end_status`, `latest_success_at`,
  `upstream_entity_fqns[]`, `downstream_entity_fqns[]`,
  `lineage_group_id`, `last_completed_layer`
- **`lineage_attributes_current`** — kolom-lineage: `source_entity_fqn`,
  `source_attribute`, `target_entity_fqn`, `target_attribute`, `is_current`

De huidige UI heeft drie modi (`history`, `canonical`, `chain`) die intern van
aard zijn en niet aansluiten bij de mentale modellen van data engineers
("hoe staat mijn keten er nu voor?", "welke kolommen gaan waar naartoe?").

### Problemen met het huidige ontwerp

1. **Date-range op snapshot-data**: de nieuwe `_current`-tabellen zijn momentopnames,
   geen tijdreeksen. Een datumfilter is conceptueel onjuist.
2. **DQ-health als proxy**: status werd afgeleid via een join met `data_quality_checks`.
   De nieuwe `latest_status` en `end_to_end_status` zijn de gezaghebbende bron.
3. **Drie verwarrende modi**: `history` vs `canonical` is een implementatiedetail,
   geen gebruikersperspectief. `chain`-view heeft geen zichtbare verbinding met de
   end-to-end status van een keten.
4. **Geen kolom-lineage**: de `lineage_attributes_current`-tabel heeft geen UI.

---

## Beslissing

### 1. Nieuw data contract

De `LineageHop`-type en bijbehorende adapter-methode `getLineageHops()` worden
vervangen door twee nieuwe typen en methoden:

```ts
// src/lib/adapters/types.ts

interface LineageEntity {
  entity_fqn: string;
  layer: string;
  latest_status: string;         // "SUCCESS" | "FAILED" | "WARNING" | "UNKNOWN"
  end_to_end_status: string;     // "SUCCESS" | "PARTIAL" | "FAILED" | "UNKNOWN"
  latest_success_at: string | null;
  upstream_entity_fqns: string[];
  downstream_entity_fqns: string[];
  lineage_group_id: string | null;
  last_completed_layer: string | null;
}

interface LineageAttribute {
  source_entity_fqn: string;
  source_attribute: string;
  target_entity_fqn: string;
  target_attribute: string;
  is_current: boolean;
}
```

Adapter-interface uitgebreid met:
```ts
getLineageEntities(): Promise<LineageEntity[]>;
getLineageAttributes(): Promise<LineageAttribute[]>;
```

`getLineageHops()` blijft aanwezig voor backward-compat met de OpenLineage-export
maar wordt niet meer gebruikt door de lineage-views.

### 2. Nieuwe API-routes

| Route | Tabel | Caching |
|-------|-------|---------|
| `GET /api/lineage/entities` | `lineage_entities_current` | 5 min, cache-key `lineage-entities` |
| `GET /api/lineage/attributes` | `lineage_attributes_current` | 10 min, cache-key `lineage-attributes` |

De bestaande `GET /api/lineage` (hops) en `GET /api/lineage/canonical` blijven
beschikbaar voor backward-compat maar worden niet meer door de lineage-views
aangeroepen.

### 3. Drie-perspectief UI

De lineage-pagina krijgt drie tabbladen die elk een afzonderlijk perspectief bieden:

#### Tab 1 — Graph (standaard)
- ReactFlow-canvas met `entity_fqn` als node-identiteit
- Edges afgeleid van `upstream_entity_fqns` / `downstream_entity_fqns`
- Node-kleur bepaald door `latest_status`
- `end_to_end_status` zichtbaar in het detailpanel, niet als vaste node-badge
  (zie LADR-016: graph blijft scanbaar, details via progressive disclosure)
- Horizontale layer-swimlanes (Landing / Raw / Bronze / Silver / Gold)
- Zoeken op `entity_fqn`, filteren op layer en status
- Klik op node → slide-in detailpanel

#### Tab 2 — Chains
- Gegroepeerd op `lineage_group_id`
- Per chain: horizontale steppen-balk met `last_completed_layer` indicator
- `end_to_end_status` badge per chain
- Expand per chain toont entiteiten per laag met `latest_status`

#### Tab 3 — Columns
- Attribuut-lineage uit `lineage_attributes_current` (gefilterd op `is_current = true`)
- Zoeken op entiteitnaam of attribuutnaam
- Toont: `source_entity.attribute → target_entity.attribute`
- ReactFlow-subgraph voor geselecteerde bronentiteit

#### Detailpanel (graph + chains)
Slide-in rechts, toont:
- `entity_fqn`, `layer`
- `latest_status` + `end_to_end_status`
- `latest_success_at`
- Upstream/downstream aantallen (klikbaar voor navigatie)
- Kolom-lineage preview (top 5, link naar Columns-tab)

### 4. Geen date-range picker op lineage-views

De `_current`-tabellen zijn momentopnames. De date-range picker wordt verwijderd
uit de lineage-header. Vervangen door een "Bijgewerkt op: [timestamp]"-indicator
die de recentste `latest_success_at` toont.

### 5. Componenten en hooks

Nieuwe bestanden:
```
src/hooks/use-lineage-entities.ts
src/hooks/use-lineage-attributes.ts
src/app/(dashboard)/lineage/
  graph-view.tsx          ← vervangt lineage-canvas.tsx (refactor)
  chains-view.tsx         ← vervangt chain-view.tsx
  columns-view.tsx        ← nieuw
  entity-node.tsx         ← uitgebreid met nieuwe status-props
  node-detail-panel.tsx   ← uitgebreid met kolom-lineage
```

`lineage-canvas.tsx` en `chain-view.tsx` worden hernoemd/herschreven. De
`SearchableSelect` component wordt verplaatst naar `src/components/ui/`.

### 6. Seed-data

`scripts/seed-cache.mjs` wordt uitgebreid met synthetische data voor
`lineage-entities` en `lineage-attributes` cache-keys.

---

## Overwogen alternatieven

### A — Behoud van date-range filter, toevoegen van extra velden
Verworpen: conceptueel incorrect voor snapshot-tabellen. Verwarrend voor
gebruikers ("welke datum geeft de 'huidige' toestand?").

### B — Één gecombineerde tabel/view aan serverkant
Verworpen: past niet bij het adapter-model. Databricks-specifieke joins horen
in de adapter, niet in een database view buiten Insights-controle.

### C — Graph-only, geen Chains/Columns tabs
Verworpen: de `lineage_group_id`-structuur bevat waardevolle ketenstatus die
niet goed leesbaar is in een vrij graph. Kolom-lineage is een eigen
dimensie die een aparte UI vereist.

---

## Gevolgen

| Aspect | Impact |
|--------|--------|
| Backwards compat | `/api/lineage` (hops) blijft beschikbaar; OpenLineage-export onaangetast |
| Breaking change UI | De drie bestaande modi verdwijnen; routes blijven gelijk (`/lineage`) |
| Nieuw data vereiste | `lineage_entities_current` en `lineage_attributes_current` moeten bestaan in Unity Catalog |
| Cache-only mode | Seed-script uitbreiden met twee nieuwe cache-keys |
| TypeScript | `LineageHop` type blijft; twee nieuwe types toegevoegd |

---

## Aanvulling 2026-04-22 — schema-introspectie en provenance

Omdat Databricks-omgevingen incrementeel extra lineage-kolommen kunnen
publiceren, moet de adapterlaag schema-aware blijven:

- De adapter leest beschikbare kolommen van `lineage_entities_current`,
  `lineage_attributes_current` en `data_lineage` via `DESCRIBE TABLE`.
- Lineage-selects gebruiken alleen kolommen die in de doelomgeving aanwezig
  zijn, zodat nieuwe attributen incrementeel kunnen worden geactiveerd.
- Attribuutlineage gebruikt `lineage_attributes_current` als primaire bron en
  kan `data_lineage` hop-evidence toevoegen als fallback.
- Samengevoegde attribuutmappings dragen provenance metadata
  (`lineage_attributes_current` of `data_lineage_hop`) voor uitlegbaarheid en
  debugging in UI/API.

---

## Requirements mapping

| LINS | Requirement | Impact |
|------|-------------|--------|
| LINS-002 | Data adapter interface | Nieuwe methoden toegevoegd |
| LINS-003 | Multi-source adapter support | Interface uitgebreid, Databricks-impl aangepast |
| LINS-008 | Lineage visualisatie | Volledig vervangen door nieuw model |
| LINS-009 | Data kwaliteit zichtbaarheid | Status nu uit entiteitsmodel i.p.v. DQ-join |

---

## Referenties

- `docs/framework/latero-insights-lineage-integration.md` (extern, door Latero team beheerd)
- Bestaande implementatie: `src/app/(dashboard)/lineage/`
- Bestaande typen: `src/lib/adapters/types.ts`
