#!/usr/bin/env bash
# =============================================================================
# Latero Control — Server Bootstrap Script
# =============================================================================
# Voer dit script éénmalig uit na een verse 'docker compose up' op een nieuwe
# server (prod, acc, of een andere omgeving).
#
# Wat dit script doet:
#   1. Wacht tot Postgres beschikbaar is
#   2. Maakt Keycloak DB-gebruiker en database aan
#   3. Maakt de eerste admin-gebruiker aan
#   4. Maakt een installatie aan
#   5. Configureert SSO (auth policy + sso config)
#   6. Rapporteert de installatie-token (voor API-gebruik)
#
# Gebruik:
#   cd /opt/latero-control
#   source infra/.env.prod   # of: set -a && source infra/.env.prod && set +a
#   bash infra/scripts/bootstrap.sh
#
# Vereiste omgevingsvariabelen (uit .env.prod):
#   POSTGRES_PASSWORD        — Postgres hoofdwachtwoord
#   KC_DB_PASSWORD           — Keycloak DB-wachtwoord
#   ADMIN_EMAIL              — Email van de eerste admin
#   ADMIN_PASSWORD           — Wachtwoord van de eerste admin
#   INSTALLATION_ID          — Bijv. prod_abc123 of acc_xyz789
#   INSTALLATION_LABEL       — Leesbare naam, bijv. "Productie" of "Acceptatie"
#   INSTALLATION_ENV         — prod | acc | dev
#   INSTALLATION_TOKEN       — API-token voor Latero runtimes (willekeurig)
#   SSO_DOMAIN               — Domein van SSO-gebruikers, bijv. latero.nl
#   SSO_ISSUER               — Bijv. https://sso.latero.nl/realms/latero
#   SSO_CLIENT_ID            — Bijv. latero-control
#   SSO_REDIRECT_URI         — Bijv. https://control.latero.nl/api/auth/sso/callback
#   OIDC_CLIENT_SECRET       — Client secret uit Keycloak
#   PUBLIC_URL               — Publieke URL, bijv. https://control.latero.nl
# =============================================================================

set -euo pipefail

# ── Kleuren ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[bootstrap]${NC} $*"; }
warn() { echo -e "${YELLOW}[bootstrap]${NC} $*"; }
fail() { echo -e "${RED}[bootstrap] FOUT:${NC} $*"; exit 1; }

# ── Vereiste variabelen controleren ───────────────────────────────────────────
required_vars=(
  POSTGRES_PASSWORD
  KC_DB_PASSWORD
  ADMIN_EMAIL
  ADMIN_PASSWORD
  INSTALLATION_ID
  INSTALLATION_LABEL
  INSTALLATION_ENV
  INSTALLATION_TOKEN
  SSO_DOMAIN
  SSO_ISSUER
  SSO_CLIENT_ID
  SSO_REDIRECT_URI
  OIDC_CLIENT_SECRET
)

for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    fail "Omgevingsvariabele \$$var is niet ingesteld. Zie infra/.env.prod.example."
  fi
done

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-insights-postgres}"

# ── Stap 1: Wacht tot Postgres beschikbaar is ─────────────────────────────────
log "Wachten op Postgres..."
for i in $(seq 1 30); do
  if docker exec "$POSTGRES_CONTAINER" pg_isready -U insights -q 2>/dev/null; then
    log "Postgres is beschikbaar."
    break
  fi
  if [[ $i -eq 30 ]]; then
    fail "Postgres niet beschikbaar na 30 pogingen."
  fi
  sleep 2
done

psql() {
  docker exec -i "$POSTGRES_CONTAINER" psql -U insights "$@"
}

# ── Stap 2: Keycloak DB-gebruiker en database ─────────────────────────────────
log "Keycloak database provisioning..."
psql -d postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'keycloak') THEN
    CREATE ROLE keycloak WITH LOGIN PASSWORD '${KC_DB_PASSWORD}';
  ELSE
    ALTER ROLE keycloak WITH PASSWORD '${KC_DB_PASSWORD}';
  END IF;
END
\$\$;
SQL

