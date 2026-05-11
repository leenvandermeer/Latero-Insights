# LADR-073 — Keycloak admin exposure hardening without introducing a new public subdomain

**Status:** PROPOSED  
**Datum:** 2026-05-11  
**Auteur(s):** Codex, Product Architect Agent  
**Gerelateerde requirements:** [WP-SEC-001](../requirements/keycloak-admin-hardening-workpackage.md)

---

## Context

Latero Control gebruikt Keycloak als publieke SSO-provider via
`https://sso.latero.nl`. In de huidige productie-opzet wordt de volledige host
`sso.latero.nl` door Caddy geproxied naar Keycloak. Daardoor is de Keycloak
adminconsole publiek bereikbaar via dezelfde vertrouwde SSO-host, ondanks dat
de onderliggende Keycloak-poorten (`8080`, `9000`) niet publiek open staan.

De productwens is expliciet:

- `sso.latero.nl` moet behouden blijven als vertrouwde publieke identity-host
- er komt **geen nieuw publiek subdomain** voor admin
- admin hoeft niet vanaf het open internet bereikbaar te zijn
- admin mag wel bereikbaar zijn voor operators via VPN of andere afgeschermde
  toegang

Daarnaast draait de stack op een Hetzner-server, waar publiek verkeer via
Caddy/TLS op `80/443` binnenkomt.

---

## Probleem

De huidige configuratie scheidt netwerk-exposure wel op poortniveau, maar niet
op functieniveau:

- `9000` is alleen intern voor health
- `8080` is alleen localhost-bound
- maar de **adminconsole wordt via Caddy alsnog publiek op `sso.latero.nl`
  ontsloten**

Dit geeft onnodige attack surface en gebruikt dezelfde trust-lijn voor twee
verschillende doelen:

1. publieke user login / OIDC flows
2. operator-admin voor realm- en identitybeheer

---

## Beslissing

Latero Control hardent de Keycloak-productie-opzet als volgt:

1. `sso.latero.nl` blijft de enige publieke SSO-host.
2. Er wordt **geen nieuw publiek admin-subdomain** geïntroduceerd.
3. Keycloak admin wordt niet langer vrij bereikbaar via de publieke internetpad.
4. Toegang tot admin gebeurt via een operator-VPN-laag op dezelfde host.
5. De reverse proxy laat publieke OIDC/login-routes op `sso.latero.nl` toe,
   maar schermt admin-routes af via VPN- of allowlist-voorwaarden.
6. Poort `9000` blijft intern-only voor health en wordt nooit geproxied.
7. De productie-opzet documenteert expliciet dat adminbereikbaarheid een
   **network access concern** is, niet een Keycloak-poort-exposure concern.

---

## Rationale

Deze keuze balanceert security en trust:

- gebruikers en klanten blijven dezelfde publieke SSO-host zien
- de opgebouwde trust rond `sso.latero.nl` blijft intact
- admin krijgt geen aparte publieke merkuitstraling
- operator-toegang wordt verplaatst naar een expliciet afgeschermde laag
- de bestaande single-host productie-opzet blijft bruikbaar zonder grote
  platformverbouwing

---

## Consequences

### Positief

- minder publieke admin exposure
- geen extra publiek subdomain nodig
- kleine impact op huidige login/OIDC-flow
- duidelijke scheiding tussen user identity en operator beheer

### Negatief / trade-offs

- admin-toegang wordt afhankelijk van VPN of access-layer beheer
- Caddy-configuratie moet routebewust worden in plaats van host-only
- operators moeten een extra stap nemen om admin te bereiken

---

## Uitgesloten alternatieven

### 1. Publiek `admin-sso.latero.nl`

Technisch schoon, maar afgewezen omdat dit een tweede publieke trust-lijn voor
identity introduceert en niet past bij de gewenste merk- en trustopbouw.

### 2. Alles publiek houden en alleen vertrouwen op Keycloak-login

Afgewezen omdat dit admin-attack-surface onnodig breed laat.

### 3. Keycloak alleen intern en user login ook via VPN

Afgewezen omdat publieke SSO-flow voor eindgebruikers nodig blijft.

---

## Technische richting

- Caddy op `sso.latero.nl` wordt routebewust:
  - publieke OIDC/login endpoints blijven publiek
  - `/admin`, admin console assets en admin API-routes worden alleen
    doorgelaten vanuit VPN/allowlist context
- Keycloak blijft intern op `127.0.0.1:8080`
- health op `9000` blijft intern-only
- Hetzner firewall blijft alleen `80/443` publiek openhouden
- VPN wordt buiten de app-stack als operator access-laag ingericht

---

## Implementatieverwijzing

Zie [WP-SEC-001](../requirements/keycloak-admin-hardening-workpackage.md).
