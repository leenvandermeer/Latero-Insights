import type { DataQualityCheck, LineageAttribute, LineageEntity, LineageHop, PipelineRun } from "@/lib/adapters/types";
import { getPgPool } from "@/lib/insights-saas-db";
import { currentClause } from "@/lib/temporal";

type DateRange = { from: string; to: string; installationId?: string | null; runId?: string | null; entityFqn?: string | null };
type PipelineRunRow = PipelineRun & { duration_ms: number | string | null };

function normalizeDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Date must use YYYY-MM-DD format");
  }
  return date;
}

// ---------------------------------------------------------------------------
// meta.* read functions (LADR-040)
// ---------------------------------------------------------------------------

async function getPipelineRunsFromMetaStore(range: DateRange): Promise<PipelineRun[]> {
  const from = normalizeDate(range.from);
  const to = normalizeDate(range.to);
  const pool = getPgPool();

  const values: Array<string> = [from, to];
  let installationFilter = "";
  if (range.installationId) {
    values.push(range.installationId);
    installationFilter = ` AND r.installation_id = $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT
        'pipeline_run'                          AS event_type,
        r.started_at                            AS timestamp_utc,
        to_char(r.run_date, 'YYYY-MM-DD')       AS event_date,
        COALESCE(j.dataset_id, j.job_name)      AS dataset_id,
        COALESCE(d.source_system, '')            AS source_system,
        r.external_run_id                       AS run_id,
        r.status                                AS run_status,
        r.duration_ms,
        r.environment,
        j.job_name,
        pr.external_run_id                      AS parent_run_id
      FROM meta.runs r
      JOIN meta.jobs j USING (job_id)
      LEFT JOIN LATERAL (
        SELECT source_system FROM meta.datasets
        WHERE installation_id = r.installation_id AND dataset_id = j.dataset_id
        LIMIT 1
      ) d ON true
      LEFT JOIN meta.runs pr ON pr.run_id = r.parent_run_id
      WHERE r.run_date BETWEEN $1 AND $2${installationFilter}
      ORDER BY r.started_at DESC
    `,
    values,
  );

  return (result.rows as PipelineRunRow[]).map((row) => ({
    ...row,
    duration_ms: row.duration_ms === null ? null : Number(row.duration_ms),
  })) as PipelineRun[];
}

async function getDataQualityChecksFromMetaStore(range: DateRange): Promise<DataQualityCheck[]> {
  const from = normalizeDate(range.from);
  const to = normalizeDate(range.to);
  const pool = getPgPool();

  const values: Array<string> = [from, to];
  const extraFilters: string[] = [];
  if (range.installationId) {
    values.push(range.installationId);
    extraFilters.push(`qr.installation_id = $${values.length}`);
  }
  if (range.runId) {
    values.push(range.runId);
    extraFilters.push(`qr.run_id = $${values.length}::uuid`);
  }
  if (range.entityFqn) {
    values.push(range.entityFqn);
    extraFilters.push(`qru.dataset_id = $${values.length}`);
  }
  const extraWhere = extraFilters.length > 0 ? " AND " + extraFilters.join(" AND ") : "";

  const result = await pool.query(
    `
      SELECT
        'data_quality_check'                          AS event_type,
        qr.executed_at                                AS timestamp_utc,
        to_char(qr.result_date, 'YYYY-MM-DD')         AS event_date,
        COALESCE(qru.dataset_id, qru.check_id)        AS dataset_id,
        COALESCE(r.external_run_id, qr.run_id::text, '') AS run_id,
        qr.result_id::text                            AS result_id,
        qr.check_id,
        COALESCE(qru.check_name, qr.check_id)        AS check_name,
        qr.status                                     AS check_status,
        qru.check_category,
        qru.severity,
        qru.policy_version,
        qru.check_mode,
        qr.check_result,
        qr.result_value,
        qr.threshold_value,
        qr.message,
        NULL::text                                    AS environment,
        NULL::text                                    AS parent_run_id
      FROM meta.quality_results qr
      JOIN meta.quality_rules qru
        ON qru.installation_id = qr.installation_id
       AND qru.check_id        = qr.check_id
      LEFT JOIN meta.runs r ON r.run_id = qr.run_id
      WHERE qr.result_date BETWEEN $1 AND $2${extraWhere}
      ORDER BY qr.executed_at DESC
    `,
    values,
  );

  return result.rows as DataQualityCheck[];
}

