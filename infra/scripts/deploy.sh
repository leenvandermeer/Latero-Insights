#!/usr/bin/env bash
# =============================================================================
# Latero Control — Deploy Script
# =============================================================================
# Deployt de latest main branch naar de prod server.
# Stopt en herstart alleen de app- en caddy-containers (Postgres en Keycloak
# blijven onaangeroerd).
#
# Gebruik:
#   cd /opt/latero-control
#   bash infra/scripts/deploy.sh
#
# Vereisten:
#   - infra/.env.prod aanwezig
#   - Docker + Docker Compose beschikbaar
#   - Git remote 'origin' bereikbaar
# =============================================================================
set -euo pipefail

log() { echo "$*"; }

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${REPO_DIR}/infra/.env.prod"
COMPOSE_BASE="${REPO_DIR}/infra/docker/docker-compose.prod.yml"
COMPOSE_SSO="${REPO_DIR}/infra/docker/docker-compose.prod-sso.yml"
IMAGE_TAG="meta-insights:latest"

# ── Guard ──────────────────────────────────────────────────────────────────
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "❌  ${ENV_FILE} niet gevonden. Kan niet deployen."
  exit 1
fi

echo ""
echo "══════════════════════════════════════════════════"
echo "  Latero Control — Deploy"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "══════════════════════════════════════════════════"
echo ""

# ── Stap 1: Git pull ───────────────────────────────────────────────────────
echo "▶  1/4  Git pull..."
cd "${REPO_DIR}"
git pull

COMMIT=$(git rev-parse --short HEAD)
echo "   Commit: ${COMMIT}"
echo ""

# ── Stap 2: Docker build ───────────────────────────────────────────────────
echo "▶  2/4  Docker build (kan even duren)..."

# Ruim eventuele stale BuildKit state op van vorige pogingen
docker buildx prune -f --filter "until=1h" > /dev/null 2>&1 || true

docker build \
  --no-cache \
  -f "${REPO_DIR}/infra/docker/Dockerfile" \
  -t "${IMAGE_TAG}" \
  "${REPO_DIR}"
echo ""

# ── Stap 3: DB-migraties ───────────────────────────────────────────────────
# Gebruikt dezelfde migrate.cjs runner als lokale ontwikkeling (migrate.ts).
# Voert alleen een éénmalige --rm container uit zodat er geen losse psql-loop
# naast de TypeScript-runner bestaat die uit de pas kan lopen.
echo "▶  3/5  DB-migraties uitvoeren..."

# Haal de postgres container-netwerk op (docker_default op prod)
PG_NETWORK=$(docker inspect insights-postgres \
  --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null | head -1)
PG_NETWORK="${PG_NETWORK:-docker_default}"

POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" "${ENV_FILE}" | cut -d= -f2)

docker run --rm \
  --network "${PG_NETWORK}" \
  -e "POSTGRES_URL=postgresql://insights:${POSTGRES_PASSWORD}@insights-postgres:5432/insights" \
  "${IMAGE_TAG}" \
  node /app/migrate.cjs

# Cleanup oude audit-records (90 dagen retentie)
PG_CONTAINER="insights-postgres"
PG_USER="insights"
PG_DB="insights"
DELETED=$(docker exec "${PG_CONTAINER}" \
  psql -U "${PG_USER}" -d "${PG_DB}" -tAq \
  -c "SELECT cleanup_ingest_audit(90);" 2>/dev/null || echo "0")
echo "   Audit cleanup: ${DELETED:-0} records verwijderd (>90 dagen oud)"
echo ""

# ── Stap 4: Containers herstarten ─────────────────────────────────────────
echo "▶  4/5  Containers herstarten (app + caddy)..."
docker compose \
  -f "${COMPOSE_BASE}" \
  -f "${COMPOSE_SSO}" \
  --env-file "${ENV_FILE}" \
  up -d --no-deps app caddy

# Caddy expliciet herladen met de bijgewerkte Caddyfile (vangnet voor bind-mount inode issues)
sleep 2
CADDY_CONTAINER="insights-caddy"
CADDYFILE_HOST="${REPO_DIR}/infra/docker/Caddyfile.prod-sso"
if docker ps -q -f name="${CADDY_CONTAINER}" | grep -q .; then
  docker cp "${CADDYFILE_HOST}" "${CADDY_CONTAINER}:/tmp/Caddyfile_deploy"
  docker exec "${CADDY_CONTAINER}" caddy reload --config /tmp/Caddyfile_deploy 2>&1 | grep -E "info|error" || true
  echo "   ✓  Caddy config herladen"
fi
echo ""

# ── Stap 5: Health check ───────────────────────────────────────────────────
echo "▶  5/5  Health check..."
sleep 4

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 10 \
  "http://localhost:3000/api/health" 2>/dev/null || echo "000")

if [[ "${HTTP_STATUS}" == "200" ]]; then
  echo "   ✅  App reageert op /api/health (HTTP ${HTTP_STATUS})"
else
  echo "   ⚠️   Health check gaf HTTP ${HTTP_STATUS} — controleer de logs:"
  echo "         docker logs insights-app --tail 50"
fi

echo ""
echo "══════════════════════════════════════════════════"
echo "  Deploy klaar — commit ${COMMIT}"
echo "══════════════════════════════════════════════════"
echo ""
