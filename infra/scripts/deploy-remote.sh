#!/usr/bin/env bash
# =============================================================================
# Latero Control — Remote Deploy
# =============================================================================
# Roept deploy.sh aan op de prod server via SSH.
# Vereist: infra/.env.deploy (lokaal, gitignored)
#
# Gebruik:
#   bash infra/scripts/deploy-remote.sh
# =============================================================================
set -euo pipefail

ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env.deploy"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "❌  ${ENV_FILE} niet gevonden."
  echo "   Kopieer infra/.env.deploy.example naar infra/.env.deploy en vul in."
  exit 1
fi

# shellcheck disable=SC1090
source "${ENV_FILE}"

: "${DEPLOY_HOST:?Zet DEPLOY_HOST in infra/.env.deploy}"
: "${DEPLOY_DIR:?Zet DEPLOY_DIR in infra/.env.deploy}"

echo "▶  Deploy naar ${DEPLOY_HOST}:${DEPLOY_DIR}..."
ssh -o BatchMode=yes "${DEPLOY_HOST}" \
  "cd '${DEPLOY_DIR}' && bash infra/scripts/deploy.sh"
