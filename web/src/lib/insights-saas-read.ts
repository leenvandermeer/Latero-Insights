import type { DataQualityCheck, LineageAttribute, LineageEntity, LineageHop, PipelineRun } from "@/lib/adapters/types";
import { getPgPool } from "@/lib/insights-saas-db";

type DateRange = { from: string; to: string; installationId?: string | null };
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
        r.step,
        r.external_run_id                       AS run_id,
        r.status                                AS run_status,
        r.duration_ms,
        r.environment,
        j.job_name,
        pr.external_run_id                      AS parent_run_id
      FROM meta.runs r
      JOIN meta.jobs j USING (job_id)
      LEFT JOIN meta.datasets d
        ON d.installation_id = r.installation_id
       AND d.dataset_id = j.dataset_id
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
  let installationFilter = "";
  if (range.installationId) {
    values.push(range.installationId);
    installationFilter = ` AND qr.installation_id = $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT
        'data_quality_check'                          AS event_type,
        qr.executed_at                                AS timestamp_utc,
        to_char(qr.result_date, 'YYYY-MM-DD')         AS event_date,
        COALESCE(qru.dataset_id, qru.check_id)        AS dataset_id,
        ''                                            AS step,
        COALESCE(r.external_run_id, '')               AS run_id,
        qr.check_id,
        qr.status                                     AS check_status,
        qru.check_category,
        qru.policy_version,
        NULL::text                                    AS environment,
        qru.check_mode,
        qr.check_result,
        NULL::text                                    AS parent_run_id
      FROM meta.quality_results qr
      JOIN meta.quality_rules qru
        ON qru.installation_id = qr.installation_id
       AND qru.check_id        = qr.check_id
      LEFT JOIN meta.runs r ON r.run_id = qr.run_id
      WHERE qr.result_date BETWEEN $1 AND $2${installationFilter}
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
        ''                                                    AS step,
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
          -- LADR-058: sla layer::fqn keys op zodat graph-view exact kan matchen via lineageEntityKey()
          ARRAY_AGG(DISTINCT src.layer || '::' || src.fqn
                    ORDER BY src.layer || '::' || src.fqn)                        AS upstream_entity_fqns
        FROM meta.lineage_edges e
        JOIN meta.datasets src
          ON src.dataset_id      = e.source_dataset_id
         AND src.installation_id = e.installation_id
        WHERE e.installation_id = $1
        GROUP BY e.target_dataset_id
      ),
      downstream AS (
        SELECT
          e.source_dataset_id                                                     AS dataset_id,
          -- LADR-058: idem — exacte layer-scoped keys voor downstream
          ARRAY_AGG(DISTINCT tgt.layer || '::' || tgt.fqn
                    ORDER BY tgt.layer || '::' || tgt.fqn)                        AS downstream_entity_fqns
        FROM meta.lineage_edges e
        JOIN meta.datasets tgt
          ON tgt.dataset_id      = e.target_dataset_id
         AND tgt.installation_id = e.installation_id
        WHERE e.installation_id = $1
        GROUP BY source_dataset_id
      ),
      -- LADR-058 fix: run_io wordt niet altijd gevuld (bijv. Python-script sync).
      -- Gebruik meta.jobs.dataset_id (bare fqn) + step-afleiding als primaire
      -- statusbron. split_part(...'_to_'...) + suffix-strip geeft de target layer.
      run_status_base AS (
        SELECT
          d.dataset_id,
          r.status,
          r.started_at,
          r.ended_at
        FROM meta.runs r
        JOIN meta.jobs j USING (job_id)
        JOIN meta.datasets d
          ON d.installation_id = r.installation_id
         AND d.fqn = j.dataset_id
         AND d.layer = CASE
               WHEN split_part(r.step, '_to_', 2)
                      IN ('landing', 'raw', 'bronze', 'silver', 'gold')
                 THEN split_part(r.step, '_to_', 2)
               ELSE regexp_replace(split_part(r.step, '_to_', 2), '_.*$', '')
             END
        WHERE r.installation_id = $1
        UNION ALL
        -- API-push mode: run_io bevat de layer-scoped dataset_id direct
        SELECT d.dataset_id, r.status, r.started_at, r.ended_at
        FROM meta.run_io io
        JOIN meta.runs r USING (run_id)
        JOIN meta.datasets d
          ON d.installation_id = io.installation_id
         AND d.dataset_id      = io.dataset_id
        WHERE io.installation_id = $1
      ),
      latest_run AS (
        SELECT DISTINCT ON (dataset_id)
          dataset_id,
          status                                                      AS latest_status
        FROM run_status_base
        ORDER BY dataset_id, started_at DESC
      ),
      status_rollup AS (
        SELECT
          dataset_id,
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
        GROUP BY dataset_id
      ),
      all_edge_datasets AS (
        SELECT DISTINCT source_dataset_id AS dataset_id FROM meta.lineage_edges WHERE installation_id = $1
        UNION
        SELECT DISTINCT target_dataset_id AS dataset_id FROM meta.lineage_edges WHERE installation_id = $1
      )
      SELECT
        -- LADR-058: dataset_id = fqn (bare entity name = group key).
        -- De interne layer-scoped dataset_id is een implementatiedetail van meta.datasets;
        -- de UI gebruikt de bare naam als group key voor graph-layout en chain-grouping.
        d.fqn                                                         AS dataset_id,
        d.fqn                                                         AS entity_fqn,
        -- Laag staat altijd gevuld na LADR-058 migratie (layer-scoped writes)
        COALESCE(d.layer, 'UNKNOWN')                                  AS layer,
        COALESCE(lr.latest_status, 'UNKNOWN')                         AS latest_status,
        CASE COALESCE(sr.worst_rank, 0)
          WHEN 3 THEN 'FAILED'
          WHEN 2 THEN 'PARTIAL'
          WHEN 1 THEN 'SUCCESS'
          ELSE 'UNKNOWN'
        END                                                           AS end_to_end_status,
        sr.latest_success_at,
        COALESCE(up.upstream_entity_fqns,   ARRAY[]::TEXT[])         AS upstream_entity_fqns,
        COALESCE(dn.downstream_entity_fqns, ARRAY[]::TEXT[])         AS downstream_entity_fqns
      FROM meta.datasets d
      JOIN all_edge_datasets aed ON aed.dataset_id = d.dataset_id
      LEFT JOIN upstream      up ON up.dataset_id = d.dataset_id
      LEFT JOIN downstream    dn ON dn.dataset_id = d.dataset_id
      LEFT JOIN latest_run    lr ON lr.dataset_id = d.dataset_id
      LEFT JOIN status_rollup sr ON sr.dataset_id = d.dataset_id
      WHERE d.installation_id = $1
      ORDER BY d.fqn
    `,
    [installationId],
  );

  return result.rows.map((row: {
    dataset_id: string | null;
    entity_fqn: string;
    layer: string;
    latest_status: string;
    end_to_end_status: string;
    latest_success_at: string | null;
    upstream_entity_fqns: string[] | null;
    downstream_entity_fqns: string[] | null;
  }) => ({
    dataset_id: row.dataset_id,
    entity_fqn: row.entity_fqn,
    layer: row.layer,
    latest_status: row.latest_status,
    end_to_end_status: row.end_to_end_status,
    latest_success_at: row.latest_success_at,
    upstream_entity_fqns: row.upstream_entity_fqns ?? [],
    downstream_entity_fqns: row.downstream_entity_fqns ?? [],
    lineage_group_id: row.dataset_id,
    last_completed_layer: row.latest_success_at ? row.layer : null,
  })) as LineageEntity[];
}

