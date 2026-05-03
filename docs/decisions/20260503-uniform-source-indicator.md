# LADR-032 — Uniforme data-statusindicator op alle dashboard-pagina's

**Datum:** 2026-05-03  
**Status:** ACCEPTED  
**Auteur:** Latero product

---

## Context

Na de introductie van het slim page header-patroon (LADR-031) hadden verschillende
pagina's een inconsistente statuspresentatie:

- **Datasets** toonde een `SourceIndicator`-badge ("Cache", "Connected") via de
  eigen `DatasetsDashboard`-component
- **Pipelines, Quality, Lineage (custom dashboards)** gebruikten `DashboardCanvas`
  en toonden geen statusindicator
- **Lineage Explorer en OpenLineage** toonden via `PageHeader` een omgevingspil
  ("PROD") — context die de gebruiker zelf heeft ingesteld en daarmee redundant is
- **Lineage entities/attributes API** retourneerde `source: "postgres"` als onbekende
  sleutel, waardoor `SourceIndicator` terugviel op de fallback-tekst "Source: postgres"
- Het label "Insights SaaS" in `SourceIndicator` voor de `"insights-saas"`-bron
  was technisch jargon, niet gebruikersgericht

## Beslissing

### 1. SourceIndicator in DashboardCanvas

`DashboardCanvas` haalt via `useHealth()` de verbindingsstatus op en toont een
consistente `SourceIndicator` in de header, rechts van de datum-picker:

```
[ Dashboard naam ]          [ Connected ]  [ datum-picker ]  [ controls ]
```

Bronafleiding vanuit health:
- `cache.cacheOnly === true` → `"cache"` (gele badge "Cache")
- `status === "ok"` → `"insights-saas"` (groene badge "Connected")
- `status !== "ok"` + `cache.fileCount > 0` → `"fallback"` (rode badge "Fallback")
- `health` nog niet geladen → geen badge

### 2. Omgevingspil verwijderd

De omgevingspil ("PROD", "dev-free") is verwijderd uit:
- `DashboardCanvas` header (inline implementatie)
- `PageHeader` component (`useInstallation` import en alle ENV_STYLE logica)

Reden: de omgeving is door de gebruiker zelf ingesteld en zichtbaar in de Settings.
Het herhalen ervan op elke pagina voegt geen operationele waarde toe en concurreert
visueel met de `SourceIndicator`.

### 3. Label "Connected"

Het `"insights-saas"`-label in `SourceIndicator` is gewijzigd van "Insights SaaS"
naar "Connected". De technische implementatienaam is niet relevant voor eindgebruikers;
"Connected" communiceert de operationele status direct.

### 4. Consistente source-sleutels in lineage API

`/api/lineage/entities` en `/api/lineage/attributes` retourneerden `source: "postgres"`.
Dit is geen geregistreerde sleutel in `SourceIndicator` en resulteerde in de
fallback-tekst "Source: postgres". Beide routes retourneren nu `"insights-saas"`,
consistent met `/api/pipelines`, `/api/quality` en `/api/lineage`.

## Gevolgen

- Alle pagina's (Pipelines, Quality, Datasets, Lineage Explorer, OpenLineage,
  custom dashboards) tonen dezelfde statusindicator op dezelfde positie
- `PageHeader` heeft geen dependency meer op `useInstallation`
- Nieuwe dashboard-pagina's die `DashboardCanvas` gebruiken krijgen de indicator gratis
- Nieuwe dashboard-pagina's die `PageHeader` gebruiken met een eigen `SourceIndicator`
  in `actions` volgen het patroon van `DatasetsDashboard`
