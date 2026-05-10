#!/bin/bash
# infra/sql/init/999_keycloak_db.sh
# Maakt de Keycloak-database en -rol aan bij eerste Postgres-opstart.
# Wordt overgeslagen als KEYCLOAK_DB_PASSWORD niet is ingesteld (dev/lokaal).

set -e

if [[ -z "${KEYCLOAK_DB_PASSWORD:-}" ]]; then
    echo "KEYCLOAK_DB_PASSWORD niet ingesteld — keycloak DB init overgeslagen."
    exit 0
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'keycloak') THEN
            CREATE ROLE keycloak LOGIN PASSWORD '${KEYCLOAK_DB_PASSWORD}';
        END IF;
    END
    \$\$;

    SELECT 'CREATE DATABASE keycloak OWNER keycloak'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak')\gexec

    GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;
EOSQL
