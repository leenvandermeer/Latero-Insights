# LADR-039 — Admin/Tenant Layout- en CSS-isolatie via Next.js route group root layouts

Datum: 2026-05-03  
Status: ACCEPTED  
Supersedes: —  
Gerelateerd: LADR-028, LADR-033, LADR-037, admin-app-separation-workpackages.md

## Context

De huidige applicatiestructuur plaatst de admin-app en de tenant-app in
dezelfde Next.js root layout (`app/layout.tsx`) met een gedeelde `globals.css`.
Dit veroorzaakt structurele koppelingsproblemen:

1. **CSS-cascade lekkage** — `globals.css` definieert `input[type]` baseline-
   stijlen buiten Tailwind cascade layers. Dit overridet utility classes in
   admin-formulieren, wat leidt tot workarounds (inline `paddingLeft` styles).
2. **Thema-doorlopen** — `@theme` tokens en dark-mode overrides in `tokens.css`
   zijn bedoeld voor de tenant-app, maar raken ook admin-UI.
3. **Layout-groepen als lapmiddel** — `(admin-public)` en `admin/` zitten in
   dezelfde root layout maar hebben eigen shells. Dit creëert een conceptuele
   mismatch: de admin-app is geen onderdeel van de tenant-app.
4. **Gedeelde auth-utilities als koppelpunt** — `session-auth.ts` wordt gebruikt
   door zowel admin- als tenant-flows. De auth-primitieven zijn gedeeld, maar
   de domeinlogica loopt door elkaar.

De workarounds die hierdoor ontstaan (inline styles, `!important`, onnodige
cascadelagen) zijn symptomen van een structureel architectuurprobleem.

## Beslissing

Admin- en tenant-app krijgen **volledig geïsoleerde root layouts** via Next.js
route group root layouts. Elk domein heeft een eigen `<html>`/`<body>`, eigen
CSS-imports, en een eigen visuele baseline.

### 1. Route group structuur

```
src/app/
  (tenant)/           ← nieuwe root group voor tenant-app
    layout.tsx        ← tenant root layout (html, body, globals.css, tokens.css)
    (dashboard)/      ← bestaande dashboard group, verhuist hierheen
    login/            ← tenant login entrypoint
    page.tsx          ← redirect naar /pipelines of /dashboard
  (admin)/            ← nieuwe root group voor admin-app
    layout.tsx        ← admin root layout (html, body, admin-globals.css)
    (admin-public)/   ← bestaande public admin routes, verhuist hierheen
    admin/            ← bestaande protected admin routes, verhuist hierheen
  api/                ← API routes blijven op root niveau (geen layout)
```

Next.js staat meerdere root layouts toe via route groups. Elke group met een
eigen `layout.tsx` die `<html>` en `<body>` bevat, is volledig geïsoleerd.

### 2. CSS-isolatie

| Bestand | Scope |
|---------|-------|
| `src/styles/globals.css` | Tenant-only (importeert Tailwind + tokens) |
| `src/styles/admin-globals.css` | Admin-only (eigen baseline, geen Tailwind cascade conflict) |
| `src/styles/tokens.css` | Tenant-only design tokens |
| `src/styles/admin-tokens.css` | Admin-only tokens (operationele kleurpalette) |

Admin-globals gebruikt **geen** generieke `input[type]` selectors buiten cascade
layers. Alle form-stijlen in de admin-app worden via Tailwind utilities of
expliciete component-styles aangebracht.

### 3. Gedeelde code: wat mag en wat niet

**Mag gedeeld worden (in `src/lib/`):**
- `session-auth.ts` — laag-niveau DB auth primitieven
- `pg.ts` / `getPgPool()` — databaseverbinding
- Typedefenities die beide domeinen delen

**Mag NIET gedeeld worden (domeinspecifiek):**
- Admin layout-components → `src/components/admin/`
- Tenant layout-components → `src/components/` (huidige structuur)
- CSS baselines en design tokens

### 4. Migratiestrategie

Dit is een **gefaseerde migratie** conform de werkpakketten in
`admin-app-separation-workpackages.md`:

**Fase 1 — CSS-isolatie (prioriteit)**
1. Maak `src/styles/admin-globals.css` zonder conflicterende input-selectors.
2. Maak `src/app/(admin)/layout.tsx` als nieuwe admin root layout.
3. Verplaats `(admin-public)/` en `admin/` naar `(admin)/`.
4. Verplaats tenant-routes naar `(tenant)/`.
5. Verwijder admin-specifieke workarounds (inline `paddingLeft`, etc.).

**Fase 2 — Component-isolatie**
- Admin-componenten verhuizen naar `src/components/admin/`.
- Geen imports meer van admin-componenten in tenant-code en vice versa.

**Fase 3 — Guard-isolatie**
- `requireAdminSession` verhuist naar `src/lib/admin-auth.ts` (al aanwezig).
- Tenant-auth guard in eigen module.

### 5. Wat NIET verandert

- Postgres als single read-store (LADR-026).
- Sessiemechaniek en cookie-contract.
- API-routes op root niveau (`src/app/api/`).
- Geen aparte repository of aparte Next.js app in deze fase.
- Shared widget library (LADR-012) blijft tenant-only.

## Motivatie

De tenant-app en de admin-app zijn twee fundamenteel verschillende producten
voor twee verschillende gebruikers. Ze mogen niet dezelfde CSS-cascade, layout-
boom, of visuele baseline delen. Het structureel isoleren van deze domeinen
elimineert een hele klasse van workarounds en maakt de codebase voorspelbaar.

## Consequenties

- Imports in admin-pagina's verwijzen naar `(admin)/` path (Next.js App Router
  routeert intern correct via route groups).
- Bestaande URL-structuur verandert niet (`/admin/*` blijft `/admin/*`).
- Build-output verandert niet voor eindgebruikers.
- Nieuwe developers zien twee duidelijk gescheiden roots en begrijpen direct
  de eigendomsgrenzen.

## Acceptatiecriteria

- Admin-app importeert `globals.css` en `tokens.css` niet meer.
- Geen inline `paddingLeft`/`paddingRight` workarounds in admin-formulieren.
- Wijzigingen aan tenant-CSS veroorzaken geen visuele regressies in admin-UI.
- TypeScript build slaagt zonder fouten.
- URL-structuur voor eindgebruikers is ongewijzigd.
