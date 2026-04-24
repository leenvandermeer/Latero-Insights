# Latero — Normatieve vereisten

Dit document beschrijft de normatieve vereisten van het Latero Meta Data Control Framework. De vereisten zijn opgesplitst in vier categorieën: framework kern (LCORE), check library (LCHK), adapter contract (LADPT) en Databricks adapter (LDBX). Requirement-ID's zijn stabiele identifiers en worden niet hernummerd.

---

## Framework kern vereisten (LCORE)

### LCORE-010 — EventLogger interface

Het framework moet een abstracte basisklasse `EventLogger` definiëren die het contract voor alle platform adapters specificeert. De interface declareert precies drie abstracte methoden:

- `pipeline_run(run_status, input_refs, output_refs, run_metrics, errors, file_events, run_context, timestamp_utc)`
- `data_quality_check(check_id, check_status, check_result, run_context, timestamp_utc)`
- `lineage(source_type, source_ref, target_type, target_ref, lineage_evidence, timestamp_utc, source_entity, target_entity)`

**Acceptatiecriteria:**

- `EventLogger` is importeerbaar vanuit `latero` en vanuit `latero.framework`.
- Directe instantiëring van `EventLogger` gooit `TypeError`.
- Een subklasse die niet alle drie abstracte methoden implementeert gooit `TypeError` bij instantiëring.
- De policy engine roept uitsluitend `data_quality_check` aan op de logger en is niet afhankelijk van enig attribuut of methode buiten de interface.

---

### LCORE-020 — Policy engine

Het framework moet een `register_dq_check` functie bieden als enkel registratiepunt voor alle data quality checks. De functie lost de check policy op voor de gegeven stap en check-ID vanuit het gevalideerde Latero runtime contract, past de enforce-of-observe-beslissing toe, delegeert het wegschrijven van evidence naar de logger, en retourneert `True` bij slagen of `False` bij mislukken in `observe`-modus. Als de policy voor de gevraagde stap en check-ID ontbreekt, gooit de functie onmiddellijk `ValueError` — geen stille gaten in policydekking.

**Acceptatiecriteria:**

- Gooit `ValueError` bij een `check_id` die niet aanwezig is in de effective policy voor de gegeven `step`.
- Roept `logger.data_quality_check(...)` precies één keer aan per aanroep, ongeacht modus of uitkomst.
- Het `check_result` dict bevat `severity` en `mode` velden opgelost vanuit de policy.
- Bij `ok=True` retourneert de functie `True` zonder te gooien.
- Aanroep zonder `ok` of `check_status` gooit `ValueError`.

---

### LCORE-030 — Severity mapping

De policy engine mapt het `severity`-veld op een Python logniveau bij mislukken in `observe`-modus:

| Severity | Logniveau |
| --- | --- |
| `high` | `logging.ERROR` |
| `medium` | `logging.WARNING` |
| `low` | `logging.WARNING` |

`mode: enforce` gooit altijd `RuntimeError`, ongeacht severity. De severity-mapping geldt uitsluitend voor `observe`-modus.

**Acceptatiecriteria:**

- Een falende check met `mode: observe, severity: high` logt op `ERROR`-niveau en gooit niet.
- Een falende check met `mode: enforce` op elke severity gooit `RuntimeError` zonder een waarschuwing te loggen.

---

### LCORE-040 — Coverage run finalisatie

Het framework moet een `finalize_dq_coverage_run(step, started_at, *, status)` functie bieden die een dict retourneert met DQ-timingmetadata voor een pipeline-stap. De aanroepende notebook voegt dit dict samen in het `input_refs`-argument van het finale `pipeline_run`-aanroep.

**Acceptatiecriteria:**

- Retourneert een `dict` met de sleutels `status`, `dq_step`, `dq_started_at_utc` en `dq_finished_at_utc`.
- `dq_finished_at_utc` is een UTC ISO 8601-tijdstempel gegenereerd op het moment van aanroep.
- De functie roept geen logger-methode aan en heeft geen bijwerkingen.

---

### LCORE-050 — Idempotentie

