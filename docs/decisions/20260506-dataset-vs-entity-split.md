# LADR-064 — Dataset vs Entity: conceptueel model en structurele scheiding

**Datum:** 2026-05-06  
**Status:** ACCEPTED  
**Raakt:** `infra/sql/`, `web/src/lib/`, Databricks `lineage_projector`, `lineage_entities_current`

---

## Context

In een medallion-architectuur (landing → raw → bronze → silver → gold) heeft het begrip
"dataset" twee fundamenteel verschillende betekenissen die in het huidige model worden
samengevat in één tabel (`meta.datasets`) en één concept (`dataset_id`):

| Laag | Wat het is | Karakteristiek |
|------|-----------|---------------|
| landing | Fysiek bestand of bron-snapshot | 1-op-1 met bron |
| raw | Gearchiveerde kopie | 1-op-1 met bron |
| bronze | Lichte transformatie | 1-op-1 met bron, dezelfde naam |
| silver | **Business entiteit** | **1-op-velen** vanuit bronze |
| gold | **Business entiteit** | **1-op-velen** vanuit silver/bronze |

Een bronze dataset `cbs_arbeid` kan leiden tot meerdere silver-entiteiten:
`gemeente_arbeid`, `arbeidsmarkt_regionaal`, etc. In het huidige model is dit
**niet uitdrukbaar** — er is geen bridge-tabel en er is geen typeonderscheid.

### Concreet aangetroffen problemen

**In `meta.datasets` (Postgres):**

```sql
-- Huidige query toont:
dataset_id              | fqn                    | object_name            | entity_id
cbs_arbeid::bronze      | cbs_arbeid             | cbs_arbeid             | cbs_arbeid
gemeente_arbeid::silver | gemeente_arbeid        | gemeente_arbeid        | gemeente_arbeid
silver_gemeente_arbeid::silver | silver_gemeente_arbeid | silver_gemeente_arbeid |
```

- `fqn` = zelfde als `object_name` — redundant voor niet-OL-systemen
- `dataset_name` (bare naam zonder layer) **ontbreekt** als expliciet veld
- `entity_id` is een zachte FK (geen REFERENCES) — niet enforced voor silver/gold
- Silver/gold entries zitten in dezelfde tabel als landing/raw/bronze zonder typeonderscheid

**In `workspace.meta.lineage_dataset` (Databricks):**
- `source_entity` en `target_entity` worden gebruikt voor zowel fysieke datasets
  als business-entiteiten — geen type-onderscheid
- `dataset_id` = `lineage_group_id` (bare naam van de bron-dataset/entiteitsgroep)

**In `workspace.meta.lineage_entities_current` (Databricks):**
- `dataset_id` = `lineage_group_id` (eigenlijk de entiteitsgroepnaam, niet een fysiek dataset-id)
- `entity_fqn` = `environment.dataset_id.entity_name` (verwarrend: gebruikt "dataset_id"
  voor wat eigenlijk een entiteitsgroep-id is)
- Geen `source_dataset_names` array — welke bronze datasets een entiteit voeden is
  niet zichtbaar in de projected-state tabel

---

## Beslissing

### Conceptueel model

**Definitie:**
- **Dataset** = een fysiek data-object in landing, raw of bronze. Heeft een `dataset_name`
  (leesbare naam) en een `layer`. Eén dataset per naam per laag.
- **Entiteit** = een business-concept in silver of gold. Heeft een `entity_name`.
  Een entiteit kan worden gevoed door **één of meer** bronze datasets (1-to-many fan-out)
  én door **één of meer** silver entiteiten (fan-in voor gold).
- **`source_system`** = het bronsysteem van de data (bijv. CBS, BRP, latero-pipeline)

### Naamgeving conventies (normatief)

| Veld | Definitie | Voorbeeld |
|------|-----------|---------|
| `dataset_name` | Bare naam van de fysieke dataset, zonder layer | `cbs_arbeid` |
| `dataset_id` | Samengesteld: `{dataset_name}::{layer}` (PK-component) | `cbs_arbeid::bronze` |
| `entity_name` | Leesbare naam van de business-entiteit | `gemeente_arbeid` |
| `entity_id` | Unieke identifier van de entiteit (= entity_name voor auto-detected) | `gemeente_arbeid` |
| `source_system` | Bronsysteem van de data | `cbs`, `latero` |

### Postgres schema-wijzigingen (Latero Control)

**1. `meta.datasets`: voeg `dataset_name` toe**

```sql
ALTER TABLE meta.datasets
  ADD COLUMN IF NOT EXISTS dataset_name TEXT
    GENERATED ALWAYS AS (split_part(dataset_id, '::', 1)) STORED;
```

`fqn` blijft voor OpenLineage-compatibiliteit maar wordt niet langer gebruikt
in user-facing API-queries. `object_name` en `fqn` worden intern gehouden.

