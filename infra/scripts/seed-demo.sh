#!/usr/bin/env bash
# =============================================================================
# Latero Control — Demo Seed Script
# =============================================================================
# Kopieert ingest-data (runs, lineage, kwaliteit, producten) van een bron-
# installatie naar een doel-installatie voor demo-doeleinden.
#
# - Tijdstempels worden verschoven zodat de meest recente run op "nu" uitkomt
# - Governance-velden op data_products worden leeggemaakt (Arjan vult zelf in)
# - Change-events worden verwijderd (schone lei)
# - UUIDs worden hergebruikt waar de PK installatie-scoped is, en opnieuw
#   gegenereerd waar de PK globaal is (runs, edges, quality_results, etc.)
#
# Gebruik:
#   bash infra/scripts/seed-demo.sh <bron-installation-id> <doel-installation-id>
#
# Voorbeeld:
#   bash infra/scripts/seed-demo.sh prod_j24fo7l15 prod_o88ovawxx
#
# Vereisten:
#   - infra/.env.deploy aanwezig (bevat DEPLOY_HOST)
#   - Docker-container "insights-postgres" actief op de prod-server
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env.deploy"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "❌  ${ENV_FILE} niet gevonden."
  exit 1
fi

source "${ENV_FILE}"
: "${DEPLOY_HOST:?Zet DEPLOY_HOST in infra/.env.deploy}"

SRC="${1:-}"
DST="${2:-}"

if [[ -z "${SRC}" || -z "${DST}" ]]; then
  echo "Gebruik: $0 <bron-installation-id> <doel-installation-id>"
  exit 1
fi

PG="docker exec -i insights-postgres psql -U insights -d insights -v ON_ERROR_STOP=1"

echo ""
echo "══════════════════════════════════════════════════"
echo "  Latero Control — Demo Seed"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Bron : ${SRC}"
echo "  Doel : ${DST}"
echo "══════════════════════════════════════════════════"
echo ""

# ── Controleer dat beide installaties bestaan ──────────────────────────────
echo "▶  Installaties controleren..."
ssh -o BatchMode=yes "${DEPLOY_HOST}" "
  ${PG} -tAq -c \"
    SELECT COUNT(*) FROM insights_installations
    WHERE installation_id IN ('${SRC}', '${DST}');
  \"
" | grep -q "^2$" || {
  echo "❌  Bron of doel installatie niet gevonden in insights_installations."
  exit 1
}
echo "   ✓  Beide installaties gevonden"
echo ""

# ── Kopieer data via SQL ───────────────────────────────────────────────────
echo "▶  Data kopiëren..."
ssh -o BatchMode=yes "${DEPLOY_HOST}" "${PG}" << ENDSQL
SET session_replication_role = 'replica';

DO \$\$
DECLARE
  time_offset interval;
