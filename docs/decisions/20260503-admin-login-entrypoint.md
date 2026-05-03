# LADR-037 — Separate login entrypoint voor platform operators (/admin/login)

**Datum:** 2026-05-03  
**Status:** ACCEPTED  
**Auteur:** Tech Lead  

---

## Context

Latero Control heeft twee conceptueel verschillende admin-lagen:

| Laag | Guard | Route | Doel |
|------|-------|-------|------|
| Platform operator | `is_break_glass` | `/admin/*` | Installaties, gebruikers, platform beheer |
| Tenant admin | `is_admin` | `/settings` | Auth-config, eigen installatie instellen |

In de oorspronkelijke implementatie (LADR-028) werd de `/admin` sectie ontsloten via de
standaard `InstallationGate` — hetzelfde loginformulier als voor tenant-gebruikers. De
`/admin/layout.tsx` redirectte bij ontbrekende sessie naar `/settings?error=auth-required`.

Dit leidde tot twee problemen:

1. **Conceptuele vervuiling**: een platform-operator logt in via het tenant-loginscherm en
   navigeert dan door de tenant-navigatiestructuur naar `/admin`. De `/admin`-sectie is
   geen onderdeel van de tenant-ervaring.
2. **Onnodige koppeling**: `admin@latero.local` had zowel `is_break_glass` als `is_admin`,
   waardoor dit account onbedoeld ook toegang had tot tenant-instellingen als lid van een
   installatie.

---

## Beslissing

De `/admin` sectie krijgt een **eigen, geïsoleerd loginpad**: `/admin/login`.

### Regels

- `/admin/login` is een standalone pagina buiten de `(dashboard)` route group en buiten
  de `InstallationGate`. Geen tenant-context nodig.
- `/admin/layout.tsx` redirectt unauthenticated requests naar `/admin/login` (niet naar
  `/settings`).
- Logout vanuit de admin-shell redirectt naar `/admin/login` (niet naar `/`).
- `admin@latero.local` is een **platform-only account**: `is_break_glass = TRUE`,
  `is_admin = FALSE`. Dit account is geen lid van enige tenant-installatie.
- Tenant-admin accounts (`is_admin = TRUE`, `is_break_glass = FALSE`) hebben **geen**
  toegang tot `/admin/*` — zij beheren uitsluitend `/settings` van hun eigen installatie.
- De tenant-sidebar toont geen link naar `/admin`. De admin-URL is niet zichtbaar in de
  product-navigatie.

### Niet in scope

- Subdomain-splitsing (`admin.latero.io` vs `app.latero.io`) — dit is het gewenste
  productie-eindpunt maar vereist infra-wijzigingen (Caddy, cookie-domain) en een
  aparte ADR.
- Aparte sessie-store voor platform-operators — beide admin-lagen gebruiken dezelfde
  `insights_sessions` tabel; de guard op `/admin/*` blijft de `is_break_glass` kolom.

---

## Consequenties

- Platform-operators bookmarken `/admin/login` of navigeren direct naar `/admin`.
- De UX voor normale tenant-gebruikers verandert niet.
- `admin@latero.local` heeft geen `is_admin` meer; seed-script bijgewerkt.
- Bij een eventuele subdomain-splitsing (LADR-0xx) vervalt `/admin/login` ten gunste
  van een eigen Next.js app-entry.
