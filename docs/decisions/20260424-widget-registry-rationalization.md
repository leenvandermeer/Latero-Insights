# LADR-020 — Widget Registry Rationalization: verwijderen van redundante counter widgets

Date: 2026-04-24
Status: ACCEPTED
Owner: Layer2 Meta Insights product
Related: [LADR-007](20260418-dashboard-builder-model.md), [LADR-008](20260418-dashboard-builder-implementation.md), [LADR-016](20260422-progressive-disclosure-dashboard-ux.md)

---

## Context

Het widget-register had 24 systeemwidgets gegroeid tot een grote flat list die moeilijk te overzien was voor gebruikers die een dashboard willen samenstellen. Een technische review toonde dat zes counter-widgets semantisch redundant waren:

- `success-runs` — afleidbaar als `total-runs − failed-runs − warning-runs`; de `pipeline-status` chart toont hetzelfde per dag.
- `warning-runs` — laag signaal op zichzelf; de stacked bar chart dekt dit al.
- `total-dq-checks` — ruwe count zonder context; de `pass-rate` widget is informatief.
- `success-dq-checks` — directe afleiding van `total − failed − warning`.
- `unique-pipelines` — statisch getal dat niet verandert per datumselectie; thuishorend op een About-pagina.
- `unique-check-types` — groepeert op `check_id` (instantie-key, niet het check-type); meet daardoor het verkeerde concept.

Tegelijk was de custom widget builder al in staat om vergelijkbare counters te maken via `count` en `count_where` measures met visual type `counter`. Gebruikers kunnen widgets zoals "warning runs" zelf namaken en als gedeelde widget opslaan, met als extra voordeel dat ze een `environment`-filter kunnen toevoegen.

---

## Decision

De zes redundante widgets worden uit het systeem verwijderd:

1. De widget-bestanden worden van de codebase verwijderd.
2. De imports en registry-entries in `registry.ts` worden verwijderd.
3. Instanties in `data/system-overrides.json` (systeemdashboards) worden verwijderd inclusief hun layout-entries in alle breakpoints.

De vier actiegerichte counter-widgets blijven behouden:

| Widget | Reden van behoud |
| --- | --- |
| `total-runs` | Contextueel startpunt voor run-volume. |
| `failed-runs` | Direct actiebaar; bij niet-nul is er werk te doen. |
| `failed-dq-checks` | Direct actiebaar; bij niet-nul zijn checks te bekijken. |
| `pass-rate` | Meest informatieve single metric van de DQ-widgets. |

---

## Consequences

- Gebruikers die eerder een verwijderde widget op een persoonlijk dashboard hadden staan, zien een "Widget not found" placeholder. Zij kunnen de widget via de builder nagenoeg identiek nabouwen.
- De widget-picker in de builder is compacter en minder verwarrend.
- De custom builder krijgt hiermee een praktische motivatie: teams kunnen eigen tellers definiëren met filters op `environment` of `dataset_id` die de hardcoded systeemwidgets nooit aanboden.

---

## Implementation Notes

Files deleted:
- `src/app/(dashboard)/dashboard/widgets/success-runs-widget.tsx`
- `src/app/(dashboard)/dashboard/widgets/warning-runs-widget.tsx`
- `src/app/(dashboard)/dashboard/widgets/total-dq-checks-widget.tsx`
- `src/app/(dashboard)/dashboard/widgets/success-dq-checks-widget.tsx`
- `src/app/(dashboard)/dashboard/widgets/unique-pipelines-widget.tsx`
- `src/app/(dashboard)/dashboard/widgets/unique-check-types-widget.tsx`

Modified:
- `src/app/(dashboard)/dashboard/registry.ts` — imports and entries removed.
- `data/system-overrides.json` — `success-dq-checks` instance removed from `system:quality` dashboard and all breakpoint layouts.

---

## Follow-up Backlog

1. Add a migration note to the operator upgrade guide for installations that may have these widget types persisted in shared or personal dashboards.
2. Consider adding `count_distinct` as a measure type to the widget builder so that "unique pipelines" can be reconstructed there without code.
