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

# Zorg dat de tracking-tabel bestaat (altijd idempotent)
docker exec -i "${PG_CONTAINER}" \
  psql -U "${PG_USER}" -d "${PG_DB}" -v ON_ERROR_STOP=1 \
  < "${SQL_DIR}/000_schema_migrations.sql" > /dev/null 2>&1

for sql_file in $(ls -v "${SQL_DIR}"/*.sql); do
  filename="$(basename "${sql_file}")"

  # Sla 000 over — is al hierboven gedraaid
  [[ "${filename}" == "000_schema_migrations.sql" ]] && continue

  # Controleer of dit script al is toegepast
  already_applied=$(docker exec "${PG_CONTAINER}" \
    psql -U "${PG_USER}" -d "${PG_DB}" -tAq \
    -c "SELECT 1 FROM schema_migrations WHERE filename = '${filename}' LIMIT 1;" 2>/dev/null)

  if [[ "${already_applied}" == "1" ]]; then
    echo "   –  ${filename} (al toegepast, overgeslagen)"
    continue
  fi

  # Voer het script uit
  if docker exec -i "${PG_CONTAINER}" \
    psql -U "${PG_USER}" -d "${PG_DB}" \
    -v ON_ERROR_STOP=1 \
    < "${sql_file}" > /dev/null 2>&1; then
    # Registreer als succesvol toegepast
    docker exec "${PG_CONTAINER}" \
      psql -U "${PG_USER}" -d "${PG_DB}" -tAq \
      -c "INSERT INTO schema_migrations (filename) VALUES ('${filename}') ON CONFLICT DO NOTHING;" > /dev/null 2>&1
    echo "   ✓  ${filename}"
  else
    echo "   ✗  ${filename} — FOUT (deploy gestopt)"
    exit 1
  fi
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
