# Latero Insights Infra Module

This directory contains the infrastructure module of Latero Insights.

Main contents:

- `docker/` — Docker Compose files, Dockerfiles, Caddy config
- `sql/init/` — Postgres bootstrap SQL
- `keycloak/` — Realm import JSON for local SSO testing

Typical use from the repository root:

```bash
npm run infra:up
npm run infra:logs
npm run infra:down
```

Docker file locations:

- `infra/docker/docker-compose.local.yml`
- `infra/docker/docker-compose.dev.yml`
- `infra/docker/docker-compose.prod.yml`
- `infra/docker/docker-compose.sso.yml`  ← SSO test stack (Keycloak + Caddy)

---

## SSO test environment

De SSO stack voegt Keycloak en Caddy toe aan de lokale infra. Hiermee kun je
de volledige OIDC-flow lokaal testen, inclusief HTTPS.

### Test users

| Gebruiker           | Wachtwoord | Groep           |
|---------------------|------------|-----------------|
| alice@acme.test     | Test1234!  | latero-users    |
| bob@acme.test       | Test1234!  | latero-admins   |

Keycloak admin: `http://localhost:8080` — gebruiker `admin` / `admin`

### Stap 1 — /etc/hosts

Voeg toe aan `/etc/hosts`:

```
127.0.0.1  app.latero.local
127.0.0.1  idp.latero.local
```

### Stap 2 — env vars

```bash
cp infra/.env.sso.example web/.env.local
```

Pas `POSTGRES_URL` aan als nodig.

### Stap 3 — Stack starten

```bash
npm run sso:up
npm run sso:logs   # wacht tot Keycloak "Running" toont
```

### Stap 4 — Caddy root-CA vertrouwen (eenmalig)

```bash
docker exec insights-sso-caddy caddy trust
```

Op macOS: het certificaat wordt automatisch aan de Keychain toegevoegd.
Op Linux: volg de instructies in de terminal output.

Herstart daarna de browser.

### Stap 5 — App configureren

Start de dev server:

```bash
npm run dev
```

Ga naar `https://app.latero.local` (of `http://localhost:3010`).

Maak via de admin UI een installatie aan en stel de auth-config in:

| Veld              | Waarde                                                        |
|-------------------|---------------------------------------------------------------|
| Auth mode         | `sso_with_local_fallback`                                     |
| Issuer            | `https://idp.latero.local/realms/latero-test`                 |
| Client ID         | `latero-control`                                              |
| Client secret ref | `OIDC_CLIENT_SECRET`                                          |
| Redirect URI      | `https://app.latero.local/api/auth/sso/callback`              |
| Scopes            | `openid email profile`                                        |
| PKCE              | enabled                                                       |
| Allowed domains   | `acme.test`                                                   |
| Role mapping      | `{"latero-admins":"admin","latero-users":"member"}`           |
| JIT provisioning  | enabled, default role: `member`                               |

Gebruik "Test connection" om de OIDC discovery te verifiëren vóór opslaan.

### Stack stoppen

```bash
npm run sso:down
```

Volumes blijven bewaard. Om Keycloak data te wissen:

```bash
docker volume rm latero-control-repo_insights_keycloak_data
```

### Alternatieven zonder TLS

Als je Caddy niet wilt gebruiken, kun je Keycloak direct aanspreken op
`http://localhost:8080/realms/latero-test`. Zet in de installatie-config:

- Issuer: `http://localhost:8080/realms/latero-test`
- Redirect URI: `http://localhost:3010/api/auth/sso/callback`

> **Let op:** Keycloak in dev mode staat HTTP redirect URIs toe voor localhost.
> Gebruik dit nooit buiten een lokale testomgeving.

---

## Database schema

**Gezaghebbend schema-bestand:** `infra/sql/schema.sql`

Dit is het enige bestand dat het volledige, productiewaardig schema definieert.
De afzonderlijke scripts in `infra/sql/init/` zijn historische migraties en worden
**alleen bij eerste initialisatie** automatisch uitgevoerd door de Postgres Docker image
(via `docker-entrypoint-initdb.d/`). Bij bestaande databases worden ze niet automatisch toegepast.

### Nieuwe installatie (leeg volume)

De Docker-image pikt `infra/sql/init/` automatisch op. Geen extra actie nodig.

### Bestaande database updaten

Voer het canonieke schema-bestand uit — alle statements zijn idempotent:

```bash
# Lokaal
docker exec -i insights-local-postgres psql -U insights -d insights < infra/sql/schema.sql

# Productie
docker exec -i insights-postgres psql -U insights -d insights < infra/sql/schema.sql
```

> **Let op:** `schema.sql` gebruikt `IF NOT EXISTS` en `ADD COLUMN IF NOT EXISTS` — veilig om meerdere keren uit te voeren op een bestaande database.