BEGIN
  -- Tijdverschuiving: meest recente run -> nu
  SELECT NOW() - MAX(started_at)
  INTO time_offset
  FROM meta.runs
  WHERE installation_id = '${SRC}';

  IF time_offset IS NULL THEN
    time_offset := '0'::interval;
  END IF;

  RAISE NOTICE 'Tijdverschuiving: %', time_offset;

  -- ── Leeg doelinstallatie ──────────────────────────────────────────────
  DELETE FROM meta.change_events      WHERE installation_id = '${DST}';
  DELETE FROM meta.quality_results    WHERE installation_id = '${DST}';
  DELETE FROM meta.quality_rules      WHERE installation_id = '${DST}';
  DELETE FROM meta.lineage_columns    WHERE installation_id = '${DST}';
  DELETE FROM meta.lineage_edges      WHERE installation_id = '${DST}';
  DELETE FROM meta.run_io             WHERE installation_id = '${DST}';
  DELETE FROM meta.runs               WHERE installation_id = '${DST}';
  DELETE FROM meta.dataset_snapshots  WHERE installation_id = '${DST}';
  DELETE FROM meta.entity_sources     WHERE installation_id = '${DST}';
  DELETE FROM meta.datasets           WHERE installation_id = '${DST}';
  DELETE FROM meta.jobs               WHERE installation_id = '${DST}';
  DELETE FROM meta.entities           WHERE installation_id = '${DST}';
  DELETE FROM meta.trust_score_snapshots WHERE installation_id = '${DST}';
  DELETE FROM meta.product_output_links  WHERE installation_id = '${DST}';
  DELETE FROM meta.data_products         WHERE installation_id = '${DST}';
  RAISE NOTICE 'Doelinstallatie geleegd';

  -- UUID-mapping tabellen
  CREATE TEMP TABLE IF NOT EXISTS _job_id_map  (old_id uuid, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _run_id_map  (old_id uuid, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _edge_id_map (old_id uuid, new_id uuid) ON COMMIT DROP;
  TRUNCATE _job_id_map, _run_id_map, _edge_id_map;

  -- ── entities (PK = installation_id + entity_id) ───────────────────────
  INSERT INTO meta.entities (
    entity_id, installation_id, data_product_id, display_name, description,
    source_system, owner, tags, created_at, updated_at,
    is_context_node, entity_name, valid_from, valid_to
  )
  SELECT
    entity_id, '${DST}', data_product_id, display_name, description,
    source_system, owner, tags,
    created_at + time_offset, updated_at + time_offset,
    is_context_node, entity_name,
    valid_from + time_offset, valid_to
  FROM meta.entities WHERE installation_id = '${SRC}'
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Gekopieerd: entities (%)' , (SELECT COUNT(*) FROM meta.entities WHERE installation_id = '${DST}');

  -- ── jobs (PK = job_id uuid, globaal) ─────────────────────────────────
  INSERT INTO _job_id_map SELECT job_id, gen_random_uuid() FROM meta.jobs WHERE installation_id = '${SRC}';
  INSERT INTO meta.jobs (job_id, installation_id, job_name, job_type, dataset_id, first_seen_at, job_namespace)
  SELECT m.new_id, '${DST}', j.job_name, j.job_type, j.dataset_id,
         j.first_seen_at + time_offset, j.job_namespace
  FROM meta.jobs j JOIN _job_id_map m ON j.job_id = m.old_id;
  RAISE NOTICE 'Gekopieerd: jobs';

  -- ── datasets (PK = layer + dataset_id + installation_id) ─────────────
  INSERT INTO meta.datasets (
    dataset_id, installation_id, namespace, object_name, platform, entity_type,
    source_system, first_seen_at, last_seen_at, layer, entity_id,
    dataset_facets, valid_from, valid_to, entity_guid
  )
  SELECT
    dataset_id, '${DST}', namespace, object_name, platform, entity_type,
    source_system,
    first_seen_at + time_offset, last_seen_at + time_offset,
    layer, entity_id, dataset_facets,
    valid_from + time_offset, valid_to,
    gen_random_uuid()
  FROM meta.datasets WHERE installation_id = '${SRC}'
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Gekopieerd: datasets (%)' , (SELECT COUNT(*) FROM meta.datasets WHERE installation_id = '${DST}');

  -- ── entity_sources (PK = id uuid, globaal) ───────────────────────────
  INSERT INTO meta.entity_sources (id, installation_id, entity_id, source_dataset_id, source_layer, first_observed_at, last_observed_at)
  SELECT gen_random_uuid(), '${DST}', entity_id, source_dataset_id, source_layer,
         first_observed_at + time_offset, last_observed_at + time_offset
  FROM meta.entity_sources WHERE installation_id = '${SRC}';
  RAISE NOTICE 'Gekopieerd: entity_sources';

  -- ── dataset_snapshots (PK = snapshot_id bigserial, auto) ─────────────
  INSERT INTO meta.dataset_snapshots (dataset_id, installation_id, layer, object_name, platform, column_count, captured_at, captured_by, payload, created_at)
  SELECT dataset_id, '${DST}', layer, object_name, platform, column_count,
         captured_at + time_offset, captured_by, payload, created_at + time_offset
  FROM meta.dataset_snapshots WHERE installation_id = '${SRC}';
  RAISE NOTICE 'Gekopieerd: dataset_snapshots';

  -- ── runs (PK = run_id uuid, globaal) ─────────────────────────────────
  INSERT INTO _run_id_map SELECT run_id, gen_random_uuid() FROM meta.runs WHERE installation_id = '${SRC}';
  INSERT INTO meta.runs (
    run_id, job_id, installation_id, external_run_id, parent_run_id,
    status, environment, started_at, ended_at, duration_ms,
    created_at, run_facets, rows_inserted, rows_updated, rows_deleted, rows_total
  )
  SELECT
    rm.new_id,
    COALESCE(jm.new_id, r.job_id),
    '${DST}',
    r.external_run_id, r.parent_run_id,
    r.status, r.environment,
    r.started_at + time_offset, r.ended_at + time_offset,
    r.duration_ms,
    r.created_at + time_offset,
    r.run_facets, r.rows_inserted, r.rows_updated, r.rows_deleted, r.rows_total
  FROM meta.runs r
  JOIN _run_id_map rm ON r.run_id = rm.old_id
  LEFT JOIN _job_id_map jm ON r.job_id = jm.old_id
  WHERE r.installation_id = '${SRC}';
  RAISE NOTICE 'Gekopieerd: runs (%)' , (SELECT COUNT(*) FROM meta.runs WHERE installation_id = '${DST}');

  -- ── run_io (PK = id uuid, globaal) ───────────────────────────────────
  INSERT INTO meta.run_io (id, run_id, installation_id, dataset_id, role, observed_at, layer)
  SELECT gen_random_uuid(), rm.new_id, '${DST}',
         rio.dataset_id, rio.role, rio.observed_at + time_offset, rio.layer
  FROM meta.run_io rio
  JOIN _run_id_map rm ON rio.run_id = rm.old_id
  WHERE rio.installation_id = '${SRC}';
  RAISE NOTICE 'Gekopieerd: run_io';

  -- ── lineage_edges (PK = edge_id uuid, globaal) ───────────────────────
  INSERT INTO _edge_id_map SELECT edge_id, gen_random_uuid() FROM meta.lineage_edges WHERE installation_id = '${SRC}';
  INSERT INTO meta.lineage_edges (
    edge_id, installation_id, source_dataset_id, target_dataset_id,
    first_observed_run, last_observed_run,
    first_observed_at, last_observed_at,
    observation_count, source_kind, target_kind, source_layer, target_layer,
    valid_from, valid_to
  )
  SELECT
    em.new_id, '${DST}',
    e.source_dataset_id, e.target_dataset_id,
    COALESCE((SELECT new_id FROM _run_id_map WHERE old_id = e.first_observed_run), e.first_observed_run),
    COALESCE((SELECT new_id FROM _run_id_map WHERE old_id = e.last_observed_run),  e.last_observed_run),
    e.first_observed_at + time_offset, e.last_observed_at + time_offset,
    e.observation_count, e.source_kind, e.target_kind, e.source_layer, e.target_layer,
    e.valid_from + time_offset, e.valid_to
  FROM meta.lineage_edges e
  JOIN _edge_id_map em ON e.edge_id = em.old_id
  WHERE e.installation_id = '${SRC}';
  RAISE NOTICE 'Gekopieerd: lineage_edges (%)' , (SELECT COUNT(*) FROM meta.lineage_edges WHERE installation_id = '${DST}');

  -- ── lineage_columns (PK = column_edge_id uuid, globaal) ──────────────
  INSERT INTO meta.lineage_columns (
    column_edge_id, installation_id, source_dataset_id, source_column,
    target_dataset_id, target_column, transformation_type,
    first_observed_at, last_observed_at, transformation_subtype,
    source_layer, target_layer, valid_from, valid_to
  )
  SELECT
    gen_random_uuid(), '${DST}',
    lc.source_dataset_id, lc.source_column,
    lc.target_dataset_id, lc.target_column, lc.transformation_type,
    lc.first_observed_at + time_offset, lc.last_observed_at + time_offset,
    lc.transformation_subtype, lc.source_layer, lc.target_layer,
    lc.valid_from + time_offset, lc.valid_to
  FROM meta.lineage_columns lc
  WHERE lc.installation_id = '${SRC}';
  RAISE NOTICE 'Gekopieerd: lineage_columns';

  -- ── quality_rules (PK = check_id + installation_id) ──────────────────
  INSERT INTO meta.quality_rules (check_id, installation_id, check_name, check_category, severity, check_mode, policy_version, dataset_id, first_seen_at, updated_at)
  SELECT check_id, '${DST}', check_name, check_category, severity, check_mode, policy_version, dataset_id,
         first_seen_at + time_offset, updated_at + time_offset
  FROM meta.quality_rules WHERE installation_id = '${SRC}'
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Gekopieerd: quality_rules';

  -- ── quality_results (PK = result_id uuid, globaal) ───────────────────
  INSERT INTO meta.quality_results (result_id, check_id, installation_id, run_id, status, result_value, threshold_value, message, check_result, executed_at, created_at)
  SELECT gen_random_uuid(), qr.check_id, '${DST}',
         COALESCE(rm.new_id, qr.run_id),
         qr.status, qr.result_value, qr.threshold_value, qr.message, qr.check_result,
         qr.executed_at + time_offset, qr.created_at + time_offset
  FROM meta.quality_results qr
  LEFT JOIN _run_id_map rm ON qr.run_id = rm.old_id
  WHERE qr.installation_id = '${SRC}';
  RAISE NOTICE 'Gekopieerd: quality_results (%)' , (SELECT COUNT(*) FROM meta.quality_results WHERE installation_id = '${DST}');

  -- ── data_products (PK = installation_id + data_product_id) ───────────
  INSERT INTO meta.data_products (
    data_product_id, installation_id, display_name, description, owner, domain, tags,
    created_at, updated_at, sla, contract_ver, deprecated_at,
    valid_from, valid_to, sla_tier, classification, data_steward, retention_days, external_id
  )
  SELECT data_product_id, '${DST}', display_name, NULL, NULL, NULL, '[]'::jsonb,
         created_at, updated_at, NULL, NULL, deprecated_at,
         valid_from, valid_to, NULL, NULL, NULL, NULL, external_id
  FROM meta.data_products WHERE installation_id = '${SRC}'
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Gekopieerd: data_products (%)' , (SELECT COUNT(*) FROM meta.data_products WHERE installation_id = '${DST}');

  -- ── product_output_links ──────────────────────────────────────────────
  INSERT INTO meta.product_output_links (installation_id, product_id, output_id, description)
  SELECT '${DST}', product_id, output_id, description
  FROM meta.product_output_links WHERE installation_id = '${SRC}'
  ON CONFLICT DO NOTHING;

  -- ── trust_score_snapshots ─────────────────────────────────────────────
  INSERT INTO meta.trust_score_snapshots (installation_id, product_id, calculated_at, score, factors)
  SELECT '${DST}', product_id, calculated_at, score, factors
  FROM meta.trust_score_snapshots WHERE installation_id = '${SRC}'
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Gekopieerd: trust_score_snapshots';

  RAISE NOTICE '✓ Klaar';
END;
\$\$;

SET session_replication_role = 'origin';
ENDSQL

echo ""
echo "▶  Verificatie..."
ssh -o BatchMode=yes "${DEPLOY_HOST}" "${PG}" << VERIFY
SELECT
  '${DST}'                                                                     AS installation,
  (SELECT COUNT(*) FROM meta.runs            WHERE installation_id = '${DST}') AS runs,
  (SELECT COUNT(*) FROM meta.entities        WHERE installation_id = '${DST}') AS entities,
  (SELECT COUNT(*) FROM meta.datasets        WHERE installation_id = '${DST}') AS datasets,
  (SELECT COUNT(*) FROM meta.lineage_edges   WHERE installation_id = '${DST}') AS lineage_edges,
  (SELECT COUNT(*) FROM meta.quality_results WHERE installation_id = '${DST}') AS quality_results,
  (SELECT COUNT(*) FROM meta.data_products   WHERE installation_id = '${DST}') AS data_products,
  (SELECT MAX(started_at) FROM meta.runs     WHERE installation_id = '${DST}') AS laatste_run;
VERIFY

echo ""
echo "══════════════════════════════════════════════════"
echo "  Seed klaar — ${DST}"
echo "══════════════════════════════════════════════════"
echo ""
