# LADR-040 — meta.* schema: gestructureerd operationeel datamodel

**Datum:** 2026-05-04
**Status:** ACCEPTED
**Auteur:** Tech Lead
**Vervangt/supersedes (gedeeltelijk):** LADR-025 (ingest backend schema), LADR-015 (lineage entiteitsmodel)

---

## Context

Het huidige Postgres-schema bestaat uit drie event-tabellen (`pipeline_runs`,
`data_quality_checks`, `data_lineage`) die zijn aangemaakt als ingest-buffers.
Na meerdere iteraties zijn de volgende structurele problemen zichtbaar geworden:

### 1. Event-tabellen doen te veel tegelijk

Elke tabel mengt twee verantwoordelijkheden:
- **Definitie**: wie bestaat er, wat is de naam van een check, welke job is dit?
- **Executie**: wat is er gebeurd bij deze run, wat was het resultaat?

Er is geen scheiding tussen *entiteiten* (stabiel) en *events* (tijdelijk).
Dat maakt queries complex en slaat definities redundant op per event.

### 2. `payload JSONB` als catch-all

Alle drie event-tabellen hebben een `payload JSONB DEFAULT '{}'` die de volledige
raw event opslaat naast de gestructureerde kolommen. Dit veld is:
- Niet querybaar zonder JSON-extractie
- Niet type-safe; schema is impliciet per adapter-versie
- Een black box die debugging bemoeilijkt
- Niet gebruikt door de read-API's of dashboard-queries

### 3. `data_lineage` is te breed

Eén tabel doet nu vier dingen:
- Tabel-niveau lineage (source_entity → target_entity)
- Kolom-niveau lineage (wanneer `source_attribute`/`target_attribute` gevuld zijn)
- Run-koppeling (input/output van een specifieke run)
- Graph-definitie (upstream/downstream-relaties)

De `getLineageEntitiesFromSaaS`-query reconstrueert de graph runtime via een
5-staps CTE. Dat is fragiel, traag bij schaal, en herhaalt werk bij elke request.

### 4. Geen dataset-catalog

`dataset_id` is overal een losse `TEXT`-string zonder vaste definitie. Er is geen
tabel die zegt *wat* een dataset is (platform, FQN, type). Entity-metadata wordt
nu berekend vanuit de lineage-hops — dat is de omgekeerde verantwoordelijkheid.

### 5. Check-definities vs. check-resultaten gemengd

`data_quality_checks` slaat bij elke run de volledige check-definitie opnieuw op
(`check_name`, `check_category`, `severity`, `policy_version`). Definities zijn
stabiel; resultaten zijn tijdelijk. Het mengen ervan maakt trend-queries
onnodig complex.

---

## Beslissing

### Nieuw `meta.*` schema naast de bestaande tabellen

Er wordt een nieuw Postgres-schema `meta` aangemaakt. De bestaande `public.*`
event-tabellen blijven intact voor backward compatibility met adapters die nog
niet zijn bijgewerkt. Ingest-endpoints schrijven in fase 1 naar beide.

Het `meta.*` schema volgt het **OpenLineage**-model (Linux Foundation):
- `Job` — een herhaald, benoemd proces
- `Run` — één uitvoering van een Job
- `Dataset` — een data-asset (tabel, view, stream, bestand)
- Lineage als expliciete graph-edges, niet als event-reeks

### Schema-definitie

#### `meta.datasets` — Catalog van data-assets
```
dataset_id        TEXT        — logische identifier (stabiel)
installation_id   TEXT FK
fqn               TEXT        — catalog.schema.table of equivalent FQN
namespace         TEXT        — catalog.schema deel
object_name       TEXT        — tabel/view naam
platform          TEXT        — ICEBERG | DELTA | HIVE | JDBC | FILE | TOPIC
entity_type       TEXT        — TABLE | VIEW | STREAM | FILE | TOPIC
source_system     TEXT
first_seen_at     TIMESTAMPTZ
last_seen_at      TIMESTAMPTZ
PK: (installation_id, dataset_id)
```

