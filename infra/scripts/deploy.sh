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
docker build \
  --no-cache \
  -f "${REPO_DIR}/infra/docker/Dockerfile" \
  -t "${IMAGE_TAG}" \
  "${REPO_DIR}"
echo ""

# ── Stap 3: DB-migraties ───────────────────────────────────────────────────
echo "▶  3/5  DB-migraties uitvoeren..."
SQL_DIR="${REPO_DIR}/infra/sql/init"
PG_CONTAINER="insights-postgres"
PG_USER="insights"
PG_DB="insights"

for sql_file in $(ls -v "${SQL_DIR}"/*.sql); do
  filename="$(basename "${sql_file}")"
  docker exec -i "${PG_CONTAINER}" \
    psql -U "${PG_USER}" -d "${PG_DB}" \
    -v ON_ERROR_STOP=0 \
    < "${sql_file}" > /dev/null 2>&1 \
    && echo "   ✓  ${filename}" \
    || echo "   ⚠  ${filename} (mogelijk al uitgevoerd)"
done
echo ""

# ── Stap 4: Containers herstarten ─────────────────────────────────────────
echo "▶  4/5  Containers herstarten (app + caddy)..."
docker compose \
  -f "${COMPOSE_BASE}" \
  -f "${COMPOSE_SSO}" \
  --env-file "${ENV_FILE}" \
  up -d --no-deps app caddy
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
