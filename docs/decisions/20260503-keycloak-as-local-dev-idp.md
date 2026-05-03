# LADR-035 — Keycloak als lokale dev-IdP voor SSO-testomgeving

**Date:** 2026-05-03  
**Status:** ACCEPTED  
**Decision:** De SSO-testomgeving (WP8) gebruikt Keycloak als lokale Identity Provider. Productie-installaties configureren een operator-gekozen OIDC-compatibele IdP via environment variabelen.

## Context

LADR-034 besluit dat Latero Control een OIDC Relying Party is en dat de app geen
auth-server zelf implementeert. Voor lokale ontwikkeling en integratietests is
een reproduceerbare, offline-bruikbare IdP nodig die:

- OIDC Authorization Code Flow + PKCE ondersteunt
- meerdere tenants, users en groups kan simuleren
- lokaal via Docker draait zonder externe afhankelijkheden
- TLS-compatibel is met de bestaande Caddy-setup

## Opties overwogen

| Optie | Pro | Con |
|---|---|---|
| **Keycloak** | Volledige OIDC-support, Docker-native, rijke admin UI, breed bekend | Relatief zwaar image |
| Dex | Lichtgewicht, Go-binary | Minimale UI, minder claim-simulatie mogelijkheden |
| mock-oauth2-server | Ultra-licht, testgericht | Geen persistent state, niet geschikt als team-gedeelde dev-IdP |
| Auth0 / externe SaaS | Realistisch | Vereist internet, secrets buiten team, ongeschikt voor CI |

## Decision

**Keycloak** wordt gebruikt als lokale dev-IdP in de Docker SSO-teststack (WP8).

Rationale:
- Volledige OIDC + PKCE support out-of-the-box
- Realms, clients, users en groups zijn reproduceerbaar via JSON-export/import
- Breed bekend bij data-engineering teams
- Draait stabiel achter Caddy reverse proxy met lokale TLS
- Geen externe afhankelijkheden of credentials buiten het team

**Scope van deze beslissing is uitsluitend de lokale dev/test-omgeving.**  
Productie-operators configureren hun eigen OIDC-compatibele IdP (Azure AD, Okta,
Google Workspace, Ping Identity, of eigen Keycloak-instantie) via:

```
OIDC_ISSUER=https://your-idp.example.com/realms/latero
OIDC_CLIENT_ID=latero-control
OIDC_CLIENT_SECRET=<via Docker secrets mount>
```

De app maakt geen aannames over de specifieke IdP-implementatie.

## Security constraints

- Keycloak draait alleen in `docker-compose.sso.yml` (dev/test), niet in `docker-compose.prod.yml`
- Lokale Keycloak gebruikt geen productie-secrets
- Seed-data voor dev-users en test-tenants wordt meegeleverd als JSON-import bestand
- Keycloak admin credentials voor lokale stack zijn gedocumenteerd in `infra/README.md`, niet in de app-codebase

## Consequences

- WP8 levert een `docker-compose.sso.yml` met Keycloak + Caddy + seed-data
- Team kan de volledige OIDC-flow lokaal testen zonder externe IdP
- Productie-documentatie (WP11) beschrijft de operator-configuratie voor eigen IdP
- De app-code bevat geen Keycloak-specifieke logica — alleen standaard OIDC