async function getLineageHopsFromMetaStore(range: DateRange): Promise<LineageHop[]> {
  const from = normalizeDate(range.from);
  const to = normalizeDate(range.to);
  const pool = getPgPool();

  const values: Array<string> = [from, to];
  let installationFilter = "";
  if (range.installationId) {
    values.push(range.installationId);
    installationFilter = ` AND e.installation_id = $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT
        'data_lineage'                                        AS event_type,
        e.last_observed_at                                    AS timestamp_utc,
        to_char((e.last_observed_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')
                                                              AS event_date,
        e.source_dataset_id                                   AS dataset_id,
        COALESCE(lr.external_run_id, '')                      AS run_id,
        e.source_dataset_id                                   AS source_entity,
        COALESCE(src.platform, '')                            AS source_type,
        ''                                                    AS source_ref,
        NULL::text                                            AS source_attribute,
        e.target_dataset_id                                   AS target_entity,
        COALESCE(tgt.platform, '')                            AS target_type,
        ''                                                    AS target_ref,
        NULL::text                                            AS target_attribute,
        src.source_system,
        e.installation_id,
        NULL::text                                            AS environment,
        NULL::text                                            AS schema_version,
        NULL::text                                            AS lineage_evidence,
        'data_flow'                                           AS hop_kind
      FROM meta.lineage_edges e
      LEFT JOIN meta.datasets src
        ON src.installation_id = e.installation_id
       AND src.dataset_id      = e.source_dataset_id
      LEFT JOIN meta.datasets tgt
        ON tgt.installation_id = e.installation_id
       AND tgt.dataset_id      = e.target_dataset_id
      LEFT JOIN meta.runs lr ON lr.run_id = e.last_observed_run
      WHERE (e.last_observed_at AT TIME ZONE 'UTC')::date BETWEEN $1::date AND $2::date${installationFilter}
      ORDER BY e.last_observed_at DESC
    `,
    values,
  );

  return result.rows as LineageHop[];
}

async function getLineageEntitiesFromMetaStore(installationId?: string | null): Promise<LineageEntity[]> {
  if (!installationId) return [];
  const pool = getPgPool();

  const result = await pool.query(
    `
      WITH upstream AS (
        SELECT
          e.target_dataset_id                                                     AS dataset_id,
          e.target_layer                                                          AS layer,
          ARRAY_AGG(DISTINCT e.source_layer || '::' || e.source_dataset_id
                    ORDER BY e.source_layer || '::' || e.source_dataset_id)       AS upstream_keys
        FROM meta.lineage_edges e
        WHERE e.installation_id = $1
        GROUP BY e.target_dataset_id, e.target_layer
      ),
      downstream AS (
        SELECT
          e.source_dataset_id                                                     AS dataset_id,
          e.source_layer                                                          AS layer,
          ARRAY_AGG(DISTINCT e.target_layer || '::' || e.target_dataset_id
                    ORDER BY e.target_layer || '::' || e.target_dataset_id)       AS downstream_keys
        FROM meta.lineage_edges e
        WHERE e.installation_id = $1
        GROUP BY e.source_dataset_id, e.source_layer
      ),
      run_status_base AS (
        SELECT d.dataset_id, d.layer, r.status, r.started_at, r.ended_at
        FROM meta.run_io io
        JOIN meta.runs r USING (run_id)
        JOIN meta.datasets d
          ON d.installation_id = io.installation_id
         AND d.dataset_id      = io.dataset_id
         AND d.layer           = io.layer
        WHERE io.installation_id = $1
      ),
      latest_run AS (
        SELECT DISTINCT ON (dataset_id, layer)
          dataset_id,
          layer,
          status                                                      AS latest_status
        FROM run_status_base
        ORDER BY dataset_id, layer, started_at DESC
      ),
      status_rollup AS (
        SELECT
          dataset_id,
          layer,
          MAX(
            CASE status
              WHEN 'FAILED'  THEN 3
              WHEN 'WARNING' THEN 2
              WHEN 'SUCCESS' THEN 1
              ELSE 0
            END
          )                                                           AS worst_rank,
          MAX(CASE WHEN status = 'SUCCESS' THEN ended_at END)        AS latest_success_at
        FROM run_status_base
        GROUP BY dataset_id, layer
      ),
      all_edge_datasets AS (
        SELECT DISTINCT source_dataset_id AS dataset_id, source_layer AS layer FROM meta.lineage_edges WHERE installation_id = $1
        UNION
        SELECT DISTINCT target_dataset_id AS dataset_id, target_layer AS layer FROM meta.lineage_edges WHERE installation_id = $1
      ),
      -- LADR-064: source_datasets per silver/gold entiteit (1-to-many bridge)
      entity_source_names AS (
        SELECT
          es.entity_id,
          ARRAY_AGG(DISTINCT es.source_dataset_id ORDER BY es.source_dataset_id) AS source_datasets
        FROM meta.entity_sources es
        WHERE es.installation_id = $1
        GROUP BY es.entity_id
      )
      SELECT

        d.dataset_id                                                  AS dataset_id,
        d.dataset_id                                                  AS name,
        d.layer                                                       AS layer,
        COALESCE(lr.latest_status, 'UNKNOWN')                         AS latest_status,
        CASE COALESCE(sr.worst_rank, 0)
          WHEN 3 THEN 'FAILED'
          WHEN 2 THEN 'PARTIAL'
          WHEN 1 THEN 'SUCCESS'
          ELSE 'UNKNOWN'
        END                                                           AS end_to_end_status,
        sr.latest_success_at,
        COALESCE(up.upstream_keys,   ARRAY[]::TEXT[])              AS upstream_keys,
        COALESCE(dn.downstream_keys, ARRAY[]::TEXT[])              AS downstream_keys,
        COALESCE(es.source_datasets, ARRAY[]::TEXT[])              AS source_datasets,
        CASE WHEN d.layer IN ('silver', 'gold') THEN 'entity' ELSE 'dataset' END AS node_kind,
        COALESCE(ent.entity_name, d.dataset_id)                    AS entity_name
      FROM meta.datasets d
      JOIN all_edge_datasets aed ON aed.dataset_id = d.dataset_id AND aed.layer = d.layer
      LEFT JOIN upstream           up  ON up.dataset_id  = d.dataset_id AND up.layer  = d.layer
      LEFT JOIN downstream         dn  ON dn.dataset_id  = d.dataset_id AND dn.layer  = d.layer
      LEFT JOIN latest_run         lr  ON lr.dataset_id  = d.dataset_id AND lr.layer  = d.layer
      LEFT JOIN status_rollup      sr  ON sr.dataset_id  = d.dataset_id AND sr.layer  = d.layer
      LEFT JOIN entity_source_names es ON es.entity_id   = d.entity_id
      LEFT JOIN meta.entities      ent ON ent.installation_id = d.installation_id
                                       AND ent.entity_id      = d.entity_id
                                       AND ent.valid_to IS NULL
      WHERE d.installation_id = $1
        AND ${currentClause('d')}
        AND d.layer IN ('landing', 'raw', 'bronze', 'silver', 'gold')
        AND (d.source_system IS NULL OR d.dataset_id != d.source_system)
      ORDER BY d.dataset_id
    `,
    [installationId],
  );

  return result.rows.map((row: {
    dataset_id: string | null;
    name: string;
    layer: string;
    latest_status: string;
    end_to_end_status: string;
    latest_success_at: string | null;
    upstream_keys: string[] | null;
    downstream_keys: string[] | null;
    source_datasets: string[] | null;
    node_kind: string;
    entity_name: string | null;
  }) => ({
    dataset_id: row.dataset_id,
    name: row.name,
    layer: row.layer,
    latest_status: row.latest_status,
    end_to_end_status: row.end_to_end_status,
    latest_success_at: row.latest_success_at,
    upstream_keys: row.upstream_keys ?? [],
    downstream_keys: row.downstream_keys ?? [],
    lineage_group_id: row.dataset_id,
    last_completed_layer: row.latest_success_at ? row.layer : null,
    source_datasets: row.source_datasets ?? [],
    node_kind: row.node_kind,
    entity_name: row.entity_name ?? row.name,
  })) as LineageEntity[];
}

