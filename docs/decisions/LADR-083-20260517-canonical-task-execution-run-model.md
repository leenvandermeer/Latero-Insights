# LADR-083 — Canonical task-execution run model

| Eigenschap | Waarde |
|-----------|--------|
| ID | LADR-083 |
| Datum | 2026-05-17 |
| Status | ACCEPTED |
| Auteur | Leen van der Meer |
| Gerelateerd | LADR-040, LADR-059, LADR-062, LADR-080 |

## Context

Latero Control gebruikte `meta.runs` als operationele run-anchor, maar de tabel
bevatte inmiddels meerdere Databricks-specifieke kolommen zoals
`dbx_job_run_id`, `dbx_task_run_id`, `task_key`, `attempt_number`,
`queue_duration_ms`, `setup_duration_ms`, `trigger` en `run_page_url`.

Dat maakte het run-model:

- te zwaar voor toekomstige bronnen zoals Snowflake
- ambigu op task-niveau wanneer meerdere taken in dezelfde orchestration-run zaten
- afhankelijk van Databricks-semantiek op het canonieke Latero-niveau

Tegelijk blijft Lakeflow voor Databricks wel de beste bron voor task-identiteit,
timing en orchestration-context.

## Beslissing

`meta.runs` wordt een minimale, generieke **task execution**-entiteit.

### Canonieke kolommen

De canonieke Latero-kolommen voor een run zijn:

- `run_id`
- `job_id`
- `installation_id`
- `external_run_id`
- `source_parent_run_id`
- `task_name`
- `status`
- `environment`
- `started_at`
- `ended_at`
- `duration_ms`
- `rows_inserted`
- `rows_updated`
- `rows_deleted`
- `rows_total`
- `run_facets`

### Korreldefinitie

Één rij in `meta.runs` betekent:

**één uitvoerbare taakstap binnen een bron-orchestration**

Niet:

- één hele Databricks job-run met meerdere tasks samengevouwen
- één bron-specifiek run-object met vendor-eigen semantiek

### Uniciteit

De canonieke sleutel wordt:

`(installation_id, external_run_id, task_name, run_date)`

Dit laat bronnen toe die:

- een unieke task-run-ID hebben in `external_run_id`, of
- alleen een run-ID plus taaknaam-combinatie hebben

## Verwijderde dedicated kolommen

De volgende dedicated kolommen verdwijnen uit `meta.runs`:

- `parent_run_id`
- `dbx_job_run_id`
- `dbx_task_run_id`
- `task_key`
- `attempt_number`
- `queue_duration_ms`
- `setup_duration_ms`
- `trigger`
- `run_page_url`

## Consequentie voor bronverrijking

Bronspecifieke runtime-details blijven toegestaan, maar alleen in `run_facets`.

Voor Databricks betekent dit:

- Lakeflow blijft bron voor timing en task-identiteit
- extra Databricks-context blijft beschikbaar via `run_facets`
- het canonieke model blijft identiek bruikbaar voor Snowflake en andere bronnen

## Mapping

### Databricks Lakeflow → Latero

| Lakeflow bron | Latero kolom |
|---|---|
| task run id | `external_run_id` |
| parent job/orchestration run id | `source_parent_run_id` |
| task key / task name | `task_name` |
| task status | `status` |
| start time | `started_at` |
| end time | `ended_at` |
| duration | `duration_ms` |
| overige source details | `run_facets` |

### OpenLineage / API ingest → Latero

| Ingest bron | Latero kolom |
|---|---|
| `run.runId` | `external_run_id` |
| `ParentRunFacet.run.runId` | `source_parent_run_id` |
| job name / task identifier | `task_name` |
| event lifecycle status | `status` |
| event timestamps | `started_at`, `ended_at`, `duration_ms` |
| overige facets | `run_facets` |

## Gevolgen

- Latero Control en Latero Runtime delen weer één generiek run-contract
- directe koppeling Control ↔ Runtime wordt eenvoudiger
- task-level visualisatie is niet langer afhankelijk van Databricks-specifieke velden
- breaking migration is expliciet toegestaan; historische compatibiliteit heeft nu geen prioriteit
