# WP-UX-001 — Dashboard time-range semantics alignment

**Status:** PROPOSED  
**Datum:** 2026-05-11  
**Auteurs:** UX Designer Agent, Product Architect Agent  
**ADR:** [LADR-072](../decisions/20260511-dashboard-time-range-semantics.md)

---

## Probleemstelling

Meerdere dashboardpagina's tonen een datumselector die voor de gebruiker als
globaal paginemechanisme voelt, terwijl niet alle metrics of widgets daarop
reageren. Dit veroorzaakt onbetrouwbare UX en maakt het moeilijk om te begrijpen
welke cijfers current-state zijn en welke cijfers een geselecteerde periode
representeren.

De duidelijkste fout zit op `/overview`, maar dezelfde foutklasse kan voorkomen
in andere dashboards en widgets.

---

## Doelstelling

1. Elke dashboardmetric krijgt expliciete temporal semantics: `snapshot` of `period`
2. Pagina's met een datumselector communiceren eerlijk welke content door de
   selector wordt bestuurd
3. Mixed-semantics API-objecten worden afgebouwd of expliciet gemaakt
4. Overview wordt de referentie-implementatie voor dit patroon

---

## Scope

### In scope

- Tenant dashboard overview-pagina's
- Dashboard widgets met datumrangegedrag
- Read APIs die periode-gedrag of snapshot-gedrag aan overview/widgets leveren
- Helper copy, labels en paginahiërarchie rond period vs current-state

### Out of scope

- Grote datamodelwijzigingen
- Historisering van alle snapshot-metrics
- Volledige redesign van widget builder UX

---

## Geconstateerde risicogebieden

### Zeker inconsistent

- `/overview`
- `estate-health` API en bijbehorende hook

### Verdacht / audit nodig

- open incidents widgets
- monitored entities widgets
- custom dashboards met mixed cards en datumselector

---

## Deliverables

### WP-1 — Temporal semantics audit

- [x] Inventaris van alle tenant overview-pagina's met datumselector
- [x] Inventaris van alle widgets die `useDateRange()` of page-range gebruiken
- [x] Per pagina/widget classificatie: `snapshot`, `period`, of `mixed`
- [x] Lijst van copy die semantisch te breed of misleidend is

### WP-2 — API normalization

- [x] `estate-health` ontwerp beslissen: split endpoint of volledig range-aware
- [x] Vastleggen welke read APIs `from/to` moeten accepteren
- [x] Verboden patroon documenteren: hidden fixed windows in period-controlled UI

### WP-3 — Overview redesign

- [x] `/overview` opdelen in `Current state` versus `Selected period`
- [x] KPI- en helper-copy herschrijven
- [x] Alleen period metrics koppelen aan date picker claims
- [x] Snapshot cards visueel groeperen als current-state block

### WP-4 — Widget alignment

- [x] Open incidents widgets semantisch corrigeren
- [x] Monitored entities / inventory widgets semantisch corrigeren
- [x] Widget descriptions of registry metadata aanvullen waar nodig

### WP-5 — Acceptance sweep

- [ ] `/overview` handmatig valideren op `Today`, `Last 7 days`, `Last 30 days`,
      en custom range
- [x] Controleren dat `Runs` en `Quality` consistent blijven
- [ ] Minimaal één custom dashboard testen met mixed widgetset
- [ ] UX review op helper-copy en user expectation

---

## Acceptatiecriteria

1. Als een pagina `Showing Last X days` toont, reageren alle period metrics op
   dezelfde `from/to`
2. Snapshot metrics zijn visueel of tekstueel herkenbaar als current-state
3. Geen period-controlled pagina gebruikt nog verborgen vaste windows zonder
   expliciete labeling
4. `/overview` werkt als referentiepatroon voor andere dashboards
5. Een gebruiker kan zonder interpretatieverschil uitleggen waarom een getal wel
   of niet meebeweegt met de date picker

---

## Aanbevolen uitvoervolgorde

1. Audit van overview + widgets
2. `estate-health` semantics beslissen
3. Overview implementeren
4. Widgets alignen
5. Rest van de dashboards nalopen

---

## Audit Notes

### Pagina-classificatie

- `/overview` — mixed, nu opgesplitst in `Current state` en `Selected period`
- `/quality` — period
- `/runs` — period
- `/openlineage` — period
- `/dashboard/[id]` — mixed by design, afhankelijk van widgetset

### Widget-classificatie

- `snapshot`: open incidents, monitored entities
- `period`: run, quality, trend en period-table widgets
- `mixed`: dataset overview

### Range-aware read APIs

- `/api/health/estate` — period metrics via `from/to`, snapshot metrics blijven current-state
- `/api/runs` — volledig period-based
- `/api/quality` — volledig period-based
- `/api/lineage` en openlineage-views — period-based

### Verboden patroon

- een pagina met date picker mag geen verborgen vaste window zoals `last 7 days`
  gebruiken voor period-metrics, tenzij dat expliciet als vaste metric in de UI
  benoemd staat

### Copy die is aangescherpt

- globale `Showing ...` claims op `/overview`
- dashboard canvas helpertekst voor mixed widgetsets
- widgetbeschrijvingen die eerder snapshot-data te veel als generieke dashboarddata presenteerden

### Acceptance notes

- `Runs` blijft period-based: route, hook en pagina gebruiken `from/to` consistent
- `Quality` blijft period-based: route, hook en pagina gebruiken `from/to` consistent
- custom dashboards communiceren nu expliciet dat de date scope alleen geldt
  voor period-based widgets wanneer de widgetset mixed semantics bevat
- resterende open punten zijn browser-validatie en UX-polish, niet meer de
  kernsemantiek in code

---

## Notities

- Niet elk getal hoeft historisch te worden gemaakt; soms is het juiste antwoord
  een expliciete snapshot-positionering
- Deze WP is primair een UX- en productsemantiekcorrectie, met beperkte maar
  gerichte backend-aanpassingen
