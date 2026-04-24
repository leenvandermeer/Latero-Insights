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
        environment
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
        policy_version
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

export async function getLineageEntitiesFromSaaS(): Promise<LineageEntity[]> {
  const pool = getPgPool();

  const result = await pool.query(`
    SELECT
      entity_name AS entity_fqn,
      COALESCE(entity_type, '') AS layer,
      source_system,
      environment
    FROM (
      SELECT DISTINCT source_entity AS entity_name, source_type AS entity_type, source_system, environment
      FROM data_lineage
      UNION
      SELECT DISTINCT target_entity, target_type, source_system, environment
      FROM data_lineage
    ) t
    ORDER BY entity_fqn
  `);

  return result.rows.map((row: { entity_fqn: string; layer: string; source_system: string | null; environment: string | null }) => ({
    entity_fqn: row.entity_fqn,
    layer: row.layer,
    latest_status: "UNKNOWN",
    end_to_end_status: "UNKNOWN",
    latest_success_at: null,
    upstream_entity_fqns: [],
    downstream_entity_fqns: [],
    lineage_group_id: null,
    last_completed_layer: null,
  })) as LineageEntity[];
}

export async function getLineageAttributesFromSaaS(): Promise<LineageAttribute[]> {
  const pool = getPgPool();

  const result = await pool.query(`
    SELECT DISTINCT
      source_entity AS source_entity_fqn,
      COALESCE(source_attribute, '') AS source_attribute,
      target_entity AS target_entity_fqn,
      COALESCE(target_attribute, '') AS target_attribute,
      source_type AS source_layer,
      target_type AS target_layer
    FROM data_lineage
    WHERE source_attribute IS NOT NULL OR target_attribute IS NOT NULL
    ORDER BY source_entity_fqn, source_attribute
  `);

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
