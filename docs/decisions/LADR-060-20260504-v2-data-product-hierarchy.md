# LADR-060 — V2: Data Product / Entity / Dataset hiërarchie

| Eigenschap | Waarde |
|-----------|--------|
| ID | LADR-060 |
| Datum | 2026-05-04 |
| Status | PROPOSED |
| Auteur | Leen van der Meer |
| Gerelateerd | LADR-040, LADR-058, LADR-059, LADR-061 |

---

## Context

De fundamentele spanningsbron in het huidige datamodel is dat Databricks-lagen
verschillende granulair zijn:

**Dataset-gedreven lagen (landing, raw, bronze):**
- Eén bronbestand of brontabel levert één dataset op
- De naam van de dataset is afgeleid van de bron: `cbs_arbeid`
- Op deze lagen is de 1:1 relatie vanzelfsprekend

**Entiteit-gedreven lagen (silver, gold):**
- Één bronze dataset wordt omgezet in N gespecialiseerde entiteiten
- Voorbeeld: `bronze::cbs_arbeid` → `silver::cbs_arbeid_transactions` + `silver::cbs_arbeid_persons`
- De namen zijn domein-specifiek en niet meer 1:1 aan de bron gekoppeld

Dit veroorzaakt drie concrete problemen:

1. **Status-ambiguïteit**: "Wat is de status van cbs_arbeid?" is niet eenduidig.
   Is dat de bronze dataset? De combinatie van alle silver entiteiten? De gold output?

2. **Lineage-graph verwarring**: De huidige graph toont nodes per
   `layer::entity_fqn`. Maar een gebruiker wil ook de vraag kunnen stellen:
   "Wat is het end-to-end pad van dit bronbestand naar de uiteindelijke goud-output?"

3. **DQ-check scoping**: DQ checks worden uitgevoerd op specifieke datasets
   (een layer-versie), maar rapportage-vragen gaan vaak over een entiteit of
   data product als geheel: "Zijn mijn CBS-data van goede kwaliteit?"

### Ontbrekend concept: de Data Product laag

Het LADR-058 model introduceert `lineage_group_id` als een groupering-attribuut.
Dit is de kiem van een "data product" concept, maar het is niet uitgewerkt als
eerste-klas entiteit met een naam, eigenaar, domein, en health score.

---

## Decision

**Introduceer een drietal hiërarchie: Data Product → Entity → Dataset.**

```
Data Product  (logisch, domein-gericht)
└── Entity    (functioneel concept, laag-onafhankelijk)
    └── Dataset (fysiek artifact, laag-specifiek)
```

### Laag 1: Data Product

Een **Data Product** is een logische groepering van gerelateerde entiteiten die
samen een domein-concept representeren. Voorbeelden:

- "CBS Arbeid" — bevat alle entiteiten die voortkomen uit de CBS arbeidsbron
- "Klantprofiel" — bevat alle entiteiten die klantgegevens bevatten

**Eigenschappen:**
- `data_product_id`: stabiele identifier (bijv. `cbs_arbeid`)
- `display_name`: mensleesbare naam
- `owner`: verantwoordelijke team of persoon
- `domain`: bedrijfsdomein (bijv. `HR`, `Finance`, `Operations`)
- `description`: optionele beschrijving
- `tags`: vrije key-value labels

**Health score**: Geaggregeerde status over alle entiteiten en lagen.

**Auto-detectie (Phase 1):**
De initiële implementatie detecteert data products automatisch via lineage
clustering: entiteiten die dezelfde upstream landing/raw datasets delen worden
gegroepeerd. De bestaande `lineage_group_id` is de seed voor dit mechanisme.

**Handmatige toewijzing (Phase 2):**
Operators kunnen data products aanmaken en entiteiten handmatig toewijzen of
hergroeperen via de admin interface.

### Laag 2: Entity

Een **Entity** is het logische dataset-concept onafhankelijk van laag.
Dit concept bestaat al in het huidige model (als `entity_fqn` in `LineageEntity`),
maar is niet persisteren in de database.

**V2 wijziging:**
Introduceer `meta.entities` als een expliciete tabel, niet langer alleen als
computed view over `meta.lineage_edges`.

```sql
CREATE TABLE meta.entities (
    entity_id        TEXT PRIMARY KEY,           -- bare FQN, bijv. "cbs_arbeid_transactions"
    data_product_id  TEXT REFERENCES meta.data_products(data_product_id),
    display_name     TEXT,
    description      TEXT,
    source_system    TEXT,
    tags             JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);
```

**Health score**: Geaggregeerde status over alle layer-datasets van deze entiteit.
Per laag: laatste run-status + DQ pass-rate.