async function getLineageAttributesFromMetaStore(installationId?: string | null): Promise<LineageAttribute[]> {
  if (!installationId) return [];
  const pool = getPgPool();

  const result = await pool.query(
    `
      SELECT
        c.source_dataset_id                       AS source_dataset_id,
        c.target_dataset_id                       AS target_dataset_id,
        c.source_dataset_id                       AS source_name,
        c.source_column                           AS source_attribute,
        c.target_dataset_id                       AS target_name,
        c.target_column                           AS target_attribute,
        c.source_layer                            AS source_layer,
        c.target_layer                            AS target_layer
      FROM meta.lineage_columns c
      WHERE c.installation_id = $1
      ORDER BY source_name, c.source_column
    `,
    [installationId],
  );

  return result.rows.map((row: {
    source_dataset_id: string | null;
    target_dataset_id: string | null;
    source_name: string;
    source_attribute: string;
    target_name: string;
    target_attribute: string;
    source_layer: string | null;
    target_layer: string | null;
  }) => ({
    source_dataset_id: row.source_dataset_id,
    target_dataset_id: row.target_dataset_id,
    source_name: row.source_name,
    source_attribute: row.source_attribute,
    target_name: row.target_name,
    target_attribute: row.target_attribute,
    source_layer: row.source_layer,
    target_layer: row.target_layer,
    is_current: true,
    provenance: "lineage_attributes_current" as const,
  })) as LineageAttribute[];
}

// ---------------------------------------------------------------------------
// Public read API
// ---------------------------------------------------------------------------

export async function getPipelineRunsFromSaaS(range: DateRange): Promise<PipelineRun[]> {
  return getPipelineRunsFromMetaStore(range);
}

export async function getDataQualityChecksFromSaaS(range: DateRange): Promise<DataQualityCheck[]> {
  return getDataQualityChecksFromMetaStore(range);
}

export async function getLineageHopsFromSaaS(range: DateRange): Promise<LineageHop[]> {
  return getLineageHopsFromMetaStore(range);
}

export async function getLineageEntitiesFromSaaS(installationId?: string | null): Promise<LineageEntity[]> {
  return getLineageEntitiesFromMetaStore(installationId);
}

export async function getLineageAttributesFromSaaS(installationId?: string | null): Promise<LineageAttribute[]> {
  return getLineageAttributesFromMetaStore(installationId);
}