# CREATE DATABASE kan niet in een transactie-blok — apart uitvoeren
if ! psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='keycloak'" | grep -q 1; then
  psql -d postgres -c "CREATE DATABASE keycloak OWNER keycloak;"
  log "Database 'keycloak' aangemaakt."
else
  log "Database 'keycloak' bestaat al — overgeslagen."
fi

# ── Stap 3: Admin-gebruiker aanmaken ──────────────────────────────────────────
log "Admin-gebruiker aanmaken: ${ADMIN_EMAIL}..."
psql -d insights <<SQL
INSERT INTO insights_users (email, password_hash, is_admin, is_break_glass, active)
VALUES (
  LOWER('${ADMIN_EMAIL}'),
  crypt('${ADMIN_PASSWORD}', gen_salt('bf', 12)),
  TRUE,
  TRUE,
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  password_hash  = crypt('${ADMIN_PASSWORD}', gen_salt('bf', 12)),
  is_admin       = TRUE,
  is_break_glass = TRUE,
  active         = TRUE,
  updated_at     = NOW();
SQL
log "Admin-gebruiker klaar."

# ── Stap 4: Installatie aanmaken ──────────────────────────────────────────────
log "Installatie aanmaken: ${INSTALLATION_ID}..."

TOKEN_HASH=$(echo -n "${INSTALLATION_TOKEN}" | sha256sum | cut -d' ' -f1)

psql -d insights <<SQL
INSERT INTO insights_installations
  (installation_id, label, environment, tier, token_hash, active)
VALUES (
  '${INSTALLATION_ID}',
  '${INSTALLATION_LABEL}',
  '${INSTALLATION_ENV}',
  'pro',
  '${TOKEN_HASH}',
  TRUE
)
ON CONFLICT (installation_id) DO UPDATE SET
  label       = EXCLUDED.label,
  environment = EXCLUDED.environment,
  active      = TRUE,
  updated_at  = NOW();
SQL
log "Installatie klaar."

# ── Stap 5: SSO configureren ──────────────────────────────────────────────────
log "SSO configureren voor domein: ${SSO_DOMAIN}..."
psql -d insights <<SQL
UPDATE installation_auth_policy SET
  auth_mode       = 'sso_with_local_fallback',
  allowed_domains = ARRAY['${SSO_DOMAIN}'],
  jit_provisioning = TRUE,
  jit_default_role = 'member'
WHERE installation_id = '${INSTALLATION_ID}';

INSERT INTO installation_sso_config
  (installation_id, issuer, client_id, client_secret_ref,
   redirect_uri, scopes, pkce_required, enabled)
VALUES (
  '${INSTALLATION_ID}',
  '${SSO_ISSUER}',
  '${SSO_CLIENT_ID}',
  'OIDC_CLIENT_SECRET',
  '${SSO_REDIRECT_URI}',
  ARRAY['openid', 'email', 'profile'],
  TRUE,
  TRUE
)
ON CONFLICT (installation_id) DO UPDATE SET
  issuer            = EXCLUDED.issuer,
  client_id         = EXCLUDED.client_id,
  client_secret_ref = EXCLUDED.client_secret_ref,
  redirect_uri      = EXCLUDED.redirect_uri,
  scopes            = EXCLUDED.scopes,
  pkce_required     = EXCLUDED.pkce_required,
  enabled           = EXCLUDED.enabled,
  updated_at        = NOW();
SQL
log "SSO geconfigureerd."

# ── Klaar ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Bootstrap geslaagd!${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo ""
echo "  Installatie-ID : ${INSTALLATION_ID}"
echo "  Admin-email    : ${ADMIN_EMAIL}"
echo "  SSO-domein     : ${SSO_DOMAIN}"
echo "  Publieke URL   : ${PUBLIC_URL:-niet ingesteld}"
echo ""
echo "  API-token (bewaar dit):"
echo "  ${INSTALLATION_TOKEN}"
echo ""
warn "Herstart de app als Keycloak nog niet draaide:"
echo "  docker compose -f infra/docker/docker-compose.prod.yml \\"
echo "    -f infra/docker/docker-compose.prod-sso.yml \\"
echo "    --env-file infra/.env.prod restart app keycloak"
echo ""