#### `meta.jobs` — Pipeline/job definities
```
job_id          UUID PK
installation_id TEXT FK
job_name        TEXT        — stabiele naam (uniek per installation)
job_type        TEXT        — PIPELINE | SYNC | VALIDATION
dataset_id      TEXT        — logische groepering
UNIQUE: (installation_id, job_name)
```

#### `meta.runs` — Uitvoeringsinstanties
```
run_id          UUID PK
job_id          UUID FK → meta.jobs
installation_id TEXT FK
external_run_id TEXT        — Databricks of andere externe run ID
parent_run_id   UUID FK self — run-hiërarchie
step            TEXT
status          TEXT        — SUCCESS | FAILED | WARNING | RUNNING
environment     TEXT
started_at      TIMESTAMPTZ
ended_at        TIMESTAMPTZ nullable
duration_ms     BIGINT
run_date        DATE GENERATED
UNIQUE: (installation_id, external_run_id, step, run_date)
```

#### `meta.run_io` — Welke datasets een run leest/schrijft
```
id              UUID PK
run_id          UUID FK → meta.runs
installation_id TEXT FK
dataset_id      TEXT
role            TEXT CHECK (INPUT | OUTPUT)
observed_at     TIMESTAMPTZ
UNIQUE: (run_id, dataset_id, role)
```

Dit vervangt het event-aspect van `data_lineage`. De run-I/O-koppeling is
losgekoppeld van de graph-representatie.

#### `meta.quality_rules` — Check-definities (stabiel)
```
check_id        TEXT        — stabiele identifier uit adapter
installation_id TEXT FK
check_name      TEXT
check_category  TEXT        — schema | accuracy | completeness | freshness | uniqueness
severity        TEXT        — HIGH | MEDIUM | LOW
check_mode      TEXT        — FIXED | DYNAMIC | THRESHOLD
policy_version  TEXT
dataset_id      TEXT
PK: (installation_id, check_id)
```

#### `meta.quality_results` — Check-resultaten per run
```
result_id       UUID PK
check_id        TEXT FK → meta.quality_rules
run_id          UUID FK → meta.runs nullable
installation_id TEXT FK
status          TEXT        — SUCCESS | FAILED | WARNING
result_value    NUMERIC     — gemeten waarde
threshold_value NUMERIC     — drempelwaarde
message         TEXT
check_result    TEXT
executed_at     TIMESTAMPTZ
result_date     DATE GENERATED
UNIQUE: (installation_id, check_id, run_id, result_date)
```

#### `meta.lineage_edges` — Tabel-niveau lineage graph
```
edge_id               UUID PK
installation_id       TEXT FK
source_dataset_id     TEXT
target_dataset_id     TEXT
first_observed_run    UUID FK → meta.runs nullable
last_observed_run     UUID FK → meta.runs nullable
first_observed_at     TIMESTAMPTZ
last_observed_at      TIMESTAMPTZ
observation_count     INTEGER DEFAULT 1
UNIQUE: (installation_id, source_dataset_id, target_dataset_id)
```

**Sleutelkeuze:** dit is een upsert-model. Bij elke run wordt `last_observed_at`
en `observation_count` bijgewerkt. De graph hoeft niet meer runtime te worden
gereconstrueerd via CTE — een directe query op `meta.lineage_edges` volstaat.

#### `meta.lineage_columns` — Kolom-niveau lineage
```
column_edge_id        UUID PK
installation_id       TEXT FK
source_dataset_id     TEXT
source_column         TEXT
target_dataset_id     TEXT
target_column         TEXT
transformation_type   TEXT  — IDENTITY | AGGREGATION | DERIVED | FILTER | RENAME
first_observed_at     TIMESTAMPTZ
last_observed_at      TIMESTAMPTZ
UNIQUE: (installation_id, source_dataset_id, source_column, target_dataset_id, target_column)
```

Kolom-lineage is nu een eigen tabel, niet langer impliciet via nullable
`source_attribute`/`target_attribute` in `data_lineage`.

### Verwijdering van `payload JSONB`

De `meta.*` tabellen hebben geen `payload`-kolom. Alle velden die adapters sturen
zijn gemodelleerd als expliciete kolommen. De catch-all was nooit bevraagd door
read-APIs of dashboard-queries en biedt geen waarde.

### Migratiefasering