async function getLineageAttributesFromMetaStore(installationId?: string | null): Promise<LineageAttribute[]> {
  if (!installationId) return [];
  const pool = getPgPool();

  const result = await pool.query(
    `
      SELECT
        -- LADR-058: geef de layer-scoped dataset_id mee als exacte graph node identifier.
        -- De graph gebruikt lineageEntityKey() = "layer::fqn"; met deze velden is exacte
        -- matching mogelijk zonder fuzzy FQN-resolving.
        c.source_dataset_id                       AS source_dataset_id,
        c.target_dataset_id                       AS target_dataset_id,
        COALESCE(src.fqn, c.source_dataset_id)   AS source_entity_fqn,
        c.source_column                           AS source_attribute,
        COALESCE(tgt.fqn, c.target_dataset_id)   AS target_entity_fqn,
        c.target_column                           AS target_attribute,
        src.layer                                 AS source_layer,
        tgt.layer                                 AS target_layer
      FROM meta.lineage_columns c
      LEFT JOIN meta.datasets src
        ON src.installation_id = c.installation_id
       AND src.dataset_id      = c.source_dataset_id
      LEFT JOIN meta.datasets tgt
        ON tgt.installation_id = c.installation_id
       AND tgt.dataset_id      = c.target_dataset_id
      WHERE c.installation_id = $1
      ORDER BY source_entity_fqn, c.source_column
    `,
    [installationId],
  );

  return result.rows.map((row: {
    source_dataset_id: string | null;
    target_dataset_id: string | null;
    source_entity_fqn: string;
    source_attribute: string;
    target_entity_fqn: string;
    target_attribute: string;
    source_layer: string | null;
    target_layer: string | null;
  }) => ({
    source_dataset_id: row.source_dataset_id,
    target_dataset_id: row.target_dataset_id,
    source_entity_fqn: row.source_entity_fqn,
    source_attribute: row.source_attribute,
    target_entity_fqn: row.target_entity_fqn,
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
