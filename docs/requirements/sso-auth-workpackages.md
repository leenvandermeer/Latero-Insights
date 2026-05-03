# SSO and Hybrid Auth Work Packages

Status: Reviewed — klaar voor build  
Owner: Product + Engineering + Security  
Date: 2026-05-03  
Reviewed: 2026-05-03 — alle pre-build bevindingen verwerkt

## Context

Latero Control heeft al een werkende lokale sessielaag met Postgres-backed
sessions en tenant-scoped autorisatie. Dit werkpakketdocument breidt dat model
uit met enterprise SSO, zonder de bestaande veiligheidsgrenzen rond
`active_installation_id`, admin access en auditability te doorbreken.

Het doel is niet om een tweede los auth-systeem naast de app te zetten, maar om
OIDC gecontroleerd te laten landen op dezelfde interne Latero-sessie.

## Scope

In scope:

- OIDC SSO voor tenant-gebruikers
- hybride auth-beleid per installatie
- break-glass lokale fallback
- installatie-scoped SSO configuratie
- Docker testomgeving met lokale IdP
- security hardening en testdekking

Out of scope:

- native SAML implementatie in de app
- SCIM provisioning
- externe user directory synchronisatie buiten loginflow
- multi-repo opsplitsing

## Werkpakket 1 — ADR en security basiskader

Doel:
- Auth-keuzes normatief vastleggen voordat implementatie start.

Scope:
- OIDC-keuze bevestigen
- trust boundaries beschrijven
- threat model opstellen
- security sign-off criteria definiëren

Deliverables:
- ADR voor SSO architectuur (`docs/decisions/LADR-034`)
- `docs/requirements/sso-security-checklist.md` — implementatie-review checklist per endpoint/laag
- `docs/requirements/sso-forbidden-patterns.md` — lijst van verboden patronen met rationale
- norm voor rate limiting op auth-endpoints: ≤5 pogingen per minuut per IP voor `/api/auth/login`, `/api/auth/callback` en `/api/auth/password-reset`

Acceptatiecriteria:
- Security heeft expliciet akkoord op `OIDC + PKCE`
- Beslissing vastgelegd dat browser geen IdP tokens bewaart
- Beslissing vastgelegd dat `issuer + subject` identity key leidend is
- `sso-security-checklist.md` bestaat als zelfstandig document en bevat minimaal: session hardening, CSRF, rate limiting, secrets handling, audit logging
- `sso-forbidden-patterns.md` bestaat als zelfstandig document
- rate-limit norm (≤5/min per IP) is opgenomen in de checklist als verplicht criterium voor alle auth-endpoints

Indicatie:
- 1 tot 1.5 dag

## Werkpakket 2 — Datamodel voor externe identities en policies

Doel:
- Auth-data expliciet modeleren op installatie- en identity-niveau.

Scope:
- `external_identities` tabel
- installatie-scoped auth policy
- installatie-scoped SSO configuratie metadata
- markering voor break-glass of local-only accounts
- secrets-opslagcontract voor OIDC client credentials
- keuze en documentatie van DDL-patroon: migratie-bestanden in `infra/sql/init/` zijn leidend; inline `ensureAuthSchema()` DDL is niet toegestaan voor nieuwe SSO-tabellen

Deliverables:
- SQL migratie(s) voor `external_identities`, `installation_auth_policy`, `installation_sso_config`
- bijgewerkte schema-referentie
- datamodelcontract voor identity linking
- secrets-opslagcontract: OIDC `client_secret` en JWKS-gerelateerde waarden worden niet opgeslagen in `.cache/settings.json`; opslagvorm is environment-variabele, Docker secrets mount, of equivalent operator-beheerd mechanisme
- DDL-patroon gedocumenteerd in `docs/decisions/` of als inline noot in migratie-header

Acceptatiecriteria:
- Externe identities zijn uniek op `(issuer, subject)`
- Een lokale gebruiker kan veilig aan meerdere installaties gekoppeld blijven
- Auth-policy is per installatie uitleesbaar en afdwingbaar
- OIDC client-secrets zijn niet aanwezig in `.cache/settings.json` of enige andere door de app beheerde platte opslag
- Alle nieuwe SSO-tabellen zijn gedefinieerd in `infra/sql/init/` migratie-bestanden, niet via inline DDL

