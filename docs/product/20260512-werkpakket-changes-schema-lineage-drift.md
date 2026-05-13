# Werkpakket: Schema Drift + Lineage Drift detectie

**Datum:** 2026-05-12  
**Status:** Open  
**Prioriteit:** Medium  
**Gerelateerd:** LINS-042 (change detection engine), `/changes` feed

---

## Aanleiding

De `/changes` feed heeft na de sprint van 2026-05-12 drie van de vijf drift-typen
operationeel: ownership drift, contract drift, en statistical drift (nu actief
getriggerd na elke terminale pipeline run). Schema drift en lineage drift zijn
gedefinieerd in `change-detection.ts` maar genereren geen events omdat het
onderliggende signaal ontbreekt.

---

## Item 1 — Schema drift activeren

### Huidige situatie

`detectSchemaDrift(datasetId, installationId)` in `web/src/lib/change-detection.ts`
vergelijkt `before.object_name` en `after.object_name` uit `meta.datasets`. De
functie is correct geïmplementeerd maar wordt nooit aangeroepen.

### Ontbrekende bouwstenen

1. **Snapshot-tabel** — schema drift vereist een historische baseline. De huidige
   `meta.datasets` tabel slaat enkel de actuele waarden op. Vergelijken vereist
   minimaal één eerdere snapshot.

   Voorstel: voeg een `meta.dataset_snapshots` tabel toe:
   ```sql
   CREATE TABLE meta.dataset_snapshots (
     snapshot_id   BIGSERIAL PRIMARY KEY,
     dataset_id    TEXT        NOT NULL,
     installation_id TEXT      NOT NULL,
     snapshot_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
     object_name   TEXT,
     platform      TEXT,
     column_count  INT,
     payload       JSONB
   );
   CREATE INDEX ON meta.dataset_snapshots (installation_id, dataset_id, snapshot_at DESC);
   ```

2. **Snapshot trigger** — neem een snapshot na elke succesvolle sync of
   pipeline run (vergelijkbaar met de statistical drift trigger in
   `writeMetaPipelineRun`).

3. **Trigger in meta-ingest** — roep `detectSchemaDrift` aan vanuit
   `writeMetaPipelineRun` (fire-and-forget, zelfde patroon als statistical drift).

### Acceptatiecriteria

- Na twee opeenvolgende runs met een gewijzigde `object_name` verschijnt een
  `schema_drift` event in `meta.change_events` met severity `significant`.
- Het event is zichtbaar in de `/changes` feed met een leesbare summary via
  `buildSummary`.
- Geen breaking change in bestaande pipeline run ingest.

---

## Item 2 — Lineage drift activeren

### Huidige situatie

`lineage_drift` staat als change type geregistreerd in `TYPE_LABELS` in de UI
en in de `change_events` tabel, maar `change-detection.ts` bevat geen
`detectLineageDrift` implementatie. Er zijn geen events voor dit type.

### Ontbrekende bouwstenen

1. **Definitie van "lineage drift"** — formaliseren wat een relevante wijziging is.
   Kandidaten:
   - Een nieuwe upstream input dataset verschijnt voor een bestaande job
   - Een bestaande input dataset verdwijnt (breaking)
   - Het aantal hops in de lineage verandert significant

2. **Implementatie `detectLineageDrift`** in `change-detection.ts`:
   - Query: vergelijk huidige `meta.run_io` entries (role = INPUT) voor een job
     met de vorige run van dezelfde job.
   - Classificeer: nieuwe input = `informational`, verwijderde input = `significant`,
     meerdere verdwijningen of kritieke dataset = `breaking`.

3. **Trigger** — aanroepen na upsert van `meta.run_io` in `writeMetaPipelineRun`.

### Acceptatiecriteria

- Als een job voor het eerst een nieuwe input dataset krijgt, verschijnt een
  `lineage_drift` event met severity `informational`.
- Als een bestaande input dataset wegvalt, severity `significant`.
- Summary in de `/changes` feed toont "Nieuwe upstream: X" of "Upstream weggevallen: X".

---

## Niet in scope

- Kolom-niveau schema drift (vereist column catalogus integratie — apart werkpakket).
- Cross-installatie lineage vergelijking.
- Retroactieve drift detectie over historische runs.

---

## Volgorde van uitvoering

1. Schema drift snapshot tabel + SQL migratie
2. Schema drift trigger in meta-ingest
3. Lineage drift implementatie + trigger
4. Handmatig testen via `/api/v1/pipeline` ingest
5. Verificatie in `/changes` feed