Het framework moet pipeline-heruitvoeringen niet verhinderen. Functies mogen geen globale toestand bewaren tussen aanroepen, resultaten cachen over runs heen, of bijhouden of een bepaalde check al is geregistreerd.

**Acceptatiecriteria:**

- Twee keer `register_dq_check` aanroepen met dezelfde argumenten produceert twee onafhankelijke aanroepen van `logger.data_quality_check`.
- De framework-kernmodule importeert geen muteerbare globale toestand die blijft bestaan tussen testgevallen in een unit-testsuite.
- `finalize_dq_coverage_run` retourneert een afzonderlijk `dq_finished_at_utc` bij elke aanroep.

---

### LCORE-060 — Geen platformkoppeling

Het framework-kern mag uitsluitend Python standaard bibliotheekmodules importeren. Geen PySpark, `dbutils`, Databricks SDK, Snowflake Python Connector of enig ander platform-specifiek pakket.

**Acceptatiecriteria:**

- `import latero.framework` slaagt in een gewone Python-omgeving zonder extra pakketten.
- `latero/framework.py` bevat geen `import`-statement dat verwijst naar `pyspark`, `databricks`, `snowflake` of enig pakket buiten de Python standaard bibliotheek.
- Unit tests voor `latero/framework.py` draaien zonder Spark-sessie of Databricks-omgevingsvariabelen.

---

### LCORE-070 — Validatie voor runtime

Latero runtime mag pas beginnen met policy-resolutie of adapter-bootstrap na succesvolle validatie van de product-config. Schema-validatie, adapter-profiel-validatie en effective policy-resolutie moeten compleet zijn voordat framework runtime-functies worden aangeroepen. Repository-specifieke bridges die legacy consumer-config vertalen naar het Latero runtime contract leven buiten `latero/framework.py`.

**Acceptatiecriteria:**

- Productdocumentatie definieert een validatiereeks die plaatsvindt vóór `register_dq_check` en vóór adapter-bootstrap.
- Ontbrekende of ongeldige adapter-profielverwijzingen worden behandeld als configuratiefouten vóór runtime-logging begint.
- Effective-policy-resolutie vindt uitsluitend plaats op gevalideerde config.

---

## Check library vereisten (LCHK)

### LCHK-010 — Pakketstructuur

De check library is een sub-pakket van `latero` op `latero/checks/`. Elke checkcategorie is een afzonderlijke module. Alle publieke check-functies worden opnieuw geëxporteerd vanuit `latero/checks/__init__.py`. Het aanwezig zijn of ontbreken van `latero/checks/` heeft geen invloed op het framework-kern, de policy engine of enige adapter.

**Acceptatiecriteria:**

- `from latero.checks import not_null, unique, row_count, schema_match, ingest_run_results` slaagt na installatie.
- Het verwijderen van `latero/checks/` veroorzaakt geen importfout in `latero.framework` of een adaptermodule.

---

### LCHK-020 — Uniform check-retourcontract

Elke check-functie retourneert precies `(ok: bool, details: dict)` als een twee-element tuple. De `details` dict bevat altijd minimaal `rule_id`, `expected` en `actual`. Een check-functie die niet kan evalueren (bijv. lege DataFrame, ontbrekende kolom) retourneert `(False, {...})` met een `error`-sleutel in `details`, en gooit niet.

**Acceptatiecriteria:**

- Elke check-functie retourneert een twee-element tuple `(bool, dict)`.
- De geretourneerde `details` dict bevat `rule_id`, `expected` en `actual` in elk codepad.
- Aanroepen van een check-functie met geldige invoer gooit nooit een uitzondering.

---

### LCHK-030 — Volledigheid checks

Module `latero/checks/completeness.py` (ook beschikbaar als `latero.checks.spark`):

- `not_null(df, column)` — slaagt als de kolom nul null-waarden bevat.
- `completeness_ratio(df, column, min_ratio)` — slaagt als de niet-null-ratio ≥ `min_ratio`.
- `no_empty_string(df, column)` — slaagt als de kolom nul lege-string-waarden bevat.
- `all_columns_present(df, expected_columns)` — slaagt als alle verwachte kolommen aanwezig zijn.
- `no_null_combination(df, columns)` — slaagt als geen rij nulls heeft in alle opgegeven kolommen tegelijk.