Indicatie:
- 1.5 tot 2 dagen

## Werkpakket 3 — OIDC server-side auth flow

Doel:
- Enterprise login server-side verwerken en omzetten naar Latero-sessie.

Scope:
- login redirect endpoint
- callback endpoint
- state, nonce en PKCE validatie
- issuer/JWKS tokenvalidatie
- lokale sessiecreatie na succesvolle callback
- server-side opslag van OIDC state en nonce met expliciete TTL

Deliverables:
- auth routes voor SSO (`/api/auth/sso/login`, `/api/auth/sso/callback`)
- OIDC helper/service module
- foutcontracten voor auth failures
- opslagcontract voor OIDC state/nonce: signed HttpOnly cookie (aanbevolen) of DB-tabel met TTL-kolom; keuze en rationale gedocumenteerd
- TTL-contract: state/nonce verlopen na maximaal 10 minuten; verlopen waarden zijn niet herbruikbaar

Acceptatiecriteria:
- Browser ontvangt geen OIDC access of refresh token
- Callback faalt hard bij state/nonce/issuer/audience mismatch
- Succesvolle callback resulteert in een bestaande Latero-sessiecookie
- State en nonce worden server-side bewaard; een replay van een reeds gebruikte nonce faalt
- State/nonce met verstreken TTL worden geweigerd

Indicatie:
- 2 tot 3 dagen

## Werkpakket 4 — Hybride auth policy en lokale fallback

Doel:
- SSO en lokale login gecontroleerd naast elkaar laten bestaan.

Scope:
- auth modes per installatie
- policy check op lokale login endpoint
- break-glass accounts
- disable local login waar nodig

Deliverables:
- policy service
- updates op login UI/API
- fallback gedrag voor bootstrap en incidenten

Acceptatiecriteria:
- `sso_only` tenants accepteren geen normale lokale login
- `sso_with_break_glass` tenants accepteren alleen expliciet gemarkeerde lokale admins
- `local_only` blijft bruikbaar voor dev/test

Indicatie:
- 1.5 tot 2 dagen

## Werkpakket 5 — Provisioning en role mapping

Doel:
- Toegang op een veilige manier toekennen na federated login.

Scope:
- handmatige mapping als basis
- optionele JIT provisioning
- mapping van groups/claims naar tenant-rollen
- aparte behandeling van admin-toegang

Deliverables:
- identity-to-user linking service
- provisioning policy rules
- role mapping contract

Acceptatiecriteria:
- Geen provisioning zonder expliciete installatie-policy
- Geen admin-escalatie via generieke tenant claims
- Tenant membership wordt altijd server-side bepaald

Indicatie:
- 2 tot 3 dagen

## Werkpakket 6 — Audit logging, session lifecycle en CSRF-hardening

Doel:
- Auth-events volledig zichtbaar en forensisch bruikbaar maken; muterende sessie-endpoints beveiligen tegen cross-site aanvallen.

Scope:
- auth audit events
- session revocation
- logout semantics
- tenant switch logging
- CSRF-bescherming op alle muterende sessie-endpoints: logout, installation switch, auth-policy wijziging

Deliverables:
- uitbreidingen op audit logging
- auth event catalog
- logout/revocation flows
- CSRF-strategie geïmplementeerd voor `POST /api/auth/logout`, `POST /api/auth/switch-installation` en toekomstige auth-config endpoints: synchronizer token of `SameSite=Strict` upgrade met origin-check

Acceptatiecriteria:
- Login success/failure, logout en callback failures worden gelogd
- Tokens en volledige claim payloads komen niet in logs
- Lokale logout revokt altijd de Latero-sessie
- `POST /api/auth/logout` is niet aanroepbaar via cross-origin request zonder geldig CSRF-token of origin-check
- `POST /api/auth/switch-installation` is niet aanroepbaar via cross-origin request zonder geldig CSRF-token of origin-check

Indicatie:
- 1.5 tot 2 dagen

## Werkpakket 7 — Admin beheer voor SSO-configuratie

