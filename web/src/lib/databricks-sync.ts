import { DatabricksAdapter } from "@/lib/adapters/databricks";
import { getPgPool } from "@/lib/insights-saas-db";
import { writeMetaColumnLineage, writeMetaDqCheck, writeMetaLineage, writeMetaPipelineRun } from "@/lib/meta-ingest";

// Fallback installation_id used when no session is available (e.g. CLI/admin triggers).
const SYNC_INSTALLATION_ID = "databricks-sync";

export interface SyncResult {
  pipeline_runs: number;
  dq_checks: number;
  lineage: number;
  column_lineage: number;
  diagnostics?: {
    environment_filter: string | null;
    date_range: { from: string; to: string };
    rows_from_databricks: { runs: number; dq_checks: number; lineage: number; column_lineage: number };
  };
}

function assertDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Date must use YYYY-MM-DD format");
  }
  return value;
}

/**
 * Normaliseert MDCF DQ-statuswaarden (PASS/FAIL/WARN/ERROR/SKIPPED)
 * naar het meta.quality_results vocabulaire (SUCCESS/FAILED/WARNING).
 * SKIPPED wordt behandeld als WARNING (observatie zonder harde fout).
 */
function normalizeMdcfDqStatus(raw: string): string {
  switch (raw.trim().toUpperCase()) {
    case "PASS":    return "SUCCESS";
    case "PASSED":  return "SUCCESS";
    case "FAIL":    return "FAILED";
    case "FAILED":  return "FAILED";
    case "ERROR":   return "FAILED";
    case "WARN":    return "WARNING";
    case "WARNING": return "WARNING";
    case "SKIPPED": return "WARNING";
    default:        return "FAILED";
  }
}

function normalizeSeverity(raw: string | null | undefined): string {
  const v = (raw ?? "").trim().toLowerCase();
  return ["high", "medium", "low"].includes(v) ? v : "medium";
}

export async function syncFromDatabricks(range: { from: string; to: string }, installationId?: string): Promise<SyncResult> {
  const from = assertDate(range.from);
  const to = assertDate(range.to);

  const effectiveInstallationId = installationId ?? SYNC_INSTALLATION_ID;
  const adapter = new DatabricksAdapter(installationId);
  const pool = getPgPool();

  const [runs, checks, hops, environmentFilter] = await Promise.all([
    adapter.getPipelineRuns({ from, to }),
    adapter.getDataQualityChecks({ from, to }),
    adapter.getLineageHops({ from, to }),
    adapter.getActiveEnvironmentScope(),
  ]);

  // Column lineage: alle SCD2-versies via getLineageAttributeHistory() zodat historische
  // versies ook naar Postgres worden geschreven. Valt terug op getLineageAttributes() als
  // de raw tabel nog geen SCD2-kolommen heeft (pre-migratie instanties).
  const attributes = adapter.getLineageAttributeHistory
    ? await adapter.getLineageAttributeHistory()
    : await adapter.getLineageAttributes();

  if (runs.length === 0 && checks.length === 0 && hops.length === 0) {
    console.warn(
      `[sync/databricks] 0 records van Databricks — range: ${from}→${to}, environment_filter: ${environmentFilter ?? "(geen)"}`,
    );
  }

  for (const run of runs) {
    await writeMetaPipelineRun(pool, {
      installationId: effectiveInstallationId,
      datasetId: run.dataset_id,
      jobName: run.job_name || null,
      sourceSystem: run.source_system || null,
      targetLayer: run.target_layer || null,
      runId: run.run_id,
      status: run.run_status,
      environment: run.environment || "unknown",
      timestampUtc: run.timestamp_utc,
      durationMs: run.duration_ms ?? null,
    });
  }

  for (const check of checks) {
    await writeMetaDqCheck(pool, {
      installationId: effectiveInstallationId,
      datasetId: check.dataset_id,
      checkId: check.check_id,
      checkName: check.check_id,
      checkStatus: normalizeMdcfDqStatus(check.check_status),
      severity: normalizeSeverity(check.severity),
      checkCategory: check.check_category ?? null,
      policyVersion: check.policy_version ?? null,
      message: null,
      externalRunId: check.run_id || null,
      timestampUtc: check.timestamp_utc,
    });
  }

  for (const hop of hops) {
    await writeMetaLineage(pool, {
      installationId: effectiveInstallationId,
      externalRunId: hop.run_id,
      sourceEntity: hop.source_entity,
      targetEntity: hop.target_entity,
      sourceType: hop.source_type || null,
      targetType: hop.target_type || null,
      sourceAttribute: hop.source_attribute ?? null,
      targetAttribute: hop.target_attribute ?? null,
      sourceSystem: hop.source_system ?? null,
      sourceLayer: hop.source_layer || null,
      targetLayer: hop.target_layer || null,
      timestampUtc: hop.timestamp_utc,
    });
  }

  // Column lineage: schrijf per attribuut-mapping naar meta.lineage_columns
  for (const attr of attributes) {
    if (!attr.source_attribute || !attr.target_attribute) continue;
    await writeMetaColumnLineage(pool, {
      installationId: effectiveInstallationId,
      sourceName: attr.source_name,
      sourceColumn: attr.source_attribute,
      targetName: attr.target_name,
      targetColumn: attr.target_attribute,
      sourceLayer: attr.source_layer ?? null,
      targetLayer: attr.target_layer ?? null,
      transformationType: attr.transformation_type ?? null,
      validFrom: attr.valid_from ?? null,
      validTo: attr.valid_to ?? null,
    });
  }

  return {
    pipeline_runs: runs.length,
    dq_checks: checks.length,
    lineage: hops.length,
    column_lineage: attributes.length,
    diagnostics: {
      environment_filter: environmentFilter,
      date_range: { from, to },
      rows_from_databricks: {
        runs: runs.length,
        dq_checks: checks.length,
        lineage: hops.length,
        column_lineage: attributes.length,
      },
    },
  };
}
