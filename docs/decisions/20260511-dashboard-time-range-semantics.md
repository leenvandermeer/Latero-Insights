# LADR-072 — Dashboard time-range semantics: snapshot vs selected-period metrics

**Datum:** 2026-05-11  
**Status:** PROPOSED  
**Auteur:** Latero product  
**Related:** [LADR-031](20260501-slim-page-header-pattern.md), [LADR-032](20260503-uniform-source-indicator.md), [LADR-068](20260508-dashboard-ux-overhaul.md)

---

## Context

Na de shell- en headerharmonisatie is een inhoudelijke UX-inconsistentie zichtbaar
geworden op meerdere dashboardpagina's, met name op `/overview`.

De huidige pagina toont een globale datumselectie (`Today`, `Last 7 days`,
`Last 30 days`, custom range), maar niet alle metrics reageren op die selectie.
Daardoor ontstaat een semantische mismatch:

- **Recent runs** reageert wel op de geselecteerde periode
- **Estate health** bevat deels hardcoded 7-daagse logica
- **Open issues** is momenteel een current-state telling
- **Data products** en **Entities** zijn snapshot-tellingen, geen periode-metrics

Voor de gebruiker voelt dit als "de pagina past zich niet aan", terwijl de
werkelijke fout dieper zit: de UI suggereert één globale tijdsemantiek, maar de
onderliggende widgets en API-routes volgen verschillende modellen.

Deze inconsistentie is niet beperkt tot `/overview`. In custom/system dashboards
kan dezelfde foutklasse optreden wanneer een widget een datumselector toont, maar
feitelijk snapshot-data of vaste-window data rendert.

---

## Decision

### 1. Latero Control maakt expliciet onderscheid tussen twee metric-typen

Elke dashboardmetric, kaart, widget of tabel valt in precies één van deze twee
semantische klassen:

- **Snapshot metric** — current-state, niet gebonden aan de gekozen periode
- **Period metric** — volledig berekend binnen de gekozen `from/to` range

Een component mag deze twee semantieken niet impliciet mengen onder één enkel
label of één enkele globale claim.

### 2. Een datumselector bestuurt alleen period metrics

Als een pagina of dashboard een datumselector toont, dan geldt:

- alle period metrics op die pagina moeten daarop reageren
- snapshot metrics mogen blijven staan, maar moeten expliciet als current-state
  of current inventory gepositioneerd zijn

De selector is dus geen "globale paginawaarheid", maar een besturingselement
voor period-based content.

### 3. Snapshot metrics moeten visueel en tekstueel eerlijk gepresenteerd worden

Snapshot metrics mogen niet onder copy vallen zoals:

- `Showing Last 30 days`
- `Recent runs and monitor signals use this period`
- andere formuleringen die suggereren dat alle content meebeweegt

Voor snapshot metrics gelden deze ontwerpregels:

- plaats ze in een aparte current-state zone, of
- geef ze een expliciet label zoals `Current state`, `Live inventory`, of
  `Open now`

### 4. Period metrics moeten end-to-end range-aware zijn

Voor period metrics is de datumrange leidend van UI tot API:

- `useDateRange()` of equivalente page-state levert `from/to`
- hooks geven `from/to` door
- read APIs accepteren `from/to`
- serverqueries gebruiken geen verborgen vaste windows zoals `interval '7 days'`
  tenzij de UI dat expliciet als vaste metric benoemt

Een API-route die gedeeltelijk current-state en gedeeltelijk fixed-window data
teruggeeft onder één health-object is niet langer het gewenste patroon.

### 5. Widgets krijgen een expliciete temporal semantics

Dashboard-widgets moeten conceptueel behandelbaar zijn als:

- `snapshot`
- `period`

Dit hoeft niet per se als direct databaseveld te starten, maar moet wel zichtbaar
worden in widgetontwerp, registry-beschrijving en implementatiekeuzes.

Doel:
- date-range bugs sneller herkennen
- dashboardkoppen en helper-copy correct genereren
- custom dashboards voorspelbaarder maken

---

## Consequences

### Positief

- De datumselector krijgt een eerlijke en voorspelbare betekenis
- `/overview` en vergelijkbare pagina's voelen niet meer "kapot"
- Snapshot- en trendinformatie kunnen naast elkaar bestaan zonder verwarring
- Widget-auteurs krijgen een duidelijk semantisch kader

### Trade-offs

- Sommige bestaande kaarten moeten herlabeld of herschikt worden
- Bepaalde API-routes moeten opgesplitst of uitgebreid worden met `from/to`
- Niet elke metric kan of hoeft historisch gemaakt te worden; soms is de juiste
  oplossing expliciete snapshot-positionering in plaats van extra querycomplexiteit

---

## Implementation Guidance

### Overzichtspagina's

`Overview`, `Quality`, `Runs`, `Catalog`, `Lineage`, dashboard detailpagina's en
admin-overviews moeten worden beoordeeld op hun temporal semantics.

### Eerste prioriteit

1. `/overview` — hier is de mismatch al zichtbaar en gebruikersgevoelig
2. widgets met incidents/open-state tellingen
3. widgets of cards met health-objecten die mixed semantics bevatten

### Aanbevolen ontwerpuitkomst voor `/overview`

- bovenste copy verwijst alleen naar period metrics
- current-state cards worden expliciet als snapshot gepositioneerd
- period cards en lists gebruiken dezelfde geselecteerde `from/to`

---

## Explicit Non-Goals

- Dit ADR verplicht niet dat alle snapshot metrics historisch querybaar worden
- Dit ADR introduceert geen nieuw analytics warehouse of apart time-series model
- Dit ADR wijzigt niet automatisch bestaande requirements; uitvoering loopt via
  een apart werkpakket