**Cross-layer view**: Op de entity-detailpagina zie je alle lagen in één
tabel: landing → raw → bronze → silver → gold, elk met:
- Laatste run datum en status
- DQ pass rate (laatste 7 dagen)
- Aantal records (indien beschikbaar)
- Link naar de dataset-detailpagina

### Laag 3: Dataset

Een **Dataset** is een fysiek artifact op een specifieke laag en platform.
Dit is het huidige `meta.datasets` model met `dataset_id = "{entity_name}::{layer}"`.

Geen wijzigingen aan het dataset-model. Dataset blijft de kleinste eenheid
waaraan runs en DQ checks zijn gekoppeld.

---

## Status-aggregatie logica

| Niveau | Status |
|--------|--------|
| Dataset | Laatste run-status voor dit `dataset_id` |
| Entity | Aggregaat van alle datasets in de keten: FAILED als één laag FAILED, WARNING als één laag WARNING, SUCCESS als alle lagen SUCCESS, UNKNOWN als geen runs |
| Data Product | Aggregaat van alle entiteiten: dezelfde logica, één niveau hoger |

**End-to-end status**: Optionele strikte variant die alleen SUCCESS geeft als
de volledige keten van landing tot gold succesvol is afgerond in de laatste
run-cycle.

---

## Nieuwe Database Objecten

```sql
-- Data Products tabel
CREATE TABLE meta.data_products (
    data_product_id   TEXT PRIMARY KEY,
    display_name      TEXT NOT NULL,
    description       TEXT,
    owner             TEXT,
    domain            TEXT,
    tags              JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Entiteiten tabel (vervangt computed entity derivation)
CREATE TABLE meta.entities (
    entity_id         TEXT PRIMARY KEY,
    data_product_id   TEXT REFERENCES meta.data_products(data_product_id),
    display_name      TEXT,
    description       TEXT,
    source_system     TEXT,
    tags              JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Dataset-entiteit koppeling (FK van bestaande datasets tabel)
ALTER TABLE meta.datasets
    ADD COLUMN entity_id TEXT REFERENCES meta.entities(entity_id);
```

**Bootstrap-query**: Vul `meta.entities` initieel via lineage-afleiding:

```sql
INSERT INTO meta.entities (entity_id, data_product_id)
SELECT DISTINCT
    split_part(dataset_id, '::', 1) AS entity_id,
    lineage_group_id                 AS data_product_id
FROM meta.datasets
ON CONFLICT DO NOTHING;
```

---

## Nieuwe API Endpoints

```
GET /api/data-products                    — lijst van alle data products
GET /api/data-products/:id                — data product met entiteiten + health
GET /api/entities                         — lijst van alle entiteiten
GET /api/entities/:fqn                    — entiteit detail met cross-layer view
GET /api/entities/:fqn/runs               — run-geschiedenis per entiteit
GET /api/entities/:fqn/quality            — DQ checks per entiteit (alle lagen)
GET /api/entities/:fqn/lineage            — lineage subgraph voor deze entiteit
```

---

## Gevolgen

### Positief

- "Wat is de status van mijn CBS data?" is nu beantwoordbaar op drie niveaus
- Data product als concept sluit aan bij de DataMesh-beweging en DQ-rapportage-behoeften
- Entity health score maakt het mogelijk om een "data estate overview" te bouwen
- Gestandaardiseerde hiërarchie maakt integratie met externe catalogi (Atlan, DataHub) eenvoudiger

### Negatief / Risico's

- Bootstrap-query kan onjuiste entity-to-product toewijzingen maken bij complexe lineage
- Handmatige correctie via admin UI is vereist (fase 2)
- `meta.entities` tabel vereist initieel gevuld te worden; lege tabel geeft geen waarde
- Migration: bestaande `lineage_group_id` logica moet worden omgezet

### Backward Compatibility

- `GET /api/lineage/entities` blijft werken; de computed derivation wordt vervangen
  door een query op `meta.entities JOIN meta.datasets`
- `lineage_group_id` wordt deprecated ten gunste van `data_product_id`

---

## Alternatieven overwogen

**Alternatief A: Alleen dataset + data product (geen entity laag)**
Afgewezen. De silver/gold splitsing is inherent: één bronze dataset leidt tot
meerdere silver entiteiten. Zonder entity-laag is cross-layer health tracking
niet mogelijk zonder complexe heuristics.

**Alternatief B: Entity als computed view blijven (geen tabel)**
Afgewezen. Een computed view kan geen `display_name`, `owner`, of `tags` opslaan.
Dit blokkeert de data catalogus-functionaliteit die nodig is voor V2.

**Alternatief C: DataMesh full implementation (data contracts, ports, etc.)**
Te vroeg. Introduceer de hiërarchie nu; DataMesh-concepten als contracts en
self-serve infrastructure zijn fase 3+ werk.
