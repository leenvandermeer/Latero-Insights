# LADR-023 — MDCF `widget_field_values` tabel: specificatie en integratie

**Datum:** 2026-04-24  
**Status:** ACCEPTED  
**Auteur:** Leen van der Meer

---

## Context

De widget builder in Latero Control laat gebruikers custom widgets configureren via een UX wizard. Stap 1 (Measure) en de filterstap (Step 0) vragen om veldwaarden die de gebruiker handmatig moet intypen — bijvoorbeeld `SUCCESS`, `FAILED`, of `WARNING` voor het veld `run_status`. Zonder hints leidt dit tot typefouten en inconsistente configuraties.

De applicatie heeft een `useFieldValues()` hook en een `/api/field-values` API-route nodig die bekende veldwaarden aanbiedt. Deze waarden kennen twee bronnen:

1. **Statische defaults** — hardcoded in `src/lib/widget-field-reference.ts`. Dekken de meest voorkomende velden.
2. **Dynamische waarden** — afkomstig uit de MDCF-omgeving, zodat installatie-specifieke veldwaarden (bv. custom `source_system`-namen) ook als hint verschijnen.

Voor de dynamische bron is een nieuwe meta-tabel nodig in het Latero MDCF (Meta Data Controle Framework).

---

## Beslissing

### Nieuwe MDCF-tabel: `widget_field_values`

Het MDCF schrijft een tabel `widget_field_values` naar Unity Catalog. De applicatie leest deze tabel via de bestaande `DataAdapter`-interface.

#### Schema

```sql
CREATE TABLE IF NOT EXISTS <catalog>.<schema>.widget_field_values (
  field_name   VARCHAR NOT NULL,  -- technische veldnaam (bv. "run_status")
  field_value  VARCHAR NOT NULL,  -- ruwe waarde (bv. "SUCCESS")
  label        VARCHAR,           -- leesbare label (bv. "Success"); NULL = gebruik field_value
  CONSTRAINT pk_widget_field_values PRIMARY KEY (field_name, field_value)
);
```

#### Voorbeeld-rijen

| field_name   | field_value | label   |
|--------------|-------------|---------|
| run_status   | SUCCESS     | Success |
| run_status   | FAILED      | Failed  |
| run_status   | WARNING     | Warning |
| check_status | PASS        | Pass    |
| check_status | FAIL        | Fail    |
| source_type  | raw_file    | Raw file |
| hop_kind     | data_flow   | Data flow |
| hop_kind     | schema_ref  | Schema reference |

De tabel mag ook installatie-specifieke waarden bevatten die niet in de statische defaults staan, zoals eigen `source_system`-codes of `dataset_id`-waarden.

### Integratie in de applicatie

```
MDCF schrijft widget_field_values
          │
          ▼
DatabricksAdapter.getFieldValueReferences()
  → SELECT field_name, field_value, label FROM widget_field_values
  → groepeert per field_name → FieldReference[]
  → returns [] als tabel niet bestaat (graceful fallback)
          │
          ▼
GET /api/field-values
  → mergeFieldReferences(STATIC_FIELD_REFERENCES, mdcf_data)
  → dynamische waarden overschrijven / vullen aan op static defaults
  → in-memory cache met TTL 5 minuten
          │
          ▼
useFieldValues() hook (client-side, staleTime 5 min)
  → { refs, getValues(field) → FieldValueEntry[] }
          │
          ▼
widget-builder/page.tsx   →  <datalist> op whereValue en filter value inputs
widget-config-panel.tsx   →  <datalist> op whereValue en filter value inputs
```

### Merge-strategie

`mergeFieldReferences(base, overrides)`:
- Als een `field_name` uit `overrides` al in `base` bestaat, worden de `values` samengevoegd (union op `value`-sleutel, waarbij de override-label wint bij conflict).
- Velden die alleen in `overrides` staan worden toegevoegd.
- Velden die alleen in `base` staan blijven onveranderd.

### Statische defaults (fallback zonder MDCF-tabel)

Gedefinieerd in `src/lib/widget-field-reference.ts`:

| field        | Waarden                          |
|--------------|----------------------------------|
| run_status   | SUCCESS, WARNING, FAILED         |
| check_status | PASS, FAIL, WARNING              |
| hop_kind     | data_flow, schema_ref, audit_ref |
| source_type  | raw_file, database_table, api    |
| target_type  | bronze_table, silver_table, gold_table |

### Graceful fallback

Als `widget_field_values` niet bestaat (nieuwe installatie, cache-only mode), retourneert `getFieldValueReferences()` een lege array. De applicatie valt terug op de statische defaults. Er wordt geen fout getoond.

---

## Alternatieven overwogen

**Waarden afleiden uit de data zelf** — via een DISTINCT-query op `pipeline_runs.run_status` bv. Dit introduceert een extra SQL-round-trip per veld en koppelt hints aan de aanwezige data (lege tabel = geen hints). De expliciete tabel is voorspelbaarder.

**Hardcoded lijst uitbreiden** — simpeler, maar installatie-specifieke waarden (custom source systems, dataset-ids) kunnen niet worden opgenomen zonder code-wijzigingen per klant.

**Configureren via de instellingen-UI** — mogelijk als toekomstige uitbreiding, maar vereist een schrijfbare store voor veldwaarden. Buiten scope voor nu.

---

## Gevolgen

- Het MDCF-package schrijft `widget_field_values` als onderdeel van de meta-tabel-suite naast `pipeline_runs`, `data_quality_checks` en `data_lineage`.
- De tabel is read-only vanuit de applicatie.
- `DataAdapter.getFieldValueReferences()` is toegevoegd als methode aan de interface — bestaande adapters (bv. een toekomstige Snowflake-adapter) moeten deze methode implementeren.
- De `/api/field-values` route is niet opgenomen in de publieke API-surface (geen auth vereist, zelfde server-side beveiliging als andere routes).
- Hints in de UI zijn suggesties, niet validatie — gebruikers kunnen altijd een vrije waarde invoeren.
