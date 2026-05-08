# LADR-068 — Dashboard Navigation & Widget UX Overhaul

**Datum:** 2026-05-08
**Status:** ACCEPTED
**Auteur:** Leen van der Meer
**Supersedes:** [LADR-024](20260424-widget-generator-first-architecture.md) (gedeeltelijk — het verbod op OOTB widgets wordt teruggedraaid)
**Related:** [LADR-007](20260418-dashboard-builder-model.md), [LADR-010](20260419-dashboard-ux-cta-and-placement.md), [LADR-016](20260422-progressive-disclosure-dashboard-ux.md), [LADR-018](20260422-widget-builder-json-configuration-mode.md)

---

## Context

De huidige dashboard-UX is te complex voor nieuwe gebruikers en voldoet niet aan
de verwachting van een modern data-observability product:

1. **Geen directe dashboard-navigatie.** De sidebar bevat één enkele link
   "Dashboards" die naar een gallery-page leidt. Gebruikers moeten twee stappen
   zetten (click gallery → click dashboard) om een dashboard te openen.
2. **Geen favorites of pinning.** Er is geen manier om een dashboard aan te
   pinnen in de navigatie. Elk bezoek begint op de gallery-page.
3. **Lege system dashboards.** LADR-024 besloot dat alle widgets via de shared
   library moeten worden aangemaakt. Gevolg: nieuwe installaties zien lege
   dashboards zonder enige out-of-the-box waarde. Dit is niet acceptabel voor
   een SaaS-product.
4. **Complex gallery-page.** De `/dashboard` home toont een hero-banner,
   stat-cards, dashboard-cards en templates — te druk voor een startpunt.
5. **Widget GUI/JSON mode alleen via widget-builder page.** De widget-config-panel
   op het canvas heeft al GUI + JSON tabs (LADR-018), maar de onboarding via de
   widget-builder page is te lang voor simpele template-widgets.

Referentieproducten geanalyseerd: Grafana 10, Datadog, Metabase, Linear, Amplitude.

State-of-the-art patronen:
- Starred/pinned dashboards direct zichtbaar in de sidebar (Grafana, Datadog)
- OOTB pre-populated dashboards voor nieuwe installaties (Datadog)
- Geen gateway-page — direct navigeren naar dashboards (Linear, Notion)
- Inline dual-mode widget config (Grafana panel editor: visual + JSON)

---

## Beslissingen

### 1. OOTB widget layouts voor system dashboards (supersedes LADR-024 gedeeltelijk)

LADR-024 verbood out-of-the-box widgets op system dashboards. Dit besluit wordt
**gedeeltelijk teruggedraaid** voor de factory-defaults van de drie system
dashboards.

**Beslissing:** De factory-defaults in `dashboard-store.ts` worden gevuld met
zinvolle standaard widget-layouts:

| Dashboard | OOTB widgets |
|-----------|-------------|
| **Pipelines** | Total Runs, Failed Runs, Avg Run Duration, Run Status Trend, Runs by Pipeline, Recent Pipeline Runs |
| **Data Quality** | DQ Pass Rate, Failed DQ Checks, Warning DQ Checks, DQ Pass Rate Trend, Results by Category, DQ Checks by Category, DQ Check Results |
| **BCBS 239** | BCBS239 Score, DQ Pass Rate, Failed DQ Checks, DQ Pass Rate Trend, Results by Category, DQ Check Results |

De operator kan de layout overschrijven via "Publish for everyone" op het canvas.
"Reset to default" herstelt de factory-default (nu gevuld, niet leeg).

De widget-generator-first workflow (LADR-024, beslissing 1–4) blijft van kracht
voor het aanmaken van nieuwe custom en template widgets. Alleen de factory-defaults
van system dashboards worden gewijzigd.

### 2. Dashboards-sectie in de sidebar met directe navigatie

De sidebar "Workspace"-sectie wordt vervangen door een "Dashboards"-sectie:

```
DASHBOARDS
  ├── Pipelines          ← system, altijd zichtbaar
  ├── Data Quality       ← system, altijd zichtbaar
  ├── BCBS 239           ← system, altijd zichtbaar
  ├── [max 3 gepinde user dashboards]
  └── All dashboards  +New
```

Regels:
- System dashboards zijn altijd zichtbaar in de sectie, niet pinbaar.
- Gebruikers kunnen eigen dashboards pinnen (max 3 zichtbaar).
- "All dashboards" navigeert naar `/dashboard`.
- "+ New" opent de NewDashboardModal.
- In collapsed state: systeemdashboards als icon-links + pin/new-acties.

### 3. Vereenvoudigde dashboard home page (`/dashboard`)

De huidige gallery-page (hero-banner + stat-cards + card-grid) wordt vervangen
door een **platte lijst-weergave**:

- Zoekbalk (filter op naam)
- Tabs: All | System | Mine | Pinned
- Elke rij: icon, naam, aantal widgets, laatste update, ★ pin-toggle, → open-link
- Geen hero-banner, geen stat-cards, geen template-sectie

### 4. Pin/favorite per dashboard

Gebruikers kunnen elk user-dashboard pinnen aan de sidebar. Staat wordt opgeslagen
in localStorage per installatie via een `usePinnedDashboards`-hook.

```
Storage key: insights-pinned-dashboards-v1:{installationId}
Value: string[]  (array van dashboard-IDs)
```

Pin-toggle verschijnt op:
- Canvas header (naast de dashboard-naam)
- Rij in de dashboard-lijst

System dashboards zijn niet pinbaar (ze zijn altijd zichtbaar).

### 5. Widget GUI + JSON mode is canvas-native (bevestiging)

`WidgetConfigPanel` bevat al GUI-form en JSON-mode (LADR-018). Dit gedrag wordt
bevestigd als de enige config-entry-point voor bestaande widgets op het canvas.
De aparte `/dashboard/widget-builder` page blijft bestaan voor het aanmaken van
nieuwe widgets.

---

## Gevolgen

- Nieuwe installaties hebben direct werkende dashboards met zinvolle widgets.
- Gebruikers navigeren in één klik naar een dashboard via de sidebar.
- De gallery-page wordt eenvoudiger maar blijft als overzichtspagina bestaan.
- `SYSTEM_LAYOUT_VERSION` wordt verhoogd naar 3 zodat bestaande overrides
  niet worden gereset door de nieuwe factory-defaults.
- Factory-defaults zijn alleen zichtbaar als er geen server-override is opgeslagen.

---

## Requirement Impact

- Introduceert **LINS-022** — Out-of-the-box system dashboard widget layouts
- Introduceert **LINS-023** — Dashboard favorites/pinning in sidebar navigation
- Introduceert **LINS-024** — Simplified dashboard home as searchable list

---

## Implementation Notes

Gewijzigde bestanden:
- `web/src/lib/dashboard-store.ts` — OOTB layouts
- `web/src/hooks/use-pinned-dashboards.ts` — nieuw
- `web/src/components/navigation/sidebar.tsx` — Dashboards-sectie
- `web/src/app/(tenant)/(dashboard)/dashboard/page.tsx` — vereenvoudigd
- `web/src/app/(tenant)/(dashboard)/dashboard/dashboard.tsx` — pin-toggle
- `docs/requirements/current-product-requirements.md` — LINS-022-024