**2. `meta.entities`: voeg `entity_name` toe als expliciete kolom**

`display_name` is nullable. `entity_name` wordt het niet-nullable, canonieke
leesbare veld:

```sql
ALTER TABLE meta.entities
  ADD COLUMN IF NOT EXISTS entity_name TEXT;

UPDATE meta.entities
  SET entity_name = COALESCE(display_name, entity_id)
  WHERE entity_name IS NULL;

ALTER TABLE meta.entities
  ALTER COLUMN entity_name SET NOT NULL;
```

**3. Nieuw: `meta.entity_sources` bridge-tabel**

Drukkt de 1-to-many relatie uit: welke bronze (en/of silver) datasets voeden
een silver/gold entiteit.

```sql
CREATE TABLE meta.entity_sources (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  installation_id  TEXT        NOT NULL,
  entity_id        TEXT        NOT NULL,  -- FK → meta.entities
  source_dataset_id TEXT       NOT NULL,  -- FK → meta.datasets (dataset_id)
  source_layer     TEXT        NOT NULL,  -- bronze | silver
  first_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_observed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (installation_id, entity_id, source_dataset_id),
  FOREIGN KEY (installation_id, entity_id)
    REFERENCES meta.entities (installation_id, entity_id),
  CONSTRAINT meta_entity_sources_source_layer_check
    CHECK (source_layer IN ('bronze', 'silver'))
);
```

**4. `meta.lineage_edges`: type-onderscheid source/target**

`lineage_edges` verwijst nu naar datasets OF entiteiten. Voeg `source_kind`
en `target_kind` toe:

```sql
ALTER TABLE meta.lineage_edges
  ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'dataset'
    CHECK (source_kind IN ('dataset', 'entity')),
  ADD COLUMN IF NOT EXISTS target_kind TEXT NOT NULL DEFAULT 'dataset'
    CHECK (target_kind IN ('dataset', 'entity'));
```

Edges van bronze→silver krijgen `source_kind = 'dataset'`, `target_kind = 'entity'`.
Edges van silver→gold krijgen `source_kind = 'entity'`, `target_kind = 'entity'`.

### Databricks schema-wijzigingen

**`workspace.meta.lineage_entities_current`**: voeg toe:
- `source_dataset_names ARRAY<STRING>` — welke bronze/silver datasets deze entiteit voeden
- Hernoem `dataset_id` → `entity_group_id` in de volgende major versie
  (backward compat: beide velden aanwezig in transitieperiode)

**`workspace.meta.lineage_dataset`**: geen schema-wijziging vereist — bestaande velden
`source_entity`/`target_entity` blijven geldig als event-stream. De scheiding
wordt in de projector afgedwongen.

**`lineage_projector` notebook**: uitbreiden met:
- Extractie van `source_dataset_names` op basis van `source_layer IN ('bronze', 'silver')`
- Output in `lineage_entities_current.source_dataset_names`

### API / read-laag (Latero Control web)

- `getLineageEntitiesFromMetaStore`: gebruik `d.dataset_name` i.p.v. `d.fqn`
  voor user-facing naam; join met `meta.entity_sources` voor source_datasets
- `GET /api/lineage` response: voeg `source_datasets` array toe aan elke
  silver/gold LineageEntity
- `fqn` wordt **niet** meer teruggegeven in API-responses

### Frontend (Latero Control web)

De lineage-graph onderscheidt visueel:
- **Dataset-nodes** (landing/raw/bronze): rechthoek, huidige stijl
- **Entity-nodes** (silver/gold): afgeronde rechthoek of hexagonale chip,
  subtiel andere achtergrondkleur
- **1-to-many edges**: fan-out van één bronze node naar meerdere silver nodes
  is zichtbaar (bestaande graph support)

---

## Work Packages

### WP-1 — Postgres migratie (Latero Control)
**Scope:** `infra/sql/init/020_dataset_entity_split.sql`
- Voeg `dataset_name` generated column toe aan `meta.datasets`
- Voeg `entity_name` NOT NULL toe aan `meta.entities`
- Maak `meta.entity_sources` bridge-tabel
- Voeg `source_kind` / `target_kind` toe aan `meta.lineage_edges`
- Bootstrap: vul `entity_sources` vanuit bestaande `lineage_edges`
  (bronze→silver edges → entity_sources records)

**Geschatte omvang:** 1 SQL-migratiefile (~60 regels)
**Afhankelijkheden:** geen

### WP-2 — Sync-adapter update (Latero Control)
**Scope:** `web/src/lib/databricks-sync.ts`, `web/src/lib/meta-store-write.ts`
- `writeMetaLineage`: detecteer bron/doel-type op basis van layer
  (landing/raw/bronze = dataset, silver/gold = entity)
- Vul `meta.entity_sources` bij sync (bronze→silver hops)
- Zet `source_kind` / `target_kind` correct op lineage_edges

