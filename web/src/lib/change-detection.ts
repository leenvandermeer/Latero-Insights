// Change Detection Engine (WP-203)
// Server-side detectie van schema-drift, eigenaarsdrift, contract-drift.
// Schrijft naar meta.change_events; deduplicatie: max 1 event per entity+type per 5 minuten.

import { getPgPool } from "@/lib/insights-saas-db";
import type { Pool } from "pg";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChangeSeverity = "informational" | "significant" | "breaking";
type ChangeType =
  | "schema_drift"
  | "contract_drift"
  | "ownership_drift"
  | "statistical_drift"
  | "lineage_drift";

interface ChangeEventInput {
  installationId: string;
  change_type: ChangeType;
  severity: ChangeSeverity;
  entity_type: "product" | "entity" | "dataset";
  entity_id: string;
  diff: { before: unknown; after: unknown; affected_fields: string[] };
  risk_assessment?: { level: string; affected_outputs: string[]; recommended_action: string };
}

// ---------------------------------------------------------------------------
// Deduplication guard
// ---------------------------------------------------------------------------

async function shouldSkipDuplicate(
  pool: Pool,
  installationId: string,
  entity_id: string,
  change_type: string
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM meta.change_events
     WHERE installation_id = $1
       AND entity_id = $2
       AND change_type = $3
       AND detected_at >= now() - INTERVAL '5 minutes'
     LIMIT 1`,
    [installationId, entity_id, change_type]
  );
  return result.rows.length > 0;
}

async function writeChangeEvent(pool: Pool, event: ChangeEventInput): Promise<void> {
  const skip = await shouldSkipDuplicate(
    pool, event.installationId, event.entity_id, event.change_type
  );
  if (skip) return;

  await pool.query(
    `INSERT INTO meta.change_events
       (installation_id, change_type, severity, entity_type, entity_id, diff, risk_assessment)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      event.installationId,
      event.change_type,
      event.severity,
      event.entity_type,
      event.entity_id,
      JSON.stringify(event.diff),
      event.risk_assessment ? JSON.stringify(event.risk_assessment) : null,
    ]
  );
}

// ---------------------------------------------------------------------------
// Ownership drift
// ---------------------------------------------------------------------------

/**
 * Detecteert eigenaarsdrift voor een data product.
 * Triggered wanneer `owner` wordt gewijzigd of op null gezet.
 */
export async function detectOwnershipDrift(
  productId: string,
  installationId: string,
  previousOwner: string | null,
  currentOwner: string | null
): Promise<void> {
  if (previousOwner === currentOwner) return;

  const pool = getPgPool();
  const severity: ChangeSeverity = currentOwner === null ? "significant" : "informational";

  await writeChangeEvent(pool, {
    installationId,
    change_type: "ownership_drift",
    severity,
    entity_type: "product",
    entity_id: productId,
    diff: {
      before: { owner: previousOwner },
      after: { owner: currentOwner },
      affected_fields: ["owner"],
    },
    risk_assessment: currentOwner === null ? {
      level: "medium",
      affected_outputs: [],
      recommended_action: "Assign an owner to ensure accountability.",
    } : undefined,
  });
}

// ---------------------------------------------------------------------------
// Contract drift
// ---------------------------------------------------------------------------

/**
 * Detecteert contract-drift voor een data product.
 * Triggered wanneer SLA of contract_ver wordt gewijzigd.
 */
export async function detectContractDrift(
  productId: string,
  installationId: string,
  before: { sla?: unknown; contract_ver?: string | null },
  after: { sla?: unknown; contract_ver?: string | null }
): Promise<void> {
  const affectedFields: string[] = [];
  if (JSON.stringify(before.sla) !== JSON.stringify(after.sla)) affectedFields.push("sla");
  if (before.contract_ver !== after.contract_ver) affectedFields.push("contract_ver");
  if (affectedFields.length === 0) return;

  const pool = getPgPool();
  await writeChangeEvent(pool, {
    installationId,
    change_type: "contract_drift",
    severity: "significant",
    entity_type: "product",
    entity_id: productId,
    diff: {
      before,
      after,
      affected_fields: affectedFields,
    },
    risk_assessment: {
      level: "medium",
      affected_outputs: [],
      recommended_action: "Notify downstream consumers of contract changes.",
    },
  });
}

// ---------------------------------------------------------------------------
// Schema drift
// ---------------------------------------------------------------------------

/**
 * Detecteert schema-drift voor een dataset.
 * Compares current column set against previous temporal snapshot.
 * Triggered after run-ingest when temporal metadata exists.
 */
export async function detectSchemaDrift(
  datasetId: string,
  installationId: string
): Promise<void> {
  const pool = getPgPool();

  // Get the two most recent valid_from values for this dataset
  const versionsRes = await pool.query(
    `SELECT valid_from, object_name, dataset_id
     FROM meta.datasets
     WHERE installation_id = $1 AND dataset_id = $2
     ORDER BY valid_from DESC
     LIMIT 2`,
    [installationId, datasetId]
  );

  if (versionsRes.rows.length < 2) return; // No previous version to compare

  // For now: detect if the dataset was re-created (valid_to IS NOT NULL on previous)
  // Full column-level drift detection requires a schema snapshot table (future enhancement)
  const current = versionsRes.rows[0];
  const previous = versionsRes.rows[1];

  if (current.object_name !== previous.object_name) {
    await writeChangeEvent(pool, {
      installationId,
      change_type: "schema_drift",
      severity: "breaking",
      entity_type: "dataset",
      entity_id: datasetId,
      diff: {
        before: { object_name: previous.object_name },
        after: { object_name: current.object_name },
        affected_fields: ["object_name"],
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Statistical drift
// ---------------------------------------------------------------------------

/**
 * Detecteert statistische drift op basis van run volumes.
 * Vergelijkt laatste run-duur met 30-daags gemiddelde (Z-score > 2).
 */
export async function detectStatisticalDrift(
  datasetId: string,
  installationId: string
): Promise<void> {
  const pool = getPgPool();

  // Get recent run durations for this dataset
  const runsRes = await pool.query(
    `SELECT r.duration_ms, r.ended_at
     FROM meta.runs r
     JOIN meta.run_io rio ON rio.run_id = r.run_id
     WHERE r.installation_id = $1
       AND rio.dataset_id = $2
       AND r.duration_ms IS NOT NULL
       AND r.ended_at >= now() - INTERVAL '31 days'
     ORDER BY r.ended_at DESC
     LIMIT 30`,
    [installationId, datasetId]
  );

  if (runsRes.rows.length < 5) return; // Not enough data

  const durations = runsRes.rows.map((r) => Number(r.duration_ms));
  const latest = durations[0];
  const historical = durations.slice(1);

  const mean = historical.reduce((a, b) => a + b, 0) / historical.length;
  const variance = historical.reduce((a, b) => a + (b - mean) ** 2, 0) / historical.length;
  const stddev = Math.sqrt(variance);

  if (stddev === 0) return;
  const zScore = Math.abs((latest - mean) / stddev);

  if (zScore > 2) {
    const severity: ChangeSeverity = zScore > 3 ? "significant" : "informational";
    await writeChangeEvent(pool, {
      installationId,
      change_type: "statistical_drift",
      severity,
      entity_type: "dataset",
      entity_id: datasetId,
      diff: {
        before: { avg_duration_ms: Math.round(mean), stddev_ms: Math.round(stddev) },
        after: { latest_duration_ms: latest, z_score: Math.round(zScore * 100) / 100 },
        affected_fields: ["duration_ms"],
      },
    });
  }
}
