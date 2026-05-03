# Admin/App Separation Work Packages

Status: Active — LADR-039 vastgesteld (2026-05-03)  
Owner: Product + Engineering  
Date: 2026-04-25  
Updated: 2026-05-03

## Context

De huidige applicatie heeft al een functionele scheiding tussen tenant-app en admin, maar nog niet overal een harde technische scheiding. Daardoor kunnen redirect- en loginflows elkaar beïnvloeden.

Dit document zet de opsplitsing neer in uitvoerbare werkpakketten, zodat implementatie later gefaseerd kan gebeuren.

**Architectuurbeslissing:** Zie [LADR-039](../decisions/20260503-admin-tenant-layout-css-isolation.md)
voor de gekozen strategie: Next.js route group root layouts als isolatiemodel.

## Doel

- Tenant-gebruikersflow en admin-gebruikersflow technisch isoleren.
- Regressies voorkomen waarbij tenant-routing admin-routing beïnvloedt (of omgekeerd).
- Beheer van organisaties en admin-operaties stabiel en voorspelbaar houden.
- Gedeelde CSS-cascade elimineren als bron van workarounds.

## Niet-doelen

- Geen herontwerp van het volledige UI-thema.
- Geen wijziging aan de functionele scope van tenant-features.
- Geen migratie naar een aparte repository in deze fase.

## Werkpakket 0 — CSS- en layout-isolatie (PRIORITEIT)

Doel:
- Admin-app en tenant-app volledig uit dezelfde CSS-cascade halen.

Scope:
- Nieuwe `(tenant)/` en `(admin)/` route group root layouts.
- `admin-globals.css` zonder conflicterende input-selectors.
- Verwijdering van inline `paddingLeft`/`paddingRight` workarounds.

Deliverables:
- `src/app/(tenant)/layout.tsx` als tenant root layout.
- `src/app/(admin)/layout.tsx` als admin root layout.
- `src/styles/admin-globals.css` als geïsoleerde admin baseline.
- Geen `globals.css` of `tokens.css` import in admin root layout.

Acceptatiecriteria:
- Wijzigingen aan `globals.css` veroorzaken geen visuele regressies in admin-UI.
- Admin-formulieren hebben geen inline-style workarounds meer.
- TypeScript build slaagt. URL-structuur ongewijzigd.

Indicatie:
- 0.5 tot 1 dag.

## Werkpakket 1 — Route-architectuur hard scheiden

Doel:
- Heldere routegrenzen maken tussen tenant-app en admin-app.

Scope:
- Tenant-routes blijven onder app-groep.
- Admin-routes blijven onder admin-groep.
- Redirects tussen domeinen alleen via expliciete, gecontroleerde paden.

Deliverables:
- Routekaart met toegestane redirect-matrix.
- Verwijdering van impliciete fallback-redirects via home-route.

Acceptatiecriteria:
- Geen redirect-keten meer van admin naar tenant-home tenzij expliciet bedoeld.
- Elke route in admin heeft een eenduidige guard-uitkomst.

Indicatie:
- 0.5 tot 1 dag.

## Werkpakket 2 — Aparte login-entrypoints

Doel:
- Login-intent expliciet maken per domein.

Scope:
- Tenant-login entrypoint (bijv. /login).
- Admin-login entrypoint (bijv. /admin/login).
- Behoud van bestaande sessiemechaniek.

Deliverables:
- Twee duidelijke loginpaden met eigen copy en foutmeldingen.
- next-doelafhandeling per pad zonder kruisbestuiving.

Acceptatiecriteria:
- Niet-ingelogd op admin komt altijd op admin-login intent uit.
- Niet-ingelogd op tenant komt altijd op tenant-login intent uit.
- Na succesvolle login landt gebruiker op het bedoelde next-pad.

Indicatie:
- 1 tot 2 dagen.

## Werkpakket 3 — Guards en auth-services per domein

Doel:
- Autorisatie per domein strikt en herbruikbaar maken.

Scope:
- App-guard (tenant-context vereist).
- Admin-guard (admin-rol vereist).
- Shared auth utilities beperken tot laag-niveau functies.

Deliverables:
- Domeinspecifieke guard-modules.
- Duidelijke contracten voor auth-fouten (auth-required, admin-required, etc.).

Acceptatiecriteria:
- Guard-logica voor admin en tenant zit niet in dezelfde UI-component.
- Geen side-effect redirectgedrag buiten guard-contracten.

Indicatie:
- 1 tot 1.5 dag.

## Werkpakket 4 — Feature-structuur opsplitsen

Doel:
- Code-eigenaarschap en wijzigingsimpact verkleinen.

Scope:
- Admin-feature code onder eigen feature namespace.
- Tenant-feature code onder eigen feature namespace.
- Shared map alleen voor echt gedeelde primitieve componenten en utiliteiten.

Deliverables:
- Nieuwe mapstructuur met duidelijke importregels.
- Basis lint-afspraken voor verboden kruisdomein-imports.

Acceptatiecriteria:
- Admin UI importeert niet direct uit tenant feature-mappen.
- Tenant UI importeert niet direct uit admin feature-mappen.

Indicatie:
- 1.5 tot 2 dagen.

## Werkpakket 5 — Redirect en toegangs-tests

Doel:
- Regressies in routing vroegtijdig vangen.

Scope:
- Integratie/E2E tests voor kritieke flows:
  - Niet-ingelogd naar admin
  - Non-admin naar admin
  - Admin naar admin installaties
  - Niet-ingelogd naar tenant pagina

Deliverables:
- Testset met redirect-chain assertions.
- CI-check die faalt op route-regressies.

Acceptatiecriteria:
- Alle kritieke redirectscenario's geautomatiseerd afgedekt.
- Nieuwe regressie in auth-routing breekt CI.

Indicatie:
- 1 tot 1.5 dag.

## Werkpakket 6 — Documentatie en rollout

Doel:
- Team en beheerproces laten aansluiten op de nieuwe structuur.

Scope:
- Update van architectuur- en requirementsdocumentatie.
- Korte rollout-checklist (test, deploy, verify).
- Support-notes voor bekende foutcodes en herstelstappen.

Deliverables:
- Bijgewerkte documentatie met voorbeeldflows.
- Rolloutplan met fallback-stappen.

Acceptatiecriteria:
- Nieuwe teamleden kunnen admin en tenant flow-intent in 5 minuten begrijpen.
- Productie-uitrol heeft een duidelijke verificatieprocedure.

Indicatie:
- 0.5 dag.

## Fasering

- Fase 1 (stabiliseren): WP1 + WP2 + WP5
- Fase 2 (hardening): WP3 + WP4
- Fase 3 (operationaliseren): WP6

## Afhankelijkheden

- Beschikbaarheid van admin-testaccount en non-admin testaccount.
- Toegang tot CI waar redirect-tests draaien.
- Afstemming met product over login-copy per domein.

## Risico's

- Onbedoelde breuk in bestaande deep links.
- Tijdelijke dubbeling van logincomponenten.
- Overschrijving van query-parameter gedrag als next-doel niet gevalideerd blijft.

## Definitie van klaar

De opsplitsing is klaar wanneer:
- Admin en tenant elk een eigen login-intent en guard-keten hebben.
- Kritieke redirectflows geautomatiseerd getest zijn.
- Organisatie-aanmaak op admin stabiel bereikbaar blijft zonder tenant-omweg.
