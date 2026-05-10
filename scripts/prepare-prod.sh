#!/usr/bin/env bash
# scripts/prepare-prod.sh
# Bereidt het realm-latero-prod.json voor met het OIDC_CLIENT_SECRET uit .env.prod.
# Uitvoeren vanuit de repository root vóór de eerste productie-deployment.
#
# Gebruik:
#   bash scripts/prepare-prod.sh

set -euo pipefail

ENV_FILE="infra/.env.prod"
REALM_SRC="infra/keycloak/realm-latero-prod.json"
REALM_OUT="infra/keycloak/realm-latero-prod.rendered.json"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌  $ENV_FILE niet gevonden. Kopieer infra/.env.prod.example en vul de waarden in."
  exit 1
fi

# Laad env vars (alleen de variabelen die we nodig hebben)
# shellcheck disable=SC2046
export $(grep -E '^OIDC_CLIENT_SECRET=' "$ENV_FILE" | xargs)

if [[ -z "${OIDC_CLIENT_SECRET:-}" ]]; then
  echo "❌  OIDC_CLIENT_SECRET is leeg in $ENV_FILE"
  exit 1
fi

sed "s|REPLACE_WITH_OIDC_CLIENT_SECRET|${OIDC_CLIENT_SECRET}|g" "$REALM_SRC" > "$REALM_OUT"

echo "✅  Realm JSON gegenereerd: $REALM_OUT"
echo "    Zorg dat dit bestand NIET wordt gecommit (staat in .gitignore)."
echo ""
echo "    Pas nu docker-compose.prod-sso.yml aan om realm-latero-prod.rendered.json"
echo "    te gebruiken als volume mount, of kopieer het naar de server."
