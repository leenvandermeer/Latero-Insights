# LADR-024 — Widget generator-first architectuur: geen out-of-the-box widgets, alles via shared library

**Datum:** 2026-04-24  
**Status:** ACCEPTED  
**Auteur:** Leen van der Meer

---

## Context

Tot nu toe had de applicatie twee aparte widget-stromen:

1. **Systeem-widgets** — hardcoded in `registry.ts`, direct plaatsbaar op een dashboard via de widget picker. Elke systeeminstallatie kreeg automatisch voorgevulde systeemdashboards (Pipelines, Data Quality, BCBS239) met een vaste set widgets.
2. **Custom widgets** — aangemaakt via de widget generator, opgeslagen in localStorage (persoonlijk) of in `data/shared-widgets.json` (gedeeld) na een aparte publicatiestap.

Dit model had drie nadelen:

- **Onbeheerbaar bij schaal**: elke nieuwe widget in de registry vereist een code-deployement en is direct zichtbaar voor alle gebruikers, ook als de widget niet relevant is voor de specifieke installatie.
- **Inconsistente workflow**: operators die een custom widget wilden, moesten hem eerst lokaal aanmaken, dan apart publiceren. Systeem-widgets konden niet op dezelfde manier worden beheerd.
- **Lege dashboards bij nieuwe installaties waren onmogelijk**: systeemdashboards hadden altijd een hardcoded standaardindeling, wat niet past bij een productomgeving waar de operator de indeling bepaalt.

De eis is nu: **alle widgets worden aangemaakt via de widget generator, en gaan direct naar de shared library**. Er zijn geen out-of-the-box widgets meer op dashboards.

---

## Beslissing

### 1. Widget generator publiceert direct naar shared

De widget generator (`/dashboard/widget-builder`) roept bij opslaan niet meer `saveCustomWidget` (localStorage) aan, maar `usePublishWidget` → `POST /api/widgets/shared`. Elke widget die een operator aanmaakt is direct beschikbaar voor alle gebruikers die die shared widget aan hun dashboard toevoegen.

### 2. Twee modi in de widget generator

De generator krijgt een expliciete modekeuze bovenaan:

| Modus | Beschrijving |
|-------|-------------|
| **From template** | Kiest een bestaand registrycomponent (bijv. "Pipeline Status Trend", "DQ Checks Table"). Slaat op als `SharedWidgetDef` met `templateType = "<registry-key>"`. Geen queryConfig nodig. |
| **Custom (data-driven)** | Bestaande wizard (data source → measure → visualize → publish). Slaat op als `SharedWidgetDef` met `queryConfig` en `visualType`. |

Beide paden publiceren naar shared. Er is geen persoonlijk-tussenstation meer.

### 3. `SharedWidgetDef` — uitgebreid type

```typescript
interface SharedWidgetDef {
  // ...bestaande velden...
  queryConfig?: QueryConfig;   // afwezig voor template-widgets
  visualType?: VisualType;     // afwezig voor template-widgets
  templateType?: string;       // registry-sleutel voor prebuilt templates
  category?: WidgetCategory;   // "counter" | "charts" | "tables" | "overview"
}
```

`queryConfig` en `visualType` zijn nu optioneel. Bestaande shared widgets (met queryConfig) blijven werken; nieuwe template-widgets slaan `templateType` op in plaats van een queryConfig.

### 4. Rendering: `CustomWidgetRenderer` routeert op `templateType`

```
slot.type === "shared" && customWidgetId → CustomWidgetRenderer
  → if (widget.templateType)  → getWidgetDef(templateType).component  (registry rendering)
  → else                      → executeQuery(queryConfig) + WidgetRenderer  (data-driven)
```

De registry (`registry.ts`) blijft bestaan als renderinglaag, maar is niet meer de bron voor "keuze van widgets" in de UI.

### 5. Widget picker toont alleen shared + mine

De `WidgetPickerDrawer` en `WidgetPickerModal` tonen geen registry-widgets meer direct. De tabs zijn:

```
All | Counters | Charts | Tables | Overview | Mine
```

- **Counters/Charts/Tables/Overview**: shared widgets gefilterd op `SharedWidgetDef.category`
- **Mine**: persoonlijke custom widgets (localStorage, blijft bestaan als fallback-tier bij withdraw)
- Geen "Systeem"-sectie meer

De footer CTA stuurt altijd naar de widget generator.

### 6. Systeemdashboards starten leeg

`SYSTEM_DASHBOARD_DEFS` in `dashboard-store.ts` definieert Pipelines, Data Quality en BCBS239 met lege `widgets: []` en `layout: {}`. De operator vult ze zelf in via de generator + "Publish for everyone".

Ook het standaard persoonlijk dashboard ("My Dashboard") start leeg.

`data/system-overrides.json` wordt geleegd naar `{}` bij de initiële deployement van deze versie.

De "Reset to default" knop op systeemdashboards produceert ook een leeg dashboard (er is geen vaste preset meer om naar terug te keren).

### 7. Categorie-indeling

Widgets worden gecategoriseerd bij aanmaken:

| Categorie | Wanneer |
|-----------|---------|
| `counter` | Template met registry-categorie `counter`, of custom met `visualType === "counter"` |
| `charts` | Template met registry-categorie `chart`, of custom met chart-visualtype |
| `tables` | Template met registry-categorie `table`, of custom met `visualType === "table"` |
| `overview` | Template met registry-categorie `overview` |

---

## Alternatieven overwogen

**Registry-widgets direct tonen in picker behouden** — eenvoudiger, maar conflicteert met de eis dat alle widgets via de generator moeten worden aangemaakt. Operators zouden nog steeds "onbeheerde" widget-plaatsingen kunnen doen zonder gemeenschappelijke naamgeving of beschrijving.

**Persoonlijke widgets als tussenstap behouden (localStorage → publish)** — bestaand model. Verwarrend: operators zien widgets die anderen niet kunnen zien, en vergeten soms te publiceren. De directe publish-flow is explicieter.

**Systeemdashboards vultmen via een JSON-configuratiebestand** — mogelijk als toekomstige uitbreiding voor geautomatiseerde provisioning. Buiten scope.

---

## Backward compatibility

- **Bestaande shared widgets** (met `queryConfig` en `visualType`) werken ongewijzigd; `CustomWidgetRenderer` valt terug op de data-driven path als `templateType` afwezig is.
- **Bestaande registry-widget slots** in localStorage (persoonlijke dashboards van huidige gebruikers) blijven renderen via de registry-lookup in `dashboard.tsx` (`getWidgetDef(w.type)`). Ze kunnen niet meer worden toegevoegd via de picker, maar bestaande plaatsingen verdwijnen niet.
- **`detachSharedWidget`** propageert `templateType` en `category` naar de detached `CustomWidget` zodat een teruggetrokken template-widget blijft renderen via de registry.

---

## Gevolgen

- Operators moeten bij een nieuwe installatie zelf de gewenste widgets aanmaken en publiceren voordat systeemdashboards iets tonen. Dit is intentioneel: het dwingt bewuste keuzes over relevante widgets.
- De widget generator is nu de centrale ingang voor elke widget-toevoeging. Documentatie en onboarding moeten dit benadrukken.
- De registry (`registry.ts`) is een implementatiedetail geworden, niet een gebruikersgerichte catalogus.
- Toekomstige widgets toevoegen aan de applicatie vereist alleen een entry in `registry.ts`; ze verschijnen automatisch in de "From template"-lijst van de generator.
