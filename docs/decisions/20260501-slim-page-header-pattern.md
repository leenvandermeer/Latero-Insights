# LADR-031 — Slim page header pattern voor alle dashboard-pagina's

**Datum:** 2026-05-01  
**Status:** ACCEPTED  
**Auteur:** Latero product

---

## Context

De oorspronkelijke pagina-headers volgden een gradient-card-patroon:
een groot `rounded-2xl` blok met achtergrondgradiënt, eyebrow-tekst, display-font
titel, beschrijvingstekst, organisatiepil en omgevingspil. Dit patroon nam op
smallere viewports ±20% van de verticale hoogte in beslag, herhaalde context die
al zichtbaar was in de sidebar (installatie, omgeving), en versterkte daarmee
het gevoel van een "admin-portaal" in plaats van een operationeel dashboard.

Marktconformiteit-check (vergelijking met Linear, Vercel, Retool, Hex):
- Icoon inline, geen kader
- Paginatitel `text-base` tot `text-lg`, nooit display-weight
- Omgevings- of statusindicatoren als compacte pills
- Actionable controls rechts uitgelijnd in dezelfde rij

## Beslissing

Vervang alle pagina-headers door het slim toolbar-patroon uit `PageHeader`:

```
[ icon ]  [ Paginatitel ]                 [ env-pill ]  [ actions ]
──────────────────────────────────────────────────────────────────── 1px border
```

Kenmerken:
- Icoon inline (geen kader, geen achtergrond), `h-4 w-4`, `color-text-muted`
- Titel `text-[17px] font-semibold`, `letter-spacing: -0.02em`
- Omgevingspil alleen — geen organisatiepil (de sidebar toont de installatienaam)
- Omgevingskleuren: prod = rood, staging/acc = amber, dev = cyaan, test = paars
- `<PageHeader>` leest installatie via `useInstallation()`, niet via props
- Legacy props `eyebrow`, `description` worden geaccepteerd maar niet gerenderd
- Beschrijvingstekst verdwijnt volledig — de navigatienaam is zelf-verklarend

Het `DashboardCanvas`-component heeft zijn eigen header (inline, geen aparte
component) zodat edit-mode, inline titelbeheer en dashboard-acties naast elkaar
in dezelfde rij kunnen staan.

## Gevolgen

- Elke pagina wint ±80–120px verticale ruimte terug
- Installatie-omgevingscontext is consistent en altijd zichtbaar, ongeacht welke
  pagina actief is
- Alle nieuwe pages moeten `<PageHeader title="..." icon={...} />` gebruiken
- Eyebrow- en beschrijvingsteksten zijn geen optie meer; vertaal informatie naar
  de productnaam of navigatielabel indien nodig