---

### LCHK-040 — Uniciteits-checks

- `unique(df, column)` — slaagt als alle waarden in de kolom uniek zijn.
- `unique_combination(df, columns)` — slaagt als alle combinaties van waarden over de kolommen uniek zijn.
- `no_duplicates(df, columns)` — alias voor `unique_combination`.

---

### LCHK-050 — Geldigheids-checks

- `value_in_set(df, column, allowed_values)` — slaagt als alle niet-null-waarden in `allowed_values` staan.
- `value_range(df, column, min_val, max_val)` — slaagt als alle niet-null-waarden in het bereik vallen.
- `regex_match(df, column, pattern)` — slaagt als alle niet-null-stringwaarden overeenkomen met het patroon.
- `not_negative(df, column)` — slaagt als alle niet-null-waarden ≥ 0 zijn.
- `string_length(df, column, min_len, max_len)` — slaagt als alle niet-null-strings de opgegeven lengte hebben.
- `date_format(df, column, fmt)` — slaagt als alle niet-null-stringwaarden als datum parsen in formaat `fmt`.
- `date_range(df, column, min_date, max_date)` — slaagt als alle niet-null-datum/tijdstempelwaarden in het bereik vallen.
- `cross_column(df, condition_expr)` — slaagt als geen rij de Spark SQL booleaanse expressie schendt.

---

### LCHK-060 — Volume-checks

- `row_count(df, min_count, max_count=None)` — slaagt als het rijenaantal binnen de grenzen valt.
- `row_count_delta(current_count, previous_count, max_delta_ratio)` — slaagt als de absolute relatieve wijziging ≤ `max_delta_ratio`. Accepteert eenvoudige integers, geen DataFrames.
- `partition_count(df, partition_column, min_count, max_count=None)` — slaagt als het aantal unieke waarden in de partitiekolom binnen de grenzen valt.
- `column_count(df, expected_count)` — slaagt als de DataFrame precies `expected_count` kolommen heeft.

---

### LCHK-070 — Schema-checks

- `schema_match(df, expected_schema)` — slaagt als het DataFrame-schema overeenkomt met `expected_schema` kolom voor kolom (naam en type).
- `no_schema_drift(df, expected_columns)` — slaagt als de DataFrame geen kolommen bevat die afwezig zijn in `expected_columns`.
- `column_type_match(df, column, expected_type)` — slaagt als de kolom het opgegeven Spark-datatype heeft.
- `no_extra_columns(df, expected_columns)` — alias voor `no_schema_drift`.

---

### LCHK-080 t/m LCHK-110 — Overige checks

Aanvullende check-modules:

- **Statistisch** (`latero.checks.spark`): `mean_in_range`, `std_in_range`, `median_in_range`, `skewness_check`
- **Referentiële integriteit** (`latero.checks.spark`): `referential_integrity`, `foreign_key_check`
- **Versheid** (`latero.checks.spark`): `max_date_not_older_than`, `min_date_not_newer_than`
- **Bestand** (`latero.checks.file`): `files_present`, `file_count_max`, `no_duplicate_hash`, `checksum_match`
- **Platform-neutraal** (`latero.checks.common`): `value_truthy`, `count_equals`, `list_subset`
- **dbt** (`latero.checks.dbt`): `ingest_run_results`

---

## Adapter contract (LADPT)

### LADPT-010 — Subklasse van EventLogger

Elke adapter moet `latero.framework.EventLogger` als subklasse nemen. De framework-kern gebruikt `isinstance`-controles in tests en de ABC-machinerie dwingt het interfacecontract af bij klassedefinitie.

**Acceptatiecriteria:**

- `issubclass(AdapterClass, EventLogger)` retourneert `True`.
- De adapter kan als `logger`-argument worden doorgegeven aan `register_dq_check` zonder `TypeError`.

---

### LADPT-020 — Alle drie abstracte methoden implementeren

Elke adapter biedt concrete implementaties van de drie abstracte methoden. Een no-op implementatie is uitsluitend toegestaan in testdoubles; productie-adapters schrijven elke aanroep naar een duurzame opslag.

**Acceptatiecriteria:**