**Fase 1 — Parallel schrijven (dit ADR)**
- `meta.*` schema aanmaken via `013_meta_schema.sql`
- Ingest-endpoints schrijven naar `public.*` EN `meta.*` (upsert)
- Read-APIs worden omgeschreven om van `meta.*` te lezen

**Fase 2 — Deprecatie `public.*` event-tabellen**
- Wanneer alle adapters zijn bijgewerkt (te volgen via `adapter_version_log`)
- `public.data_lineage`, `public.data_quality_checks`, `public.pipeline_runs`
  worden gearchiveerd of verwijderd
- Ingest-endpoints schrijven alleen nog naar `meta.*`

---

## Overwogen alternatieven

### A — JSONB-payload structureren met typed facets (OpenLineage-stijl)
Behoud de huidige tabelstructuur maar vervang `payload` door typed `*_facets JSONB`
kolommen met een known schema per facet-type.

**Verworpen:** lost het definitie-vs-executie probleem niet op en introduceert
nog steeds impliciete schema's. De voordelen van expliciete kolommen wegen zwaarder.

### B — `data_lineage` splitsen zonder nieuwe entiteitstabellen
Alleen `data_lineage` opsplitsen in tabel-lineage en kolom-lineage, rest behouden.

**Verworpen:** lost het root-probleem niet op. Dataset-catalog en job-definitie
ontbreken dan nog steeds. Halvering van de migratiescope is een false economy.

### C — Volledig nieuwe schema zonder backward-compat periode
Directe vervanging: old tables droppen, nieuwe aanmaken.

**Verworpen:** adapters in het veld kunnen niet atomisch bijgewerkt worden.
Parallel-schrijven met gefaseerde deprecatie is de veiligere migratiestrategie.

### D — Externe catalog-tool (OpenMetadata, DataHub)
Inzetten van een volwaardige open-source data catalog voor entity-beheer.

**Verworpen:** past niet bij de single-tenant deployment filosofie van Latero
Control (CLAUDE.md: "Do not introduce a separate database"). Latero Control
is het operationele systeem; een aparte catalog-tool introduceert onnodige
infrastructuurafhankelijkheid.

---

## Gevolgen

| Aspect | Impact |
|--------|--------|
| Backward compat adapters | Geen breaking change: `public.*` tabellen blijven beschikbaar in fase 1 |
| Read-API vereenvoudiging | Lineage-graph queries: 5-staps CTE → directe join op `meta.lineage_edges` |
| `payload` veld | Verdwijnt in `meta.*`; blijft in `public.*` voor legacy |
| Ingest-endpoints | Schrijven naar beide schemas; upsert-logica voor `meta.jobs`, `meta.datasets`, `meta.quality_rules` |
| TypeScript types | `LineageHop` type blijft voor backward compat; nieuwe types per `meta.*` tabel |
| `lineage_evidence TEXT` | Vervangen door `meta.lineage_columns.transformation_type` (getypeerd) |
| `hop_kind` kolom | Vervalt: `meta.run_io` is altijd data_flow; context-hops modelleren als annotatie |

---

## Requirements mapping

| LINS | Requirement | Impact |
|------|-------------|--------|
| LINS-002 | Data adapter interface | Ingest-endpoints schrijven naar `meta.*` |
| LINS-003 | Multi-source adapter support | `meta.datasets.platform` maakt platform-herkomst expliciet |
| LINS-008 | Lineage visualisatie | Graph-queries vereenvoudigd via `meta.lineage_edges` |
| LINS-009 | Data kwaliteit zichtbaarheid | Definitie/resultaat scheiding via `meta.quality_rules` + `meta.quality_results` |

---

## Referenties

- [OpenLineage spec](https://openlineage.io/spec) — Job/Run/Dataset model
- `infra/sql/init/001_insights_saas_init.sql` — huidig schema
- `infra/sql/init/013_meta_schema.sql` — nieuwe tabellen (dit besluit)
- `src/lib/insights-saas-read.ts` — read-API die migreert naar `meta.*`
- LADR-025 — Insights SaaS ingest backend (gedeeltelijk superseded)
- LADR-015 — Lineage entiteitsmodel (gedeeltelijk superseded)
