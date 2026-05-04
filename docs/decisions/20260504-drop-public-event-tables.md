# LADR-041 — Drop public.* event-tabellen

**Datum:** 2026-05-04
**Status:** ACCEPTED
**Auteur:** Tech Lead
**Supersedes:** LADR-025 (ingest backend schema), LADR-040 fase 3

---

## Context

Na implementatie van LADR-040 (meta.* schema) en fase 3 van de migratie
(ingest-endpoints schrijven uitsluitend naar meta.*, read-API's lezen
uitsluitend uit meta.*) zijn de drie originele event-tabellen uit
`001_insights_saas_init.sql` volledig obsoleet:

- `public.pipeline_runs`
- `public.data_quality_checks`
- `public.data_lineage`

Inclusief de bijbehorende indexes en de latere patch-migraties:
- `005_new_columns.sql` — enkel ALTER TABLE op deze drie tabellen
- `006_fix_sync_indexes.sql` — enkel DROP/CREATE INDEX op deze drie tabellen

Er is geen code meer in de applicatie die schrijft naar of leest van
deze tabellen. Ze vormen dode Postgres-oppervlakte in het schema.

---

## Beslissing

### 1. Nieuwe SQL-migratie `014_drop_event_tables.sql`

Drop de drie event-tabellen, hun indexes en de bijbehorende sync-indexes:

```sql
DROP TABLE IF EXISTS public.pipeline_runs CASCADE;
DROP TABLE IF EXISTS public.data_quality_checks CASCADE;
DROP TABLE IF EXISTS public.data_lineage CASCADE;
```

`CASCADE` zorgt dat eventuele foreign-key-referenties (er zijn geen bekende)
ook worden verwijderd.

### 2. Herschrijf `001_insights_saas_init.sql`

Verwijder de CREATE TABLE statements voor de drie event-tabellen en hun
indexen. `001` definieert voortaan alleen de blijvende kern:

- `insights_installations`
- `ingest_audit`
- pgcrypto extension

### 3. Verwijder `005_new_columns.sql` en `006_fix_sync_indexes.sql`

Beide bestanden bevatten uitsluitend patches op de nu-gedropte tabellen.
Ze worden uit de init-reeks verwijderd.

---

## Alternatieven overwogen

**Behoud als archief-tabellen** — verworpen. Lege tabellen zonder
code-koppeling zijn ruis. Historische data is al gemigreerd naar meta.*
via de fase 1/2/3 parallel-schrijf- en lees-aanpak.

**Rename naar `_deprecated_*`** — verworpen. Geen toegevoegde waarde als
geen enkel endpoint ernaar wijst.

---

## Gevolgen

- `infra/sql/init/` bevat voortaan 11 actieve init-bestanden (001–004, 007–014)
- Nieuwe installaties starten direct met het meta.* datamodel
- Bestaande installaties die nog pipeline_runs / data_quality_checks /
  data_lineage data hebben: die data is niet meer leesbaar na de drop.
  Operatoren die historische data willen bewaren moeten een backup maken
  vóór uitvoering van `014_drop_event_tables.sql`.

---

## Requirements

Geen nieuw LINS-requirement. Dit is afsluiting van de migratie gestart
onder LADR-040.