- Instantiëring van de adapterklasse slaagt zonder `TypeError`.
- Aanroep van elk van de drie methoden met geldige argumenten gooit niet.

---

### LADPT-030 t/m LADPT-050 — Verplichte velden per methode

| Methode | Minimale verplichte velden |
| --- | --- |
| `pipeline_run` | `run_id`, `dataset_id`, `source_system`, `step`, `run_status`, `event_date`, UTC-tijdstempel |
| `data_quality_check` | `run_id`, `dataset_id`, `source_system`, `step`, `check_id`, `check_status`, UTC-tijdstempel |
| `lineage` | `run_id`, `dataset_id`, `source_system`, `step`, `source_type`, `source_ref`, UTC-tijdstempel |

Alle drie records zijn joinbaar via `run_id`.

---

### LADPT-060 — Constructor accepteert identiteitscontext

Elke adapter-constructor accepteert minimaal: `dataset_id`, `source_system`, `step`, `run_id` en `event_date`. Deze waarden worden bij instantiëring vastgesteld en aan elk record toegevoegd dat de adapter schrijft.

---

## Databricks adapter (LDBX)

### LDBX-010 — Schrijft naar Unity Catalog Delta-tabellen

De Databricks adapter schrijft alle metadata-records naar Delta-tabellen beheerd door Unity Catalog. De drie tabellen worden geadresseerd via hun fully qualified drie-delige Unity Catalog-namen. Alle schrijfacties gaan via `append_rows`, de schema-gedreven Delta writer.

**Acceptatiecriteria:**

- Elke aanroep van `pipeline_run` voegt precies één rij toe aan de `pipeline_runs` Delta-tabel.
- Elke aanroep van `data_quality_check` voegt precies één rij toe aan de `data_quality_checks` Delta-tabel.
- Elke aanroep van `lineage` voegt precies één rij toe aan de `data_lineage` Delta-tabel.

---

### LDBX-020 — Tafelnamen via get_log_tables

De adapter hardcoder nooit tafelnamen. Alle drie namen worden opgelost via `get_log_tables(...)` op een gevalideerd Latero adapter-profiel.

---

### LDBX-030 — Legt Databricks run-context vast

De adapter legt het Databricks job-ID en job-run-ID vast via `resolve_databricks_run_context(dbutils_obj)`. Buiten Databricks retourneert de functie een leeg dict en gooit niet.

---

### LDBX-040 — Bootstrap DDL

De DDL voor de drie meta-tabellen staat uitsluitend in `latero/adapters/databricks/bootstrap.sql`. Het bestand bevat `CREATE TABLE IF NOT EXISTS`-statements voor alle drie tabellen. Twee keer uitvoeren is idempotent.

---

### LDBX-050 — Orchestratie-utilities accepteren dbutils_obj=None

De orchestratie-utilities (`ensure_widgets`, `get_param`, `set_task_value`, `get_task_value`, `get_repo_root`, `resolve_databricks_run_context`) accepteren `dbutils_obj=None` en gooien geen niet-afgevangen uitzondering buiten een Databricks-notebookomgeving.

---

## Meta-tabel contract (LMETA)

De normatieve requirements voor de drie meta-tabellen staan in `docs/framework/requirements/meta-table-contract.md`.

Samenvatting schema v1.1 wijzigingen:

- `supplier` hernoemd naar `source_system` (productneutraal)
- `ERROR` als vijfde geldige waarde voor `check_status` — onderscheidt uitvoeringsfout van negatief resultaat
- `environment`, `schema_version`, `duration_ms`, `parent_run_id` toegevoegd aan `pipeline_runs`
- `policy_version` toegevoegd aan `data_quality_checks`
- `installation_id` toegevoegd aan Snowflake `data_lineage`
- `check_status` domein uitgebreid met `ERROR`
- `EventLogger.lineage()` uitgebreid met `source_attribute` en `target_attribute`

---

## Zie ook

- [Architectuur](architectuur.md) — runtimegrenzen en adaptercontract
- [Checks gebruiken](../implementatie/checks-gebruiken.md) — check library in de praktijk
- [Databricks](../implementatie/databricks.md) — Databricks-specifieke implementatie
