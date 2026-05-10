#!/usr/bin/env bash
# =============================================================================
# Latero Control — Lokale Bootstrap Script (Mac / dev)
# =============================================================================
# Voer dit script éénmalig uit na een verse lokale 'docker compose up'.
# Werkt zonder extra env-bestand: alle waarden zijn hardcoded voor dev-gebruik.
#
# Gebruik:
#   bash infra/scripts/bootstrap-local.sh
#
# Vereisten:
#   - Docker draait
#   - infra/docker/docker-compose.local.yml is gestart (npm run infra:up)
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[bootstrap-local]${NC} $*"; }
warn() { echo -e "${YELLOW}[bootstrap-local]${NC} $*"; }
fail() { echo -e "${RED}[bootstrap-local] FOUT:${NC} $*"; exit 1; }

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-insights-local-postgres}"

# ── Stap 1: Wacht op Postgres ─────────────────────────────────────────────────
log "Wachten op Postgres..."
for i in $(seq 1 20); do
  if docker exec "$POSTGRES_CONTAINER" pg_isready -U insights -q 2>/dev/null; then
    log "Postgres beschikbaar."
    break
  fi
  [[ $i -eq 20 ]] && fail "Postgres niet beschikbaar. Is de lokale infra gestart? (npm run infra:up)"
  sleep 2
done

psql() {
  docker exec -i "$POSTGRES_CONTAINER" psql -U insights "$@"
}

# ── Stap 2: Admin-gebruiker ───────────────────────────────────────────────────
log "Admin-gebruiker aanmaken: admin@latero.nl..."
psql -d insights <<'SQL'
INSERT INTO insights_users (email, password_hash, is_admin, is_break_glass, active)
VALUES (
  'admin@latero.nl',
  crypt('Admin1234!', gen_salt('bf', 12)),
  TRUE, TRUE, TRUE
)
ON CONFLICT (email) DO UPDATE SET
  password_hash  = crypt('Admin1234!', gen_salt('bf', 12)),
  is_admin       = TRUE,
  is_break_glass = TRUE,
  active         = TRUE,
  updated_at     = NOW();
SQL

# ── Stap 3: Installatie ───────────────────────────────────────────────────────
log "Installatie aanmaken: local_dev..."
psql -d insights <<'SQL'
INSERT INTO insights_installations
  (installation_id, label, environment, tier, token_hash, active)
VALUES (
  'local_dev',
  'Lokaal',
  'dev',
  'pro',
  encode(sha256('local-dev-token'::bytea), 'hex'),
  TRUE
)
ON CONFLICT (installation_id) DO UPDATE SET
  label       = 'Lokaal',
  environment = 'dev',
  active      = TRUE,
  updated_at  = NOW();
SQL

# ── Stap 4: SSO configureren (voor lokale Keycloak SSO stack) ─────────────────
log "SSO configureren voor latero.nl..."
psql -d insights <<'SQL'
UPDATE installation_auth_policy SET
  auth_mode        = 'sso_with_local_fallback',
  allowed_domains  = ARRAY['latero.nl'],
  jit_provisioning = TRUE,
  jit_default_role = 'member'
WHERE installation_id = 'local_dev';

INSERT INTO installation_sso_config
  (installation_id, issuer, client_id, client_secret_ref,
   redirect_uri, scopes, pkce_required, enabled)
VALUES (
  'local_dev',
  'http://localhost:8080/realms/latero-test',
  'latero-control',
  'OIDC_CLIENT_SECRET',
  'http://localhost:3000/api/auth/sso/callback',
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

# ── Klaar ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Lokale bootstrap geslaagd!${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo ""
echo "  Admin login : http://localhost:3000/admin/login"
echo "  Email       : admin@latero.nl"
echo "  Wachtwoord  : Admin1234!"
echo ""
echo "  SSO (vereist lokale Keycloak via npm run sso:up):"
echo "  Issuer      : http://localhost:8080/realms/latero-test"
echo "  Testuser    : leen@latero.nl / Latero1234!"
echo ""
warn "Zorg dat web/.env.local OIDC_CLIENT_SECRET=latero-dev-secret bevat voor SSO."
echo ""
