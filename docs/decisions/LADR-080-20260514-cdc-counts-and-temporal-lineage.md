# LADR-080 — CDC Row Counts en Temporele Lineage (Time-Travel)

| Veld | Waarde |
|------|--------|
| **Status** | ACCEPTED |
| **Datum** | 2026-05-14 |
| **Auteur** | Leen van der Meer |
| **Gerelateerde vereisten** | LINS-028, LINS-029 |

---

## Context

Latero Meta Data Framework (Databricks route) ondersteunt Change Data Capture (CDC):
pipeline runs rapporteren niet alleen status en duur maar ook het exacte aantal
gewijzigde rijen (`rows_inserted`, `rows_updated`, `rows_deleted`, `rows_total`).

De API push-route in Latero Control had dit nog niet. Bovendien: zodra CDC-informatie
beschikbaar is, moet het mogelijk zijn om de lineage-graaf te bevragen zoals die
bestond op een willekeurig tijdstip in het verleden ("time-travel"), zodat incident
investigations terug kunnen kijken naar de staat van de graaf vóór een wijziging.

De keuze om een tweede databron via de API-route aan te sluiten maakte dit urgent:
die bron levert CDC-data en moet consistent worden opgeslagen.

---

## Beslissing

### 1. CDC row counts op meta.runs

Vier nullable `BIGINT`-kolommen worden toegevoegd aan `meta.runs`:

| Kolom | Betekenis |
|-------|-----------|
| `rows_inserted` | Nieuw ingevoegde rijen |
| `rows_updated` | Bijgewerkte rijen (CDC-specifiek) |
| `rows_deleted` | Verwijderde rijen (CDC-specifiek) |
| `rows_total` | Totaal verwerkte rijen |

**Nullable-semantiek:** `NULL` betekent "niet gerapporteerd door de bron", niet nul.
Bestaande runs houden `NULL` in alle vier kolommen — dit is correcte informatie.

Op `UPDATE` (run-refresh) worden waarden bewaard via `COALESCE($nieuw, bestaand)`:
een latere ingest zonder CDC-velden overschrijft eerder gerapporteerde CDC-waarden niet.

API-ingest: zowel `/api/v1/ingest` (event type `pipeline_run`) als
`/api/v1/pipeline-runs` accepteren de vier velden. Onbekende/negatieve waarden
worden stil genegeerd (`toNullableBigint`-helper).

### 2. SCD2 op meta.lineage_edges

`meta.lineage_edges` krijgt twee temporele kolommen:

| Kolom | Definitie |
|-------|-----------|
| `valid_from` | `TIMESTAMPTZ NOT NULL DEFAULT now()` — moment waarop de edge actief werd |
| `valid_to` | `TIMESTAMPTZ NULL` — moment waarop de edge inactief werd; `NULL` = nog actief |

**Partial unique index** vervangt de eerdere UNIQUE constraint:

```sql
CREATE UNIQUE INDEX idx_meta_lineage_edges_active_hop
  ON meta.lineage_edges (installation_id, source_dataset_id, source_layer,
                         target_dataset_id, target_layer)
  WHERE valid_to IS NULL;
```

Dit garandeert dat er maximaal één actieve versie van elke hop bestaat, maar staat
meerdere historische versies toe.

**UPDATE-then-INSERT patroon** in `writeMetaLineage`:
1. Probeer de actieve edge te updaten (`WHERE ... AND valid_to IS NULL`).
2. Als geen rij gevonden (rowCount === 0): nieuwe edge ingeseert met huidig `valid_from`.

Dit vervangt het eerdere `ON CONFLICT DO UPDATE`-patroon dat incompatibel is met
de partial unique index.

**Edge-sluiting** bij lineage-drift: `detectLineageDrift` in `change-detection.ts`
zet `valid_to = now()` op edges waarvan de bron-dataset verdwijnt uit een run.
Dit maakt de graaf correct voor point-in-time bevragingen.

### 3. Temporele lineage API (time-travel)

`GET /api/lineage` accepteert een optionele query-parameter `?as_of=<ISO-timestamp>`.

- **Zonder `as_of`:** alleen actieve edges (`valid_to IS NULL`), gefilterd op
  `last_observed_at` binnen het opgegeven datumbereik (ongewijzigd gedrag).
- **Met `as_of`:** edges waarbij `valid_from <= as_of AND (valid_to IS NULL OR valid_to > as_of)`.
  Het datum-bereikfilter wordt in dit geval niet toegepast — de graaf wordt teruggegeven
  zoals die bestond op het opgegeven tijdstip.

Validatie: de `as_of`-waarde wordt geparsed via `new Date()`. Ongeldige waarden
worden afgewezen met HTTP 400.

---

## Migraties

| Bestand | Inhoud |
|---------|--------|
| `infra/sql/init/054_runs_cdc_counts.sql` | `ALTER TABLE meta.runs ADD COLUMN IF NOT EXISTS ...` voor de vier CDC-kolommen |
| `infra/sql/init/055_lineage_edges_scd2.sql` | `valid_from`/`valid_to`, droppen van oude UNIQUE constraint, aanmaken van drie nieuwe indexen |

`infra/sql/schema.sql` is bijgewerkt als canonieke schemadefinitie.

---

## Alternatieven overwogen

**Aparte historietabel voor lineage-edges:** een `meta.lineage_edges_history`-tabel
voor historische versies, met de hoofdtabel alleen voor actieve edges. Verworpen
omdat SCD2 op de hoofdtabel eenvoudiger te bevragen is en minder applicatiecode vereist.

**Alleen `rowsTotal` opslaan:** CDC-granularity weggooien en alleen het totaal bewaren.
Verworpen: `rows_inserted` vs. `rows_updated` vs. `rows_deleted` is essentiële
informatie voor audit trails en CDC-validatie.

---

## Gevolgen

- `meta.runs` bevat vier extra nullable kolommen; bestaande queries zijn ongewijzigd.
- `meta.lineage_edges` heeft nu een SCD2-structuur; queries die de graaf bevragen
  moeten `WHERE valid_to IS NULL` toevoegen om alleen actieve edges te zien
  (de read-API doet dit automatisch).
- De `writeMetaLineage`-functie gebruikt een ander conflict-patroon; adapters die
  direct schrijven naar de tabel moeten dit respecteren.
- Lineage Explorer in de UI is ongewijzigd — het leest via `/api/lineage` dat de
  juiste filter toepast.
