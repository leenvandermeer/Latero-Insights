# LADR-075 — Lineage Explorer UX Hardening: naamgeving, inline controls, en tab-pariteit

**Datum:** 2026-05-11  
**Status:** ACCEPTED  
**Supercedes:** Verdiept LADR-067 (map-vs-trace-ux) en LADR-074 (lineage-default-map-and-advanced-trace)  
**LINS:** LINS-lineage-ux

---

## Context

De Lineage Explorer heeft meerdere iteraties doorgemaakt (LADR-015, LADR-066, LADR-067, LADR-074).
Na evaluatie van de live pagina zijn er drie structurele UX-problemen vastgesteld:

1. **De "Map"-tab is geen kaart.** Het is een statistisch overzicht (metrics + chain readiness). De naam wekt verkeerde verwachtingen bij nieuwe gebruikers.
2. **Column mappings staat buiten de tabnavigatie.** Het is een knop in de rechtertoolbar, niet een gelijkwaardige tab. Gebruikers vinden het moeilijk te ontdekken.
3. **De Trace-sidebar heeft te veel interactiepunten.** Direction, Depth, Layers, View-toggle en Anchor-selector zijn verspreid over ~14 interacties in een collapsible zijpaneel. Dit werkt tegen het progressive disclosure-principe (LADR-016).

Tevens is `graph-view.tsx` na LADR-066/067 een verlaten component zonder importreferenties.

---

## Beslissing

### 1. Tab "Map" hernoemd naar "Overview"

"Overview" dekt de inhoud correct: metrics, chain readiness, layer breakdown. Geen visuele topologie-verwachtingen.

### 2. "Column mappings" als gelijkwaardige derde tab

De three-tab structuur (Overview / Advanced Trace / Column mappings) was al beschreven in LADR-015. De implementatie week hier van af door Column mappings als toolbar-knop te positioneren. Dit wordt gecorrigeerd: alle drie tabs staan in de primaire tabbar.

### 3. Trace controls: sidebar vervangen door inline compact toolbar

De collapsible sidebar wordt verwijderd. Alle Trace-controls (Anchor entity, Direction, Depth, Layers, View-mode, Reset) worden samengebracht in één compacte horizontale balk boven het canvas. Dit reduceert de interactieoppervlakte en verbetert scanbaarheid.

Layout inline controls toolbar:
```
[From: <entity select>] | [↑ Up ↔ Both ↓ Down] | [1 2 3 All] | [landing raw bronze silver gold] | ml-auto [⬛ Graph 📋 List] [↺ Reset]
```

### 4. "As of" timestamp prominent in Overview

`refreshedAt` wordt weergegeven als expliciete "As of:" pill bovenaan de Overview-tab, vóór de metric cards. Dit maakt duidelijk dat alle metrics de huidige snapshot weerspiegelen, niet een geselecteerde tijdrange.

### 5. `graph-view.tsx` verwijderd

Geen importreferenties. Component is overbodig na LADR-066/067-migratie.

---

## Consequenties

- **Positief:** Consistente tabnavigatie; minder kognitieve belasting in Trace; betere onboarding voor nieuwe gebruikers.
- **Negatief:** Geen. Alle functionaliteit blijft behouden; alleen de UI-structuur wijzigt.
- **Onderhoud:** `controlsCollapsed` localStorage-sleutel `lineage-trace-controls-collapsed` is vervallen; kan als technische schuld gemarkeerd worden maar veroorzaakt geen breuk.