Doel:
- Operators een beheersbaar pad geven voor installatie-auth instellingen.

Scope:
- beheer van auth mode
- beheer van issuer/client config
- beheer van allowed domains/groups
- beheer van break-glass policy

Deliverables:
- admin API routes
- admin UI voor auth configuratie
- validatie- en testknoppen

Acceptatiecriteria:
- Auth-config is per installatie aanpasbaar zonder directe DB edit
- Secret values worden niet in plain text teruggegeven aan de browser
- Config validatie geeft operators bruikbare foutmeldingen

Indicatie:
- 2 tot 3 dagen

## Werkpakket 8 — Docker SSO testomgeving

Doel:
- Een reproduceerbare, veilige lokale federatie-setup leveren.

Scope:
- Keycloak service
- lokale TLS via Caddy
- app + IdP hostnames
- seed data voor testtenants, users en groups

Deliverables:
- `docker-compose` voor SSO stack
- voorbeeld env/secrets bestanden
- setup documentatie

Acceptatiecriteria:
- Team kan de stack met beperkte handmatige stappen starten
- HTTPS werkt lokaal voor app en IdP
- Ten minste 2 tenants en 2 user persona’s zijn testbaar

Indicatie:
- 1.5 tot 2 dagen

## Werkpakket 9 — Security en regressietests

Doel:
- Aantonen dat de hybride auth-aanpak veilig blijft onder regressie.

Scope:
- callback tampering tests
- cross-tenant access tests
- local fallback policy tests
- logout/revocation tests
- admin escalation tests

Deliverables:
- geautomatiseerde testset
- handmatige sec QA checklist
- release gate criteria

Acceptatiecriteria:
- State mismatch, nonce mismatch en verkeerde issuer falen aantoonbaar
- `sso_only` tenants blokkeren lokale login
- Cross-tenant access via auth bugs faalt aantoonbaar
- `local_only` installaties doorlopen de volledige lokale auth-pijplijn als expliciete regressiecheck: login, sessieherstel, logout, tenant-switch
- Rate limiting op auth-endpoints wordt getest: meer dan 5 loginpogingen per minuut per IP worden geblokkeerd met HTTP 429
- CSRF-aanval op logout en installation-switch faalt aantoonbaar

Indicatie:
- 2 tot 3 dagen

## Werkpakket 10 — UX discovery, flows en auth-interactieontwerp

Doel:
- De hybride auth-aanpak begrijpelijk en veilig bruikbaar maken voor tenant
  users en operators.

Scope:
- login-intent per installatiebeleid
- SSO versus local fallback hiërarchie
- break-glass UX
- unauthorized-after-login states
- admin UX voor SSO-configuratie
- copy en state design voor auth-flows
- architectuurinput voor het login-entry-point: de `InstallationGate` component moet de auth-mode kennen vóór authenticatie; dit vereist een unauthenticated endpoint dat de auth-mode per installatie teruggeeft op basis van een e-mail domein-hint

Deliverables:
- auth journey map
- wireframes voor login-, callback-, error- en admin-configstaten
- copy deck voor user-facing auth messaging
- UX acceptance checklist
- architectuurspecificatie voor `GET /api/auth/policy?hint=<email-domein>`: response-contract (auth-mode, SSO redirect aanwezig/afwezig), security constraints (geen gevoelige config lekken), en afstemming met WP3

Acceptatiecriteria:
- `sso_only` toont geen misleidende lokale login affordance
- `sso_with_break_glass` toont lokale toegang duidelijk secundair
- installatiecontext is zichtbaar tijdens login en na tenant switch
- unauthorized-after-login heeft een dedicated UX-state met handelingsperspectief
- admin begrijpt impact van auth-mode wijzigingen vóór opslaan
- architectuurspecificatie voor `GET /api/auth/policy` is aanwezig en afgestemd met WP3 vóór start van WP3-implementatie

Indicatie:
- 2 tot 3 dagen

## Werkpakket 11 — Docker productie-image: bouwen en uitrollen

Doel:
- Latero Control als reproduceerbare, zelfstandige Docker-image beschikbaar maken voor productie-installaties en upgrades.

