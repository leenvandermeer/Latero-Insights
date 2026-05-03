# LADR-038 — Installation switcher: environment indicator en default-installatie

**Datum:** 2026-05-03  
**Status:** ACCEPTED  
**Auteur:** Tech Lead  

---

## Context

Gebruikers met toegang tot meerdere installaties (bv. production + staging) zien
in de sidebar alleen het installatielabel en de installatie-ID. Er is geen visuele
indicator voor de omgeving (production / staging / development), geen inline-
switcher, en geen manier om een voorkeurs-installatie in te stellen.

Dit leidt tot:
- Onduidelijkheid over welke omgeving actief is — met name riskant als production
  en staging naast elkaar bestaan.
- Onnodige navigatie: de gebruiker moet naar een andere pagina om van installatie
  te wisselen (via `TenantScopeBanner` of dashboard-widget menu).
- Geen persistentie van voorkeur: elke keer na inloggen is de actieve installatie
  afhankelijk van de volgorde in de sessie, niet van de gebruikersvoorkeur.

---

## Beslissing

De `InstallationPicker`-component in de sidebar wordt uitgebreid met:

### 1. Environment badge

Elke installatie toont een badge met de waarde van het `environment` veld
(`production`, `staging`, `development` of andere waarden). Kleurcodering via
bestaande design tokens:

| Waarde | Background | Text |
|--------|-----------|------|
| `production` | `var(--color-error-bg)` | `var(--color-error)` |
| `staging` | `var(--color-warning-bg)` | `var(--color-warning)` |
| overig | `var(--color-surface-alt)` | `var(--color-text-muted)` |

In collapsed state: een gekleurde dot (3 × 3 px) linksonder op het building-icon.

### 2. Inline switcher (multi-install)

Als `installations.length > 1`: de picker-card is klikbaar en opent een inline
dropdown direct onder de card. Elke rij toont: label + environment badge + ster-icoon.

### 3. Default-installatie

De gebruiker kan een default-installatie instellen via een ster-icoon (☆/⭐) naast
elke installatierij. De default wordt opgeslagen in de database:

```sql
ALTER TABLE insights_users
  ADD COLUMN IF NOT EXISTS default_installation_id TEXT
  REFERENCES insights_installations(installation_id) ON DELETE SET NULL;
```

Nieuw API-endpoint: `POST /api/auth/set-default-installation`  
Body: `{ installation_id: string }`  
Auth: vereist geldige sessie.

Bij inloggen: als `default_installation_id` is ingesteld en de gebruiker toegang
heeft tot die installatie, wordt deze automatisch als actieve installatie gekozen
(in `createSession`).

### 4. Session response uitbreiding

Het `/api/auth/session` endpoint voegt toe:
```json
{
  "default_installation_id": "sso-test-acme" | null
}
```

`InstallationContext` exposeert `defaultInstallationId: string | null` en
`setDefaultInstallation(id: string): Promise<boolean>`.

---

## Niet in scope

- Hernoemen/bewerken van installatie-labels vanuit de picker → /settings
- Archived installations in de switcher tonen → altijd alleen `active: true`
- Subdomain-switching (zie toekomstige infra-ADR)

---

## Consequenties

- Eén SQL-migratie vereist (`default_installation_id` kolom)
- `createSession` in `session-auth.ts` gebruikt `default_installation_id` als
  startinstallatie bij login
- Geen breaking changes; single-install users zien alleen de env-badge
- `TenantScopeBanner` en dashboard-widget menu behouden hun bestaande switcher
  (achterwaartse compatibiliteit)
