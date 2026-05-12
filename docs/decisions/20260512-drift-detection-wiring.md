# LADR-077 — Drift Detection Wiring: schema- en lineage-drift operationeel

**Datum:** 2026-05-12
**Status:** ACCEPTED
**Auteur:** Leen van der Meer

## Context

`detectSchemaDrift` in `lib/change-detection.ts` was dode code. De functie bevroeg
`meta.datasets ORDER BY valid_from DESC LIMIT 2` om twee versies te vergelijken, maar de
tabel heeft een samengestelde primaire sleutel op `(installation_id, dataset_id, layer)`:
er bestaat maximaal één rij per dataset, dus de tweede rij werd nooit teruggegeven en de
vergelijking liet altijd leeg.

Daarnaast ontbrak een implementatie voor lineage-drift: als de upstream-inputs van een job
van run naar run veranderen, werd dat niet gedetecteerd.

## Beslissing

### 1 · `detectSchemaDrift` — inline before/after vergelijking

De functie accepteert nu `before` en `after` direct als parameters in plaats van zelf de
database te bevragen. `meta-ingest.ts` leest het huidige `object_name` vóór de upsert en
geeft beide waarden mee:

```typescript
export async function detectSchemaDrift(
  datasetId: string,
  installationId: string,
  before: { object_name: string | null },
  after: { object_name: string | null }
): Promise<void>
```

Er wordt een `change_events`-rij aangemaakt met `change_type = 'schema_drift'` en
`severity` op basis van de aard van de wijziging:
- `null → waarde`: informational (eerste registratie)
- `waarde → null`: significant (verdwenen)
- `waarde A → waarde B`: breaking (hernoemd)

### 2 · `detectLineageDrift` — nieuwe functie

Vergelijkt de INPUT-datasets van de huidige run met die van de vorige run van dezelfde job
via `meta.run_io`:

```typescript
export async function detectLineageDrift(
  jobId: string,
  currentRunId: string,
  installationId: string
): Promise<void>
```

Severity-logica:
- Meer dan 1 verwijderde input → `breaking`
- Precies 1 verwijderde input → `significant`
- Nieuwe input toegevoegd (zonder verwijdering) → `informational`

### 3 · Fire-and-forget in meta-ingest.ts

Alle drie drift-functies worden aangeroepen na afloop van een terminal run, via
`void fn().catch(() => {})` buiten de hoofd-try/finally:

```typescript
if (isTerminal) {
  void detectStatisticalDrift(params.datasetId, params.installationId).catch(() => {});
  if (capturedPrevObjectName !== null && capturedObjectName !== capturedPrevObjectName) {
    void detectSchemaDrift(...).catch(() => {});
  }
  if (capturedJobId && capturedRunUuid) {
    void detectLineageDrift(...).catch(() => {});
  }
}
```

Dit zorgt dat drift-detectie de ingest-response niet blokkeert en niet retrybaar hoeft te
zijn vanuit de client.

## Gevolgen

- Alle vijf change-types zijn nu operationeel:
  `ownership_drift`, `contract_drift`, `statistical_drift`, `schema_drift`, `lineage_drift`
- De `/changes` change-feed toont lineage-drift correct met "New upstream: X" /
  "Upstream removed: X" samenvatting
- Bestaande installaties zonder eerdere run-IO-data krijgen bij de eerste run geen
  lineage-drift event (geen vorige run om mee te vergelijken — correct gedrag)