Scope:
- multi-stage Dockerfile voor de Next.js webapplicatie
- image-tagging strategie (semver + `latest`)
- Compose-integratie voor productie-stack (app + Postgres + Caddy)
- initialisatie van database-migraties bij container-start
- upgrade-procedure: zero-downtime strategie of gedocumenteerde onderhoudsvensterprocedure
- omgevingsvariabelen en secrets-mount contract voor productie
- health check integratie (`/api/health`)
- documentatie voor eerste installatie en upgrade

Deliverables:
- `infra/docker/Dockerfile` (multi-stage, productie-ready)
- bijgewerkt of nieuw `infra/docker/docker-compose.prod.yml`
- `infra/README.md` uitgebreid met installatiegids en upgradehandleiding
- `.env.example` met alle vereiste en optionele variabelen inclusief SSO-gerelateerde entries
- DB-migratie entrypoint: container start `infra/sql/init/*.sql` sequentieel bij eerste boot (of via aparte migratiecontainer)

Acceptatiecriteria:
- `docker compose -f docker-compose.prod.yml up` start een werkende Latero Control instantie zonder handmatige DB-setup
- Alle secrets (OIDC client credentials, DB-wachtwoorden) worden via environment of Docker secrets gemount; geen secrets in image-lagen
- Health check op `/api/health` slaagt na container-start
- Upgrade van versie N naar N+1 kan worden uitgevoerd via image-tag wissel zonder dataverlies
- Documentatie beschrijft stap-voor-stap: eerste installatie, upgrade, rollback

Indicatie:
- 2 tot 3 dagen

## Fasering

Volgorde binnen fase is sequentieel (→); parallelle uitvoering is niet toegestaan tenzij expliciet aangegeven.

- Fase 1: WP1 → WP2 → WP10 → WP3
- Fase 2: WP4 + WP5 + WP6 + WP8 (WP4 en WP5 parallel mogelijk na WP3; WP6 na WP4; WP8 parallel aan WP4/WP5)
- Fase 3: WP7 + WP9 + WP11 (WP7 en WP11 parallel mogelijk; WP9 als laatste)

## Afhankelijkheden

- Besluit over ondersteunde enterprise IdP(s) in fase 1
- Security reviewcapaciteit voor architecture sign-off
- UX-capaciteit voor auth journeys, copy en state design — WP10 moet afgerond zijn vóór start van WP3
- Testdomeinen of lokale hostname-strategie voor HTTPS development
- Admin testaccounts en tenant testdata
- WP1 security checklist en verboden-patronen-document moeten bestaan vóór start van WP2
- Rate-limit norm (≤5 pogingen/min per IP) voor auth-endpoints moet in `rate-limit.ts` doorgevoerd zijn vóór start van WP3
- Secrets-opslagmechanisme (env-file of Docker secrets mount) moet afgestemd zijn vóór productie-deployment (WP11)

## Risico's

- Verkeerde tenant linking bij te losse e-mailmatching
- Onbedoeld open laten staan van lokale login op enterprise tenants
- CSRF-kwetsbaarheid op logout of installation-switch als CSRF-strategie niet vóór Fase 2 is geïmplementeerd
- Replay-aanval via verlopen of hergebruikte OIDC state/nonce als TTL-contract niet geborgd is
- Secrets lekkage als OIDC client-credentials in `.cache/settings.json` terechtkomen
- Productie-installatie zonder Docker-image (WP11) leidt tot inconsistente deployments en moeilijk reproduceerbare omgevingen
- Secrets leakage als SSO-config in runtime settings of logs belandt
- Verwarrende login-UX waardoor users het verkeerde auth-pad kiezen
- Te beperkte lokale testomgeving waardoor cookie- of redirectbugs onzichtbaar blijven

## Definitie van klaar

De hybride auth-uitbreiding is klaar wanneer:

- OIDC-login werkt op installatie-scope
- lokale fallback alleen policy-based beschikbaar is
- de app uitsluitend op Latero-sessies vertrouwt
- de auth UX per installatiebeleid getest en begrijpelijk is
- auth en tenant isolation regressies geautomatiseerd bewaakt worden
- de Docker SSO teststack team-breed reproduceerbaar is
