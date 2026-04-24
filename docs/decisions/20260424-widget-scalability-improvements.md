# LADR-021 — Widget scalability: paginering, configureerbare drempel en failing datasets ranking

Date: 2026-04-24
Status: ACCEPTED
Owner: Layer2 Meta Insights product
Related: [LADR-016](20260422-progressive-disclosure-dashboard-ux.md), [LADR-020](20260424-widget-registry-rationalization.md)

---

## Context

Bij grotere installaties (datasets in de tientallen, DQ-checks in de duizenden per periode) liepen drie systeemwidgets tegen schaalbaarheidslimieten aan:

**DQ Checks Table** — een harde `.slice(0, 50)` in de component. Bij meer dan 50 checks in het geselecteerde datumbereik waren de resultaten buiten de top-50 onzichtbaar, inclusief potentieel kritieke failures die laat in de alfabetische sortering vallen.

**DQ Pass Rate Trend** — de 95%-referentielijn was hardcoded. Verschillende teams hanteren andere SLA-drempels (80%, 90%, 99%). Een hardcoded lijn was misleidend voor teams met een afwijkende target.

**Runs by Pipeline / geen failing-datasets widget** — het systeem had geen widget die datasets rangschikt op DQ-faalpercentage. De bestaande `runs-by-pipeline` widget sorteert op run-volume (drukste pipelines), niet op risico. Voor data-kwaliteitsanalyse is de faalrate per dataset het relevantere signaal.

Tegelijk hadden `PipelineRunsTableWidget` en `DatasetOverviewWidget` geen environment-filter, waardoor runs uit development, acceptance en production door elkaar weergegeven werden in multi-environment deployments.

---

## Decision

### 1. DQ Checks Table — paginering

De `.slice(0, 50)` wordt vervangen door client-side paginering met een vaste paginagrootte van 50. Een footer toont de huidige pagina, het totaal aantal pagina's, en het totale aantal checks. Bij wisselen van sorteerkolom springt de tabel terug naar pagina 1.

Rationale voor 50 per pagina: de tabel heeft al een sorteerbare header; de meest relevante checks zijn door sortering altijd bereikbaar. Serverside paginering is niet nodig omdat de volledige dataset al in de TanStack Query cache staat.

### 2. DQ Pass Rate Trend — configureerbare target

De hardcoded `y={95}` referentielijn wordt een `useState(95)` met een inline number input (0–100) in de widget-header. De waarde is sessie-lokaal en reset bij page reload. Persistentie over sessies heen valt buiten scope van deze ADR.

Rationale: de widget-props interface ondersteunt geen vrije configuratieparameters voorbij `from`, `to`, en `titleOverride`. Een in-widget control is de lichtste oplossing zonder het widget-definitiemodel te hoeven uitbreiden.

### 3. Environment filter in tabel-widgets

`PipelineRunsTableWidget` en `DatasetOverviewWidget` krijgen een environment-dropdown in hun header. De beschikbare opties worden afgeleid uit de actuele API-respons; de dropdown is alleen zichtbaar als er meer dan één unieke omgeving aanwezig is. In `DatasetOverviewWidget` reset een environment-wisseling ook de dataset-selectie.

### 4. Nieuwe widget: Failing Datasets

Een nieuwe systeemwidget `failing-datasets` toont een horizontale bar chart van de top-10 datasets gerangschikt op DQ-faalpercentage (gefaalde checks / totale checks). Bars zijn gekleurd met aflopende rode intensiteit. De tooltip toont zowel het percentage als het absolute aantal (`12% · 6 / 50`).

Datasets zonder enige fout worden niet getoond (filter op `failed > 0`). Dit houdt de widget gefocust op risico en voorkomt ruis voor gezonde datasets.

---

## Consequences

- De DQ Checks Table is nu volledig doorzoekbaar voor alle checks in de gekozen periode, ongeacht volume.
- De DQ Trend widget is bruikbaar voor teams met afwijkende SLA-drempels zonder code-aanpassing.
- Dashboard-gebruikers in multi-environment deployments kunnen production-runs isoleren van development-runs in de bestaande tabel-widgets.
- De nieuwe Failing Datasets widget vult een analytisch gat: welke datasets hebben de hoogste faalrate, los van volume.

---

## Implementation Notes

**DQ Checks Table** (`dq-checks-table-widget.tsx`):
- Added `PAGE_SIZE = 50` constant and `page` state.
- Sorting is memoized with `useMemo` (was previously inline).
- Pagination footer uses `ChevronLeft` / `ChevronRight` from Lucide; only rendered when `totalPages > 1`.
- Header count now shows total `sorted.length` instead of `rows.length`.

**DQ Trend** (`dq-trend-widget.tsx`):
- Added `useState(95)` for `target`.
- `CardHeader` extended with an inline `<input type="number">` for the target value, clamped to 0–100.
- `ReferenceLine y` and label are now derived from `target`.

**Environment filter**:
- `PipelineRunsTableWidget`: `envFilter` state + `environments` derived from `allRuns`. Select is hidden when `environments.length === 0`.
- `DatasetOverviewWidget`: `envFilter` state + `environments` memo from raw pipeline data. Scope is applied before `latestPipelineStepRuns()` so the deduplication respects the environment boundary.

**Failing Datasets** (`failing-datasets-widget.tsx`):
- New file. Uses `useQuality(from, to)`.
- Groups by `dataset_id`, computes `failRate = failed / total * 100`.
- Sorts by `failRate` descending, then `failed` descending as tiebreaker.
- Slices to `TOP_N = 10`. Labels truncated to 20 characters.
- Registered in `registry.ts` as category `"chart"`, default size `6×4`.

---

## Follow-up Backlog

1. Persist the DQ target threshold per widget instance (requires extending the widget definition model — see LADR-007).
2. Add an environment filter to the DQ Checks Table widget for consistency.
3. Consider server-side paginering for the DQ Checks Table when datasets exceed 10,000 checks per period.
