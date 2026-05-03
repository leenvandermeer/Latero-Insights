# SSO and Local Authentication Feature

Status: Draft  
Owner: Product + Engineering + Security  
Date: 2026-05-03

## Context

Latero Control gebruikt vandaag een eigen session-auth model met lokale
email/wachtwoord-login en een server-side sessiecookie. Voor SaaS-inzet is dat
niet voldoende voor klanten die centrale identity governance, federatie,
offboarding en access policies via een enterprise identity provider vereisen.

Tegelijk is een volledig verbod op lokale accounts onpraktisch voor:

- bootstrap van een nieuwe installatie
- emergency access wanneer de identity provider niet beschikbaar is
- lokale development- en testomgevingen

Daarom introduceert dit document een hybride auth-model waarin SSO de primaire
route wordt, met een beperkte en expliciet beheerste lokale fallback.

## Doel

- Enterprise SSO ondersteunen voor SaaS-klanten.
- Het bestaande session-cookie model behouden als enige app-sessie.
- Lokale accounts veilig blijven ondersteunen voor bootstrap, break-glass en
  development.
- Tenant-isolatie en admin-scheiding behouden in alle auth-flows.

## Niet-doelen

- Geen directe SAML-implementatie in de Next.js-app.
- Geen opslag van IdP access tokens of refresh tokens in de browser.
- Geen automatische admin-toekenning op basis van onbeperkte externe claims.
- Geen globale, tenant-onafhankelijke auth-configuratie.

## Beslissing

Latero Control ondersteunt:

- `OIDC Authorization Code Flow + PKCE` als standaard SSO-protocol
- een interne Latero-sessie in Postgres + `HttpOnly` cookie na succesvolle
  OIDC-callback
- per installatie configureerbare auth-policies
- een gecontroleerde lokale login fallback

Latero Control ondersteunt niet:

- direct SAML in de applicatiecode
- implicit of hybrid OAuth/OIDC flows
- opslag van OIDC tokens in localStorage of sessionStorage

## Auth Model

### 1. SSO-first

SSO is de primaire gebruikersflow voor enterprise tenants. De browser wordt
naar de identity provider gestuurd. Na succesvolle OIDC-callback valideert de
server de response en maakt Latero een eigen sessie aan.

De app vertrouwt daarna alleen nog op de Latero-sessie, niet op een browser-side
IdP-token.

### 2. Local fallback

Lokale email/wachtwoord-auth blijft mogelijk, maar alleen op basis van policy.
Lokale auth is bedoeld voor:

- break-glass beheeraccounts
- initiële bootstrap van een tenant
- development en test
- tenants zonder geconfigureerde SSO

### 3. Per-installatie auth policy

Elke installatie krijgt een expliciete auth-policy:

- `sso_only`
- `sso_with_break_glass`
- `sso_with_local_fallback`
- `local_only`

Aanbevolen SaaS-default:

- production enterprise tenants: `sso_with_break_glass`
- development/local tenants: `local_only` of `sso_with_local_fallback`

## Security Principles

### Identity binding

- Externe identity wordt primair gekoppeld op `issuer + subject`
- E-mail is alleen ondersteunend voor display of aanvullende policy-checks
- Een match op e-mail alleen is onvoldoende voor account linking

### Session bridging

- De OIDC callback wordt server-side verwerkt
- Latero mint een eigen sessie-id
- Alleen de gehashte sessiewaarde wordt opgeslagen in Postgres
- De browser ontvangt alleen een `HttpOnly` sessiecookie

### Tenant isolation

- Auth-configuratie is installatie-scoped
- Provisioning en role mapping zijn installatie-scoped
- `active_installation_id` blijft server-side de bron voor datatoegang

### Deny-by-default provisioning

- JIT provisioning mag alleen wanneer de installatie-config dat expliciet
  toestaat
- Toegang zonder match op issuer en policy-regels wordt geweigerd

### Role mapping

- Externe groepen/claims mappen naar interne installatierollen
- `is_admin` wordt niet blind overgenomen uit tenant-claims
- Admin-toegang vereist een aparte allowlist of aparte policy

### CSRF and callback integrity

- `state`, `nonce` en `PKCE (S256)` zijn verplicht in de OIDC flow
- Muterende cookie-auth endpoints gebruiken expliciete CSRF-bescherming

### Secrets management

- OIDC client secrets horen niet in `.cache/settings.json`
- Secrets worden beheerd via environment files of Docker secrets

## Functional Requirements

### Installation-scoped SSO configuration

Per installatie moet configureerbaar zijn:

- `issuer`
- `client_id`
- `client_secret` via secure secret storage
- `redirect_uri`
- `post_logout_redirect_uri`
- allowed email domains
- allowed groups or claim rules
- mapping van externe claims naar interne rollen
- auth-policy mode

### Local account restrictions

Lokale login moet per installatie uitschakelbaar zijn.

Voor break-glass accounts geldt:

- aparte markering of policy
- extra audit logging
- sterke wachtwoordvereisten
- optioneel verplichte tweede factor in latere fase

### Audit events

Minimaal deze auth-events worden gelogd:

- login success
- login failure
- callback validation failure
- provisioning success/failure
- local password login success/failure
- logout
- session revocation
- installation switch
- auth-policy wijziging
- SSO-config wijziging

Tokens en volledige claims dumps mogen niet gelogd worden.

## Docker and Test Environment Requirements

De lokale testomgeving moet een realistische SSO-setup ondersteunen:

- lokale IdP, bij voorkeur Keycloak
- HTTPS via Caddy
- vaste lokale hostnames
- minimaal twee installaties
- minimaal twee gebruikerssets
- testgroepen of claims voor role mapping

Aanbevolen hostnames:

- `app.latero.test`
- `idp.latero.test`

## Recommended Rollout

### Phase 1

- OIDC + lokale sessiebridging
- installatie-scoped SSO-config
- handmatige user mapping
- break-glass local admin
- Docker SSO testomgeving

### Phase 2

- JIT provisioning met policy checks
- claim-based role mapping
- uitgebreider audit trail
- admin UI voor auth-config

### Phase 3

- geavanceerde logout flows
- periodieke membership revalidation
- optionele 2FA voor lokale break-glass admins

## Definition of Done

Deze feature is klaar wanneer:

- enterprise tenant-gebruikers via OIDC kunnen inloggen
- de app alleen een interne Latero-sessie gebruikt
- lokale fallback alleen werkt volgens installatie-policy
- cross-tenant login bleed aantoonbaar faalt
- auth-events geaudit worden
- de lokale Docker SSO-stack reproduceerbaar werkt op HTTPS
