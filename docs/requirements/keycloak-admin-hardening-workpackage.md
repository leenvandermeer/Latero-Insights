# WP-SEC-001 — Keycloak admin hardening on `sso.latero.nl` without a new public subdomain

**Status:** PROPOSED  
**Datum:** 2026-05-11  
**Auteurs:** Codex, Product Architect Agent  
**ADR:** [LADR-073](../decisions/20260511-keycloak-admin-exposure-without-new-subdomain.md)

---

## Probleemstelling

De productie-opzet gebruikt `sso.latero.nl` als publieke Keycloak-host. Hoewel
Keycloak intern draait op localhost en poort `9000` niet publiek open staat,
wordt de adminconsole momenteel via de reverse proxy alsnog publiek
bereikbaar.

De gewenste eindtoestand is:

- `sso.latero.nl` blijft de publieke SSO-host
- er komt geen nieuw publiek subdomain
- admin is alleen bereikbaar voor operators via VPN of tijdelijke allowlist
- login/OIDC voor eindgebruikers blijft publiek werken

---

## Doelstelling

1. Publieke SSO-flow behouden op `sso.latero.nl`
2. Keycloak adminconsole en admin-routes afschermen zonder nieuw publiek
   subdomain
3. Productie-opzet in Docker/Caddy expliciet hardenen
4. Operator access laten afhangen van VPN/access-layer in plaats van open
   internet

---

## Scope

### In scope

- productie Docker Compose voor SSO-stack
- productie Caddy-config voor `sso.latero.nl`
- documentatie van vereiste VPN/access-layer
- validatie van publiek toegestane versus afgeschermde Keycloak-routes

### Out of scope

- volledige realm redesign
- migratie naar andere identity provider
- multi-host refactor van de gehele productieomgeving
- managed VPN-provisioning buiten het Latero repo

---

## Operatorbesluit

### Vastgelegd

- geen nieuw publiek subdomain voor admin
- `sso.latero.nl` blijft de vertrouwde publieke host
- admin wordt afgeschermd via VPN / access control

### Nog buiten deze repo te regelen

- keuze en inrichting van de VPN-oplossing
- client-onboarding voor operator devices
- DNS-aanpassing alleen als intern/VPN-DNS nodig blijkt

---

## Aanbevolen infrastructuurkeuze

### Voorkeur

- een kleine WireGuard VPN-server voor operator access
- admin-verkeer op `sso.latero.nl` alleen toestaan vanaf VPN-IP-range

### Hetzner-notitie

Hetzner levert geen managed corporate VPN-dienst als onderdeel van de Latero
stack, maar ondersteunt wel prima een self-managed WireGuard-server of app op
Hun infrastructuur.

---

## Deliverables

### WP-1 — Exposure inventory

- [ ] Publieke Keycloak-routes inventariseren die nodig zijn voor OIDC/login
- [ ] Admin-routes inventariseren die afgeschermd moeten worden
- [ ] Huidige Caddy-route-matchers expliciet classificeren als `public` of `admin`

### WP-2 — Proxy hardening design

- [ ] Productie-Caddyflow ontwerpen zonder nieuw publiek subdomain
- [ ] Routebeleid specificeren voor:
      - publieke realm/OIDC routes
      - admin console
      - admin API/console assets
- [ ] Beslissen hoe VPN/allowlist-condities in Caddy worden afgedwongen

### WP-3 — Docker/prod implementation

- [ ] `infra/docker/Caddyfile.prod-sso` aanpassen naar routebewuste exposure
- [ ] `infra/docker/docker-compose.prod-sso.yml` nalopen op Keycloak
      hostname/proxy-hardening
- [ ] Controleren dat Keycloak alleen localhost-bound blijft op `8080`
- [ ] Bevestigen dat `9000` uitsluitend intern gebruikt blijft voor health

### WP-4 — Operator access integration

- [ ] VPN-range of tijdelijke beheer-allowlist documenteren als variabele
- [ ] Runbook opnemen voor operator access tot Keycloak admin
- [ ] Fallback-procedure beschrijven als VPN tijdelijk niet beschikbaar is

### WP-5 — Validation

- [ ] Verifiëren dat `/.well-known/*`, login en OIDC callback publiek werken
- [ ] Verifiëren dat `/admin` zonder VPN/access faalt
- [ ] Verifiëren dat `/admin` met operator access werkt
- [ ] Verifiëren dat app-authflows (`/api/auth/sso/initiate`, callback, logout)
      ongewijzigd correct blijven

---

## Acceptatiecriteria

1. `sso.latero.nl` blijft de enige publieke SSO-host
2. Keycloak adminconsole is niet vrij bereikbaar vanaf het open internet
3. Publieke OIDC- en loginflows blijven werken zonder operatortoegang
4. `9000` wordt nergens publiek geproxied of exposed
5. De productie-opzet is reproduceerbaar via de repo-configuratie en een
   expliciet operator-access runbook

---

## Benodigd van operator

1. Bevestiging van de gekozen VPN-oplossing
2. Beschikbare operator-IP-range of VPN-subnet
3. Bevestiging of tijdelijke allowlist nodig is tijdens uitrol

---

## Aanbevolen uitvoervolgorde

1. VPN-/allowlistkeuze definitief maken
2. Caddy route hardening ontwerpen
3. Docker/Caddy productieconfig aanpassen
4. Validatie van publieke loginflows
5. Validatie van adminblokkade en operatortoegang

---

## Notities

- Als admin uitsluitend via VPN bereikbaar hoeft te zijn, is een extra publiek
  subdomain niet nodig
- Als later toch een aparte admin-host gewenst is, vereist dat een nieuwe ADR
  omdat dit een expliciete trust- en exposurewijziging is
