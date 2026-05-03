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

export async function getPipelineRunsFromSaaS(range: DateRange): Promise<PipelineRun[]> {
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
