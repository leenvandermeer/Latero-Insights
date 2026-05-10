#!/usr/bin/env bash
# =============================================================================
# Backfill schema_migrations voor bestaande databases
# =============================================================================
# Markeert alle init-scripts die al zijn uitgevoerd als 'applied' zonder ze
# opnieuw te draaien. Eenmalig uitvoeren op elke bestaande database nadat
# 000_schema_migrations.sql voor het eerst is aangemaakt.
#
# Gebruik:
#   bash infra/scripts/backfill-migrations.sh [pg-container-name]
#
#   Standaard container: insights-local-postgres (localhost)
#   Productie:           bash infra/scripts/backfill-migrations.sh insights-postgres
# =============================================================================
set -euo pipefail

PG_CONTAINER="${1:-insights-local-postgres}"
PG_USER="insights"
PG_DB="insights"
SQL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../infra/sql/init" && pwd)"

echo "Backfill schema_migrations in container: ${PG_CONTAINER}"
echo ""

# Zorg dat de tabel bestaat
docker exec -i "${PG_CONTAINER}" \
  psql -U "${PG_USER}" -d "${PG_DB}" -v ON_ERROR_STOP=1 \
  < "${SQL_DIR}/000_schema_migrations.sql" > /dev/null 2>&1

for sql_file in $(ls -v "${SQL_DIR}"/*.sql); do
  filename="$(basename "${sql_file}")"
  [[ "${filename}" == "000_schema_migrations.sql" ]] && continue

  docker exec "${PG_CONTAINER}" \
    psql -U "${PG_USER}" -d "${PG_DB}" -q \
    -c "INSERT INTO schema_migrations (filename) VALUES ('${filename}') ON CONFLICT DO NOTHING;" > /dev/null 2>&1
  echo "   ✓  ${filename}"
done

echo ""
echo "Klaar. $(docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -d "${PG_DB}" -tAq -c "SELECT count(*) FROM schema_migrations;") scripts geregistreerd."
