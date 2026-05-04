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
// meta.* read functions (LADR-040 fase 2)
// These functions query the structured meta.* schema. Each is called first
// by the public *FromSaaS wrapper; a zero-row result triggers a fallback
// to the public.* event tables.
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
          target_dataset_id                                           AS dataset_id,
          ARRAY_AGG(DISTINCT source_dataset_id ORDER BY source_dataset_id)
                                                                      AS upstream_entity_fqns
        FROM meta.lineage_edges
        WHERE installation_id = $1
        GROUP BY target_dataset_id
      ),
      downstream AS (
        SELECT
          source_dataset_id                                           AS dataset_id,
          ARRAY_AGG(DISTINCT target_dataset_id ORDER BY target_dataset_id)
                                                                      AS downstream_entity_fqns
        FROM meta.lineage_edges
        WHERE installation_id = $1
        GROUP BY source_dataset_id
      ),
      latest_run AS (
        SELECT DISTINCT ON (io.dataset_id)
          io.dataset_id,
          r.status                                                    AS latest_status
        FROM meta.run_io io
        JOIN meta.runs r USING (run_id)
        WHERE io.installation_id = $1
        ORDER BY io.dataset_id, r.started_at DESC
      ),
      status_rollup AS (
        SELECT
          io.dataset_id,
          MAX(
            CASE r.status
              WHEN 'FAILED'  THEN 3
              WHEN 'WARNING' THEN 2
              WHEN 'SUCCESS' THEN 1
              ELSE 0
            END
          )                                                           AS worst_rank,
          MAX(CASE WHEN r.status = 'SUCCESS' THEN r.ended_at END)    AS latest_success_at
        FROM meta.run_io io
        JOIN meta.runs r USING (run_id)
        WHERE io.installation_id = $1
        GROUP BY io.dataset_id
      ),
      all_edge_datasets AS (
        SELECT DISTINCT source_dataset_id AS dataset_id FROM meta.lineage_edges WHERE installation_id = $1
        UNION
        SELECT DISTINCT target_dataset_id AS dataset_id FROM meta.lineage_edges WHERE installation_id = $1
      )
      SELECT
        d.dataset_id,
        d.fqn                                                         AS entity_fqn,
        COALESCE(NULLIF(d.platform, 'UNKNOWN'), 'UNKNOWN')            AS layer,
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
        c.source_dataset_id   AS source_entity_fqn,
        c.source_column       AS source_attribute,
        c.target_dataset_id   AS target_entity_fqn,
        c.target_column       AS target_attribute,
        src.platform          AS source_layer,
        tgt.platform          AS target_layer
      FROM meta.lineage_columns c
      LEFT JOIN meta.datasets src
        ON src.installation_id = c.installation_id
       AND src.dataset_id      = c.source_dataset_id
      LEFT JOIN meta.datasets tgt
        ON tgt.installation_id = c.installation_id
       AND tgt.dataset_id      = c.target_dataset_id
      WHERE c.installation_id = $1
      ORDER BY c.source_dataset_id, c.source_column
    `,
    [installationId],
  );

  return result.rows.map((row: {
    source_entity_fqn: string;
    source_attribute: string;
    target_entity_fqn: string;
    target_attribute: string;
    source_layer: string | null;
    target_layer: string | null;
  }) => ({
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
// Public read functions — meta.* first, public.* fallback
// ---------------------------------------------------------------------------

export async function getPipelineRunsFromSaaS(range: DateRange): Promise<PipelineRun[]> {
  const metaRows = await getPipelineRunsFromMetaStore(range);
  if (metaRows.length > 0) return metaRows;

  const from = normalizeDate(range.from);
  const to = normalizeDate(range.to);
  const pool = getPgPool();

  const values: Array<string> = [from, to];
  let where = "event_date BETWEEN $1 AND $2";
  if (range.installationId) {
    values.push(range.installationId);
    where += ` AND installation_id = $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT
        event_type,
        timestamp_utc,
        to_char(event_date, 'YYYY-MM-DD') AS event_date,
        dataset_id,
        COALESCE(source_system, '') AS source_system,
        step,
        run_id,
        run_status,
        duration_ms,
        environment,
        job_name,
        parent_run_id
      FROM pipeline_runs
      WHERE ${where}
      ORDER BY timestamp_utc DESC
    `,
    values,
  );

  return (result.rows as PipelineRunRow[]).map((row) => ({
    ...row,
    duration_ms: row.duration_ms === null ? null : Number(row.duration_ms),
  })) as PipelineRun[];
}

export async function getDataQualityChecksFromSaaS(range: DateRange): Promise<DataQualityCheck[]> {
  const metaRows = await getDataQualityChecksFromMetaStore(range);
  if (metaRows.length > 0) return metaRows;

  const from = normalizeDate(range.from);
  const to = normalizeDate(range.to);
  const pool = getPgPool();

  const values: Array<string> = [from, to];
  let where = "event_date BETWEEN $1 AND $2";
  if (range.installationId) {
    values.push(range.installationId);
    where += ` AND installation_id = $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT
        event_type,
        timestamp_utc,
        to_char(event_date, 'YYYY-MM-DD') AS event_date,
        dataset_id,
        COALESCE(step, '') AS step,
        COALESCE(run_id, '') AS run_id,
        check_id,
        check_status,
        check_category,
        policy_version,
        environment,
        check_mode,
        check_result,
        parent_run_id
      FROM data_quality_checks
      WHERE ${where}
      ORDER BY timestamp_utc DESC
    `,
    values,
  );

  return result.rows as DataQualityCheck[];
}

export async function getLineageHopsFromSaaS(range: DateRange): Promise<LineageHop[]> {
  const metaRows = await getLineageHopsFromMetaStore(range);
  if (metaRows.length > 0) return metaRows;

  const from = normalizeDate(range.from);
  const to = normalizeDate(range.to);
  const pool = getPgPool();

  const values: Array<string> = [from, to];
  let where = "event_date BETWEEN $1 AND $2";
  if (range.installationId) {
    values.push(range.installationId);
    where += ` AND installation_id = $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT
        event_type,
        timestamp_utc,
        to_char(event_date, 'YYYY-MM-DD') AS event_date,
        dataset_id,
        step,
        run_id,
        source_entity,
        COALESCE(source_type, '') AS source_type,
        COALESCE(source_ref, '') AS source_ref,
        source_attribute,
        target_entity,
        COALESCE(target_type, '') AS target_type,
        COALESCE(target_ref, '') AS target_ref,
        target_attribute,
        source_system,
        installation_id,
        environment,
        schema_version,
        lineage_evidence,
        hop_kind
      FROM data_lineage
      WHERE ${where}
      ORDER BY timestamp_utc DESC
    `,
    values,
  );

  return result.rows as LineageHop[];
}

export async function getLineageEntitiesFromSaaS(installationId?: string | null): Promise<LineageEntity[]> {
  const metaRows = await getLineageEntitiesFromMetaStore(installationId);
  if (metaRows.length > 0) return metaRows;

  const pool = getPgPool();

  // WP-5.3: context hops excluded from entity graph and all derived counts/depths.
  // data_flow hops (and legacy NULL) are the only material lineage.
  const installationFilter = installationId ? ` AND installation_id = $1` : "";
  const values: string[] = installationId ? [installationId] : [];
  const DATA_FLOW_FILTER = `(hop_kind = 'data_flow' OR hop_kind IS NULL)${installationFilter}`;

  const result = await pool.query(`
    WITH entity_events AS (
      SELECT
        source_entity AS entity_fqn,
        COALESCE(NULLIF(source_type, ''), 'UNKNOWN') AS layer,
        dataset_id,
        run_id,
        step,
        environment,
        timestamp_utc
      FROM data_lineage
      WHERE ${DATA_FLOW_FILTER}
      UNION ALL
      SELECT
        target_entity AS entity_fqn,
        COALESCE(NULLIF(target_type, ''), 'UNKNOWN') AS layer,
        dataset_id,
        run_id,
        step,
        environment,
        timestamp_utc
      FROM data_lineage
      WHERE ${DATA_FLOW_FILTER}
    ),
    latest_entity AS (
      SELECT DISTINCT ON (entity_fqn)
        entity_fqn,
        layer,
        dataset_id
      FROM entity_events
      ORDER BY entity_fqn, timestamp_utc DESC
    ),
    adjacency AS (
      SELECT
        e.entity_fqn,
        COALESCE(up.upstream_entity_fqns, ARRAY[]::TEXT[]) AS upstream_entity_fqns,
        COALESCE(dn.downstream_entity_fqns, ARRAY[]::TEXT[]) AS downstream_entity_fqns
      FROM latest_entity e
      LEFT JOIN (
        SELECT
          target_entity AS entity_fqn,
          ARRAY_AGG(DISTINCT source_entity ORDER BY source_entity) AS upstream_entity_fqns
        FROM data_lineage
        WHERE ${DATA_FLOW_FILTER}
        GROUP BY target_entity
      ) up USING (entity_fqn)
      LEFT JOIN (
        SELECT
          source_entity AS entity_fqn,
          ARRAY_AGG(DISTINCT target_entity ORDER BY target_entity) AS downstream_entity_fqns
        FROM data_lineage
        WHERE ${DATA_FLOW_FILTER}
        GROUP BY source_entity
      ) dn USING (entity_fqn)
    ),
    latest_status AS (
      SELECT DISTINCT ON (ee.entity_fqn)
        ee.entity_fqn,
        COALESCE(NULLIF(UPPER(pr.run_status), ''), 'UNKNOWN') AS latest_status
      FROM entity_events ee
      LEFT JOIN pipeline_runs pr
        ON pr.run_id = ee.run_id
       AND pr.step = ee.step
       AND COALESCE(pr.environment, '') = COALESCE(ee.environment, '')
      ORDER BY ee.entity_fqn, pr.timestamp_utc DESC NULLS LAST, ee.timestamp_utc DESC
    ),
    status_rollup AS (
      SELECT
        ee.entity_fqn,
        MAX(
          CASE UPPER(COALESCE(pr.run_status, ''))
            WHEN 'FAILED' THEN 3
            WHEN 'WARNING' THEN 2
            WHEN 'SUCCESS' THEN 1
            ELSE 0
          END
        ) AS worst_rank,
        MAX(CASE WHEN UPPER(pr.run_status) = 'SUCCESS' THEN pr.timestamp_utc END) AS latest_success_at
      FROM entity_events ee
      LEFT JOIN pipeline_runs pr
        ON pr.run_id = ee.run_id
       AND pr.step = ee.step
       AND COALESCE(pr.environment, '') = COALESCE(ee.environment, '')
      GROUP BY ee.entity_fqn
    )
    SELECT
      le.dataset_id,
      le.entity_fqn,
      le.layer,
      COALESCE(ls.latest_status, 'UNKNOWN') AS latest_status,
      CASE COALESCE(sr.worst_rank, 0)
        WHEN 3 THEN 'FAILED'
        WHEN 2 THEN 'PARTIAL'
        WHEN 1 THEN 'SUCCESS'
        ELSE 'UNKNOWN'
      END AS end_to_end_status,
      sr.latest_success_at,
      adj.upstream_entity_fqns,
      adj.downstream_entity_fqns
    FROM latest_entity le
    LEFT JOIN adjacency adj ON adj.entity_fqn = le.entity_fqn
    LEFT JOIN latest_status ls ON ls.entity_fqn = le.entity_fqn
    LEFT JOIN status_rollup sr ON sr.entity_fqn = le.entity_fqn
    ORDER BY le.entity_fqn
  `, values);

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

export async function getLineageAttributesFromSaaS(installationId?: string | null): Promise<LineageAttribute[]> {
  const metaRows = await getLineageAttributesFromMetaStore(installationId);
  if (metaRows.length > 0) return metaRows;

  const pool = getPgPool();

  const installationFilter = installationId ? ` AND installation_id = $1` : "";
  const values: string[] = installationId ? [installationId] : [];

  const result = await pool.query(`
    SELECT DISTINCT
      source_entity AS source_entity_fqn,
      COALESCE(source_attribute, '') AS source_attribute,
      target_entity AS target_entity_fqn,
      COALESCE(target_attribute, '') AS target_attribute,
      source_type AS source_layer,
      target_type AS target_layer
    FROM data_lineage
    WHERE (hop_kind = 'data_flow' OR hop_kind IS NULL)${installationFilter}
      AND (NULLIF(source_attribute, '') IS NOT NULL OR NULLIF(target_attribute, '') IS NOT NULL)
    ORDER BY source_entity_fqn, source_attribute
  `, values);

  return result.rows.map((row: {
    source_entity_fqn: string;
    source_attribute: string;
    target_entity_fqn: string;
    target_attribute: string;
    source_layer: string | null;
    target_layer: string | null;
  }) => ({
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
