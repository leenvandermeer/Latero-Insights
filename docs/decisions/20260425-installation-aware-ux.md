# LADR-027 — Installation-aware UX: multi-tenancy groundwork (stap 1 & 2)

Datum: 2026-04-25
Status: ACCEPTED

## Context

Latero Control ondersteunt meerdere Latero runtime-installaties via de
`insights_installations` tabel en per-installation bearer-token auth op de
`/api/v1/*` ingest routes (LADR-025). De onderliggende Postgres-tabellen
(`pipeline_runs`, `data_quality_checks`, `data_lineage`) hebben een
`installation_id` kolom en bijbehorende indices op `(installation_id,
event_date)`.

Tot nu toe negeerden alle dashboard-gerichte API routes en data-hooks de
`installation_id`. Dit betekende dat alle data van alle installaties door
elkaar werd getoond, zonder dat een operator kon wisselen van context. Voor
single-tenant deployments is dit geen probleem, maar voor multi-tenant en
SaaS-deployments is een tenant-selectiemechanisme noodzakelijk.

De gewenste aanpak is incrementeel: begin met een operator-facing
installation-switcher in de UX, en zorg dan dat API routes en query-functies
filteren op de geselecteerde installatie. Complexere isolatielagen (RLS,
auth-per-tenant) komen in latere stappen.

## Beslissing

**Stap 1 — Installation selection in de UX**

Een `InstallationProvider` React-context beheert de actieve installatie voor
de dashboardsessie. De geselecteerde `installationId` wordt gepersisteerd in
`localStorage` onder de sleutel `insights-installation-v1`.

```
GET /api/installations
  └── leest actieve installations uit insights_installations (Postgres)
  └── response: InstallationSummary[]

InstallationProvider (React context)
  └── useInstallation() hook
  └── persisteert installationId in localStorage
  └── gewrapped om de dashboard layout group

InstallationPicker (dropdown component)
  └── alleen zichtbaar bij ≥ 2 installations (backward compatible)
  └── geplaatst in de sidebar navigation
```

**Stap 2 — installation_id filter in alle read queries**

Alle vijf data-hooks lezen `installationId` uit `useInstallation()` en geven
die mee als query-param aan hun respectieve API routes. TanStack Query keys
bevatten `installationId` zodat per-installation caching correct werkt.

API routes propageren `installation_id` naar de SQL-querylaag via een
geparametriseerde `$1` binding. Alle read-functies in `insights-saas-read.ts`
accepteren een optionele `installationId` parameter; bij afwezigheid wordt
niet gefilterd (backward compatible voor single-tenant deployments).

```
useInstallation() → installationId
  ↓
data hook (query key bevat installationId)
  ↓
API route (?installation_id=<id>)
  ↓
read-functie (WHERE installation_id = $1)
```

## Gewijzigde bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/app/api/installations/route.ts` | Nieuw endpoint: leest actieve installations |
| `src/contexts/installation-context.tsx` | `InstallationProvider` + `useInstallation()` |
| `src/components/navigation/installation-picker.tsx` | Dropdown UI, conditioneel bij ≥ 2 installations |
| `src/app/(dashboard)/layout.tsx` | Gewrapped met `InstallationProvider` |
| `src/hooks/use-pipelines.ts` | Leest en propageert `installationId` |
| `src/hooks/use-quality.ts` | Leest en propageert `installationId` |
| `src/hooks/use-lineage.ts` | Leest en propageert `installationId` |
| `src/hooks/use-lineage-entities.ts` | Leest en propageert `installationId` |
| `src/hooks/use-lineage-attributes.ts` | Leest en propageert `installationId` |
| `src/lib/insights-saas-read.ts` | `getLineageEntitiesFromSaaS` en `getLineageAttributesFromSaaS` filteren op `installation_id` |
| `src/app/api/lineage/entities/route.ts` | Leest `installation_id` query-param, cacht per-installation |
| `src/app/api/lineage/attributes/route.ts` | Leest `installation_id` query-param, cacht per-installation |

## Consequenties

- **Backward compatible.** Bij één actieve installation is de picker
  onzichtbaar en gedraagt de app zich identiek aan voor deze wijziging.
- **Per-installation TanStack Query caching.** Data voor verschillende
  installaties wordt niet vermengd in de client-side cache.
- **localStorage binding.** De geselecteerde installatie is browser-lokaal.
  Bij een nieuwe sessie of ander apparaat wordt de eerste actieve installation
  als default gebruikt.
- **Geen auth-isolatie.** Elke gebruiker met toegang tot de webapp kan wisselen
  tussen installaties. Row-level security en sessiebeheer per tenant zijn
  bewust buiten scope gelaten (zie roadmap).
- **`/api/installations` is onbeveiligd.** Het endpoint geeft enkel
  naam en ID terug, geen gevoelige data. Authenticatie op dit endpoint
  volgt in stap 3.

## Buiten scope (roadmap)

| Stap | Omschrijving |
|------|-------------|
| Stap 3 | UX login / sessie per tenant — auth-provider, login flow |
| Stap 4 | Row-level security in Postgres per `installation_id` |
| Stap 5 | Tenant-admin UI — installatiebeheer, token-rotatie |
| Stap 6 | Multi-org met billing-isolatie |

## Update — Stap 3, 4 en 5 geactiveerd (2026-04-25)

De oorspronkelijke roadmap-items voor sessie-auth, tenant-isolatie in reads en
token lifecycle zijn nu in een eerste versie gerealiseerd.

### Nieuwe UX-flow (multi-org, volgens productrichtlijnen)

- Inlogscherm gebruikt e-mailadres + wachtwoord (geen API key invoer meer).
- Na inloggen wordt een server-side sessiecookie gebruikt (`HttpOnly`).
- In de sidebar wordt de actieve organisatie zichtbaar getoond.
- Gebruikers met meerdere organisaties krijgen een compacte switcher in de
  sidebar om realtime van context te wisselen.
- 2FA is "ready": de flow exposeert expliciet `two_factor_*` statusvelden,
  zodat een volgende stap zonder UX-breuk kan worden toegevoegd.

### Backend-auth model

- Nieuwe auth endpoints:
  - `POST /api/auth/login`
  - `GET /api/auth/session`
  - `POST /api/auth/switch-installation`
  - `POST /api/auth/logout`
- Nieuwe tabellen:
  - `insights_users`
  - `insights_user_installations`
  - `insights_sessions`
- Dashboard read APIs forceren `installation_id` op basis van de sessie.
  Query-params kunnen de sessie-tenant niet overrulen.

### Key lifecycle (tenant admin)

- Installations manager ondersteunt nu:
  - key rotatie (nieuwe sleutel, eenmalig getoond)
  - revoke
  - weergave van `last_token_used_at`

### Veiligheidsimpact

- Tenant context is niet langer browser-lokaal via `localStorage`.
- Sleutels blijven buiten JS-toegankelijke storage; sessie draait op cookie.
- Multi-org wisselen blijft expliciet zichtbaar in de navigatie.

## Alternatieven overwogen

- **URL-based tenant routing** (`/[installationId]/...`): vollediger, maar
  breekt bestaande links en vergroot de routingcomplexiteit aanzienlijk. Niet
  wenselijk in deze fase.
- **Subdomain-based routing** (`tenant.insights.example.com`): vereist
  infrastructuurwijzigingen buiten de webapp. Geschikt voor stap 6, niet nu.
- **Geen switcher, automatisch de enige installation selecteren**: dekt de
  single-tenant use case maar biedt geen pad naar multi-tenant zonder
  herarchitectuur.
