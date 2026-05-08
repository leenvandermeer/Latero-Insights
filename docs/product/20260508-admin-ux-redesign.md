# Admin UX Redesign

## Problem

De admin-module voelde visueel en interactioneel nog als een apart product:

- afwijkende `slate`-achtige styling
- te veel contexttekst en verticale ruimte
- inconsistente feedback- en confirm-patronen
- onduidelijke tenant-toewijzing in user management
- geen sterke Latero-brand presence linksboven

Daardoor miste de admin-console dezelfde rust, hiërarchie en merkconsistentie als de tenant-app.

## UX direction

De admin-module moet aanvoelen als `Latero Control`, maar met een operator-focus.

Dat betekent:

- dezelfde merkidentiteit als de hoofdapp
- compactere surfaces en headers
- minder uitlegtekst, meer scanbaarheid
- consistente feedback cards, dialogs en actions
- duidelijke tenant assignment flows voor operators

## Key changes

### 1. Shared Latero admin shell

De admin-shell gebruikt nu dezelfde visuele taal als de rest van het product:

- Latero mark linksboven
- `Latero` / `Control` lockup
- `Platform Admin` als contextlabel
- warme Latero surfaces in plaats van generieke dark/slate panelen

### 2. Compact page hierarchy

Admin-pagina’s gebruiken nu dezelfde basispatronen:

- `AdminPageHeader`
- `AdminSurface`
- `AdminSectionTitle`

Dat zorgt voor:

- kortere headers
- minder overbodige beschrijving
- betere visuele ritmiek tussen overview, health, audit, installations, users en auth config

### 3. Compact forms and dialogs

De installatie- en users-flows zijn visueel geharmoniseerd:

- rondere, compactere modals
- consistente primary/secondary actions
- uniforme confirm dialogs voor `Rotate API key`, `Remove user`, `Reset 2FA`
- compacte warning/success cards voor one-time secrets en tijdelijke wachtwoorden

### 4. Tenant assignment is no longer fragile

De user management flow had een belangrijk UX-probleem:

- als de admin installations feed leeg of incompleet terugkwam, was tenant-selectie praktisch stuk

Daarom is nu:

- de installations API verrijkt met fallback catalog entries uit memberships en aanwezige metadata
- de user modal voorzien van een fallback tenant list
- tenant search toegevoegd aan `New user` en `Edit access`
- een nette empty/fallback state toegevoegd

Dit maakt tenant-toekenning bruikbaar, ook bij onvolledige catalog-data.

### 5. Admin metrics are now meaningful

De admin-meters zijn gecorrigeerd zodat ze beter aansluiten op echte tenantactiviteit:

- `healthy` snapshots tellen nu mee als `connected`
- actieve tenants zonder health snapshot krijgen fallback metrics uit `meta.*`
- message counts en error rates worden consistenter berekend

Dit is deels een UX-fix en deels een data integrity-fix: operators mogen geen lege of misleidende samenvatting zien.

## Affected areas

Belangrijkste aangepaste gebieden in deze redesign:

- admin shell
- overview
- health
- audit
- installations list
- installation detail
- auth configuration
- users
- onboarding and access modals

## Best-practice rationale

Deze redesign volgt een paar duidelijke operator-console patronen:

- navigation is for destinations, not object sprawl
- headers should orient, not narrate
- forms should prefer short labels over explanatory paragraphs
- destructive actions need compact but clear confirmation
- assignment flows need search when object count grows
- admin views must be data-trustworthy before they can be visually trustworthy

## Result

De admin-console is nu:

- compacter
- merkconsistenter
- beter scanbaar
- betrouwbaarder in tenant assignment
- consistenter in feedback en dialoggedrag

## Next recommended step

De volgende logische stap is een inhoudelijke UX-slag op `/runs` of een laatste cross-product polish op:

- spacing consistency tussen admin en tenant modals
- copy consistency in operational actions
- eventuele responsive tuning op small laptop widths
