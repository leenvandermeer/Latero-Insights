# LADR-058: Lineage Entity Model — Layer-Scoped Identity

**Datum:** 2026-05-04  
**Status:** Accepted  
**Auteur:** Tech Lead  

---

## Context

De lineage-pagina toont geen graph-edges, slechts 1 chain (in plaats van meerdere), en lege kolom-lineage. Root-cause analyse toont drie samenhangende architectuurfouten:

### Probleem 1: dataset_id zonder laag (layer)

In `meta.datasets` werd `dataset_id = entity_name` opgeslagen (bijv. `"cbs_arbeid"`). Eenzelfde entiteit bestaat in meerdere pipelinelagen (landing → raw → bronze → silver). Doordat alle laagversies dezelfde `dataset_id` delen:

- **Zelf-refererende edges**: `meta.lineage_edges` bevat `cbs_arbeid → cbs_arbeid` omdat source en target van een `landing → raw` hop dezelfde key hebben.
- **Layer-overwrite**: de laag-kolom in `meta.datasets` wordt overschreven bij iedere hop-write; eindresultaat is willekeurig.
- **Geen raw/bronze** zichtbaar in de graph: alle laagversies zijn samengesmolten tot 1 rij.

### Probleem 2: Strikte adjacency-check blokkeert geldige edges

`areAdjacentLineageLayers` eist `targetIdx - sourceIdx === 1`. Dit blokkeert:

- **Same-layer cross-entity hops** (`latero.landing → cbs_arbeid.landing`, diff=0): valide data-overdracht van bron-systeem naar landing-dataset.
- **Skip-layer hops** (`cbs_arbeid.landing → silver_gemeente_arbeid.silver`, diff=2): gebeurt wanneer raw/bronze niet in het observatievenster vallen.

### Probleem 3: BFS-chain-grouping via `latero` samenvoegen

`latero` (source system) heeft geen upstream maar veel downstreams. BFS-connected-components verbindt alle datasets via `latero` tot één giant component → "1 chain" i.p.v. één chain per data-product.

### Probleem 4: Kolom-lineage nooit gesynchroniseerd

`lineage_attributes_current` (Databricks) wordt niet gesynchroniseerd naar `meta.lineage_columns`. De Columns-tab toont altijd "0 column flows".

---

## Besluit

### D1 — Layer-Scoped Dataset Identity

`meta.datasets.dataset_id` = `"{entity_name}::{layer}"` (bijv. `"cbs_arbeid::bronze"`).

- `fqn` = bare entity-naam (bijv. `"cbs_arbeid"`) — gedeeld over alle laagversies, gebruikt als FQN in de graph.
- `group_id` = entity-naam (nieuw kolom) — gebruikt voor UI-groupering in chains en datasets-overzicht.
- Dit maakt iedere `(entity_name, layer)` combinatie uniek in `meta.datasets` en `meta.lineage_edges`.

### D2 — Ontspan Adjacency Constraint

`areAdjacentLineageLayers` → `targetIdx >= sourceIdx` (stijgende of gelijkblijvende laagindex). Backward-edges (silver → landing) blijven geblokkeerd. Zelf-loops zijn al geblokkeerd via `source === target` guard.

### D3 — Source-Only Entities Uitsluiten van Chain Grouping

In `buildConnectedChains`: entiteiten met `upstream_entity_fqns.length === 0` en meerdere downstreams (source systems zoals `latero`) worden niet gebruikt als BFS-brug tussen chains. Iedere data-product pipeline vormt daardoor een eigen chain.

### D4 — Column Lineage Synchroniseren

`databricks-sync.ts` roept `adapter.getLineageAttributes()` aan en schrijft de resultaten via `writeMetaColumnLineage()` naar `meta.lineage_columns`. `transformation_type` gebruikt OpenLineage vocabulary (DIRECT | INDIRECT | UNKNOWN).

---

## Consequenties

- **`meta.datasets`**: nieuw kolom `group_id TEXT`. Constraint op `transformation_type` in `meta.lineage_columns` bijgewerkt naar OL-vocabulaire.
- **`meta-ingest.ts`**: `writeMetaLineage` en `writeMetaPipelineRun` gebruiken `layerScopedId()`. Nieuw: `writeMetaColumnLineage()`.
- **`databricks-sync.ts`**: synct nu ook `lineage_attributes_current` en geeft `target_layer` door aan `writeMetaPipelineRun`.
- **Bestaande data**: `meta.datasets`, `meta.lineage_edges`, `meta.lineage_columns`, `meta.run_io` worden getrunceerd. `meta.runs`, `meta.quality_rules`, `meta.quality_results` blijven intact.
- **Re-sync vereist**: na migratie moet een volledige sync worden uitgevoerd via `POST /api/sync/databricks`.

---

## Alternatieven Overwogen

- *UUID als dataset_id met laag als attribuut*: minder leesbaar in debugging, geen voordeel.
- *Sync van `lineage_entities_current` als primaire bron*: upstream_fqns bevatten file-paden (geen entiteit-FQNs), niet bruikbaar voor graph-resolutie.
- *Geen wijziging aan chains*: 1 giant chain is een acceptabele degradatie — afgewezen wegens product requirement LINS-031 (pipeline chains per data-product).

---

## Aangetaste bestanden

| Bestand | Wijziging |
|---|---|
| `infra/sql/init/016_layer_scoped_dataset_ids.sql` | Nieuw — migratie |
| `web/src/lib/meta-ingest.ts` | Layer-scoped IDs, writeMetaColumnLineage |
| `web/src/lib/databricks-sync.ts` | Column lineage sync, target_layer |
| `web/src/lib/insights-saas-read.ts` | fqn als dataset_id, lineage_columns read |
| `web/src/app/(tenant)/(dashboard)/lineage/lineage-utils.ts` | areAdjacentLineageLayers |
| `web/src/app/(tenant)/(dashboard)/lineage/chains-view.tsx` | Source-only entity exclusion |
