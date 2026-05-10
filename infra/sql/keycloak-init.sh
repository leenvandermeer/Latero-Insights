#!/bin/bash
# infra/sql/keycloak-init.sh
# Wordt door de Postgres-init-container uitgevoerd bij EERSTE opstart.
# Maakt de Keycloak-database en -rol aan.
# Vereist: KEYCLOAK_DB_PASSWORD is ingesteld als env var op de postgres-service.

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'keycloak') THEN
            CREATE ROLE keycloak LOGIN PASSWORD '${KEYCLOAK_DB_PASSWORD}';
        END IF;
    END
    \$\$;

    CREATE DATABASE keycloak OWNER keycloak;
    GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;
EOSQL