**Geschatte omvang:** ~40 regels wijziging
**Afhankelijkheden:** WP-1

### WP-3 — Databricks `lineage_projector` update
**Scope:** Databricks notebook `/lineage_projector`
- Voeg `source_dataset_names` CTE toe: aggregate bronze dataset-namen per entiteit
- Voeg kolom toe aan `lineage_entities_current`
- Zet `entity_group_id` alias naast `dataset_id` (transitieperiode)

**Geschatte omvang:** ~30 regels SQL in notebook
**Afhankelijkheden:** geen (Databricks-zijdig onafhankelijk)

### WP-4 — Read API update (Latero Control)
**Scope:** `web/src/lib/insights-saas-read.ts`
- `getLineageEntitiesFromMetaStore`: gebruik `dataset_name` i.p.v. `fqn`
- Join met `meta.entity_sources` voor `source_datasets` in response
- Verwijder `fqn` uit API-responses; voeg `dataset_name` en `entity_name` toe
- Update TypeScript types in `src/types/`

**Geschatte omvang:** ~80 regels SQL/TS wijziging
**Afhankelijkheden:** WP-1, WP-2

### WP-5 — Frontend lineage graph (Latero Control)
**Scope:** lineage-graph component(en)
- Onderscheid dataset-nodes (landing/raw/bronze) van entity-nodes (silver/gold)
- Visuele differentiatie via Tailwind tokens (kleur, border-radius)
- Toon `source_datasets` in entity detail-panel (tooltip of sidebar)

**Geschatte omvang:** ~50 regels TSX/CSS
**Afhankelijkheden:** WP-4

---

## Consequenties

### Positief
- `meta.datasets` is leesbaar: `dataset_name` geeft direct de bare naam
- 1-to-many relaties zijn expliciet en querybaar via `meta.entity_sources`
- API geeft `dataset_name` en `entity_name` terug in plaats van verwarrende `fqn`
- Lineage graph kan entity-nodes visueel onderscheiden van dataset-nodes
- Databricks projected-state bevat `source_dataset_names` per entiteit

### Negatief / risico
- WP-1 vereist een `ALTER TABLE` op `meta.lineage_edges` — korte lock, acceptabel
  voor single-tenant deployments
- Transitie `dataset_id` → `entity_group_id` in Databricks vereist afstemming
  met alle consumers van `lineage_entities_current`
- Bootstrap van `entity_sources` is best-effort vanuit `lineage_edges` —
  complete backfill vereist re-sync

### Niet gewijzigd
- `dataset_id` PK-format (`name::layer`) blijft ongewijzigd — geen breaking change
  voor bestaande sync-writes
- `fqn` kolom blijft aanwezig in `meta.datasets` (OpenLineage-compat)
- `meta.lineage_edges` FK-structuur (source/target → datasets) blijft integraal

---

## Gerelateerde ADRs
- LADR-058: Layer-scoped entity identity
- LADR-060: V2 Data Product / Entity / Dataset hierarchy (PROPOSED — dit ADR concretiseert WP-1 t/m WP-3)
- LADR-040: meta.* schema

---

## UX-overwegingen (voor UX Designer)

De volgende UI-elementen worden geraakt en vereisen review:

1. **Lineage graph nodes**: entity-nodes (silver/gold) moeten visueel anders zijn
   dan dataset-nodes (landing/raw/bronze). Voorstel: afgeronde rechthoek + subtiele
   achtergrondkleur op basis van design-token `--color-entity-node` (nader te bepalen).

2. **Lineage detail-panel**: toon bij een entity-node de `source_datasets` array
   als "gevoed door: [cbs_arbeid (bronze)]" in het detail-panel.

3. **Pipeline-monitor**: toon `dataset_name` als leesbare naam in de dataset-kolom;
   toon `entity_name` in de entiteit-kolom. Verwijder `fqn` als zichtbare waarde.

4. **Relatie-pijlen**: fan-out van bronze→silver (1 bron → meerdere entiteiten)
   moet herkenbaar zijn in de graph. Mogelijk via een intermediaire "split node"
   of kleur-coded edges.

---

## Requirements-impact (voor Requirement Engineer)

Nieuwe en gewijzigde LINS-requirements:

- **LINS-NEW**: Het systeem onderscheidt fysieke datasets (landing, raw, bronze)
  van business-entiteiten (silver, gold) in het datamodel en de API.
- **LINS-NEW**: Een fysieke bronze dataset kan meerdere silver/gold entiteiten
  voeden (1-to-many). Deze relaties zijn expliciet querybaar.
- **LINS-NEW**: `dataset_name` en `entity_name` zijn separate, leesbare velden
  in API-responses. `fqn` (OpenLineage internaal) is niet zichtbaar in de UI.
- **LINS-UPDATE**: De lineage API geeft per entiteit een `source_datasets` array
  terug met de bijdragende bronze datasets.
