# LADR-059 — V2: Run als primaire observability-anchor

| Eigenschap | Waarde |
|-----------|--------|
| ID | LADR-059 |
| Datum | 2026-05-04 |
| Status | PROPOSED |
| Auteur | Leen van der Meer |
| Gerelateerd | LADR-040, LADR-058, LADR-060, LADR-061 |

---

## Context

In de huidige architectuur zijn **datasets** de primaire navigatie-eenheid.
De Pipelines-pagina toont runs gefilterd op datum, maar een run heeft geen eigen
detailpagina. DQ check resultaten zijn zichtbaar op de Quality-pagina, maar niet
gekoppeld aan de specifieke run die ze heeft voortgebracht. Lineage edges tonen
welke datasets verbonden zijn, maar niet vanuit welke run die verbinding werd
bevestigd of voor het eerst waargenomen.

De operationele realiteit van data-engineering teams is anders gestructureerd.
De dagelijkse workflow is:

1. "Wat is er vannacht gerund?"
2. "Welke runs zijn gefaald en waarom?"
3. "Welke DQ checks hoorden bij die run?"
4. "Welke datasets zijn geraakt?"

Deze vragen worden in V1 beantwoord door meerdere losse pagina's te combineren.
Er is geen coherente "run-scoped view" die alle relevante informatie samenbrengt.

### Huidige beperkingen

- `meta.runs` heeft alle benodigde kolommen (`run_id`, `status`,
  `environment`, `duration_ms`, `parent_run_id`), maar wordt nooit als
  navigatie-object gepresenteerd.
- `meta.run_io` legt vast welke datasets een run heeft gelezen en geschreven,
  maar dit wordt nergens in de UI getoond.
- `meta.quality_results.run_id` koppelt DQ checks aan runs, maar de UI toont
  checks gefilterd op datum, niet op run.
- `meta.lineage_edges.last_observed_run` registreert welke run een lineage edge
  heeft bevestigd, maar dit wordt niet getoond.

---

## Decision

**Maak `run` tot de primaire observability-anchor in Latero Control V2.**

Elke uitvoering van een pipeline wordt een eerste-klas navigatie-object met een
eigen URL, eigen detailpagina en contextuele koppelingen naar datasets, DQ checks
en lineage. De Run Explorer vervangt de huidige Pipelines-pagina als operationeel
dashboard.

### Run-scoped view: anatomie

Een run-detailpagina bevat:

| Sectie | Bron | Inhoud |
|--------|------|--------|
| Header | `meta.runs` | run_id, job, status, environment, duration, tijdstip |
| I/O Datasets | `meta.run_io` | Gelezen en geschreven datasets met layer en status |
| DQ Checks | `meta.quality_results WHERE run_id = ?` | Alle checks uitgevoerd in deze run |
| Lineage activiteit | `meta.lineage_edges WHERE last_observed_run = ?` | Edges die in deze run zijn bevestigd of voor het eerst gezien |
| Run-keten | `meta.runs WHERE parent_run_id = ?` | Child runs (stap-hiërarchie) |
| Vorige runs | `meta.runs WHERE job_id = ? ORDER BY started_at DESC` | Recente uitvoeringen van dezelfde job |

### Run Explorer: lijst

De Run Explorer (`/runs`) toont een chronologische tijdlijn van runs met:

- Timeline-weergave per dag (swimlane per job-naam)
- Statusindicatie per run (SUCCESS / FAILED / WARNING / RUNNING)
- Filters: datum range, status, environment
- Zoeken: job-naam, dataset-naam, run_id
- Groepering: per job, per dataset, per data product (V2 concept)

### Hiërarchische runs

`meta.runs.parent_run_id` ondersteunt orchestrator-patronen waarbij één
"master run" meerdere child runs triggert (één per dataset of stap).
In V2 wordt deze hiërarchie gevisualiseerd als een boomstructuur in de
run-detailpagina.

---

## API Changes

Nieuwe endpoint:

```
GET /api/runs/:run_id
```

Response:
```typescript
{
  run: RunDetail;       // meta.runs
  io: RunIO[];          // meta.run_io
  checks: DQResult[];   // meta.quality_results WHERE run_id
  lineage: LineageEdge[]; // meta.lineage_edges WHERE last_observed_run
  children: Run[];      // meta.runs WHERE parent_run_id
}
```

Uitbreiding van bestaand endpoint:
```
GET /api/pipelines?job_id=&dataset_id=&step=
```
(Filters uitgebreid met job_id en step voor gerichte queries.)

---

## Gevolgen

### Positief

- Operationele workflow sluit aan bij de mentale modellen van data-engineers
- DQ checks en lineage activiteit zijn contextueel verankerd aan een run
- Run-hiërarchie wordt zichtbaar (orchestrator chains)
- "What happened?" vragen zijn beantwoordbaar zonder meerdere pagina's te combineren

### Negatief / Risico's

- Vereist nieuwe detailpagina (`/runs/[run_id]`) als nieuwe route
- `GET /api/runs/:run_id` vereist een nieuwe API route met meerdere joins
- Bij hoge run-frequentie (>10k runs/dag) is de tijdlijn-weergave complex; paginering en virtualisatie zijn vereist
- `meta.run_io` wordt momenteel niet consistent gevuld door alle adapters; dit moet worden afgedwongen in de ingest-validatie

### Migratie

- Bestaande `/pipelines` route redirects naar `/runs` (301)
- Bestaande widgets die `usePipelines` gebruiken blijven werken; de hook hoeft niet te veranderen

---

## Alternatieven overwogen

**Alternatief A: Dataset-centric blijven, run context toevoegen als sidebar panel**
Afgewezen. Een sidebar panel lost het kernprobleem niet op: je kunt nog steeds
niet navigeren vanuit een run naar zijn DQ checks of I/O datasets.

**Alternatief B: Events-stream view (à la Kafka consumer)**
Afgewezen. De doelgroep zijn data-engineers, niet platform-operators.
Een event-stream is te granulier voor operationele observability.
