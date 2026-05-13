// Change Detection Engine (WP-203)
// Server-side detectie van schema-drift, eigenaarsdrift, contract-drift.
// Schrijft naar meta.change_events; deduplicatie: max 1 event per entity+type per 5 minuten.

import { getPgPool } from "@/lib/insights-saas-db";
import { notifyOnDrift, getNotificationConfig } from "@/lib/notifications";
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

  const insertRes = await pool.query(
    `INSERT INTO meta.change_events
       (installation_id, change_type, severity, entity_type, entity_id, diff, risk_assessment)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
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

  // Fire-and-forget notifications (LADR-077 Phase 3)
  if (insertRes.rows.length > 0) {
    const eventId = insertRes.rows[0].id as string;
    void (async () => {
      try {
        const config = await getNotificationConfig(event.installationId);
        if (config && Object.keys(config).length > 0) {
          // Convert DB event to notification event format
          const notifEvent = {
            id: eventId,
            change_type: event.change_type,
            severity: event.severity,
            entity_type: event.entity_type,
            entity_id: event.entity_id,
            diff: event.diff,
            risk_assessment: event.risk_assessment,
            detected_at: new Date().toISOString(),
          };
          await notifyOnDrift(notifEvent, event.installationId, config);
        }
      } catch (err) {
        console.error("Notification dispatch failed:", err);
      }
    })().catch(() => {});
  }
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
 * Caller levert before/after object_name; geen extra DB-query nodig.
 * Triggered from writeMetaPipelineRun nadat de dataset upsert is gedaan.
 */
export async function detectSchemaDrift(
  datasetId: string,
  installationId: string,
  before: { object_name: string | null },
  after: { object_name: string | null }
): Promise<void> {
  if (before.object_name === after.object_name) return;
  if (!before.object_name) return; // First time seen — no drift, just creation

  const pool = getPgPool();
  await writeChangeEvent(pool, {
    installationId,
    change_type: "schema_drift",
    severity: "breaking",
    entity_type: "dataset",
    entity_id: datasetId,
    diff: {
      before: { object_name: before.object_name },
      after: { object_name: after.object_name },
      affected_fields: ["object_name"],
    },
    risk_assessment: {
      level: "high",
      affected_outputs: [],
      recommended_action: "Validate downstream dependencies — object was renamed or replaced.",
    },
  });
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

// ---------------------------------------------------------------------------
// Lineage drift
// ---------------------------------------------------------------------------

/**
 * Detecteert lineage-drift door de INPUT-datasets van de huidige run
 * te vergelijken met de vorige run van dezelfde job.
 *
 * - Nieuwe upstream input  → informational
 * - Verdwenen upstream input → significant
 * - Meerdere verdwenen inputs → breaking
 */
export async function detectLineageDrift(
  jobId: string,
  currentRunId: string,
  installationId: string
): Promise<void> {
  const pool = getPgPool();

  // Two most recent completed runs for this job (current first)
  const runsRes = await pool.query(
    `SELECT r.run_id
     FROM meta.runs r
     WHERE r.job_id = $1
       AND r.installation_id = $2
       AND r.status IN ('SUCCESS','FAILED','WARNING')
     ORDER BY r.ended_at DESC NULLS LAST
     LIMIT 2`,
    [jobId, installationId]
  );

  if (runsRes.rows.length < 2) return; // No previous run to compare

  const [latestRunId, previousRunId] = (runsRes.rows as Array<{ run_id: string }>).map(r => r.run_id);

  // Verify the current run is the most recent (guard against late arrivals)
  if (latestRunId !== currentRunId) return;

  // Get INPUT datasets for both runs
  const inputsRes = await pool.query(
    `SELECT run_id, dataset_id
     FROM meta.run_io
     WHERE run_id = ANY($1)
       AND role = 'INPUT'`,
    [[currentRunId, previousRunId]]
  );

  const currentInputs = new Set(
    (inputsRes.rows as Array<{ run_id: string; dataset_id: string }>)
      .filter(r => r.run_id === currentRunId)
      .map(r => r.dataset_id)
  );
  const previousInputs = new Set(
    (inputsRes.rows as Array<{ run_id: string; dataset_id: string }>)
      .filter(r => r.run_id === previousRunId)
      .map(r => r.dataset_id)
  );

  if (currentInputs.size === 0 && previousInputs.size === 0) return;

  const added   = [...currentInputs].filter(id => !previousInputs.has(id));
  const removed = [...previousInputs].filter(id => !currentInputs.has(id));

  if (added.length === 0 && removed.length === 0) return;

  const severity: ChangeSeverity =
    removed.length > 1 ? "breaking" :
    removed.length === 1 ? "significant" :
    "informational";

  await writeChangeEvent(pool, {
    installationId,
    change_type: "lineage_drift",
    severity,
    entity_type: "dataset",
    entity_id: currentRunId,
    diff: {
      before: { inputs: [...previousInputs] },
      after:  { inputs: [...currentInputs] },
      affected_fields: [
        ...added.map(id => `added:${id}`),
        ...removed.map(id => `removed:${id}`),
      ],
    },
    risk_assessment: removed.length > 0 ? {
      level: removed.length > 1 ? "high" : "medium",
      affected_outputs: [],
      recommended_action: `Upstream source${removed.length > 1 ? "s" : ""} removed: ${removed.join(", ")}. Verify pipeline configuration.`,
    } : undefined,
  });
}

// ---------------------------------------------------------------------------
// Output lineage drift (LADR-077 Phase 2c)
// ---------------------------------------------------------------------------

/**
 * Detecteert output-lineage drift door de OUTPUT-datasets van de huidige run
 * te vergelijken met de vorige run van dezelfde job.
 *
 * - Nieuwe output dataset          → informational
 * - Verdwenen output dataset       → significant
 * - Meerdere verdwenen outputs     → breaking
 */
export async function detectOutputLineageDrift(
  jobId: string,
  currentRunId: string,
  installationId: string
): Promise<void> {
  const pool = getPgPool();

  // Two most recent completed runs for this job
  const runsRes = await pool.query(
    `SELECT r.run_id
     FROM meta.runs r
     WHERE r.job_id = $1
       AND r.installation_id = $2
       AND r.status IN ('SUCCESS','FAILED','WARNING')
     ORDER BY r.ended_at DESC NULLS LAST
     LIMIT 2`,
    [jobId, installationId]
  );

  if (runsRes.rows.length < 2) return; // No previous run to compare

  const [latestRunId, previousRunId] = (runsRes.rows as Array<{ run_id: string }>).map(r => r.run_id);

  // Verify the current run is the most recent
  if (latestRunId !== currentRunId) return;

  // Get OUTPUT datasets for both runs
  const outputsRes = await pool.query(
    `SELECT run_id, dataset_id
     FROM meta.run_io
     WHERE run_id = ANY($1)
       AND role = 'OUTPUT'`,
    [[currentRunId, previousRunId]]
  );

  const currentOutputs = new Set(
    (outputsRes.rows as Array<{ run_id: string; dataset_id: string }>)
      .filter(r => r.run_id === currentRunId)
      .map(r => r.dataset_id)
  );
  const previousOutputs = new Set(
    (outputsRes.rows as Array<{ run_id: string; dataset_id: string }>)
      .filter(r => r.run_id === previousRunId)
      .map(r => r.dataset_id)
  );

  // Detect changes
  const added = [...currentOutputs].filter(id => !previousOutputs.has(id));
  const removed = [...previousOutputs].filter(id => !currentOutputs.has(id));

  if (added.length === 0 && removed.length === 0) return; // No change

  // Classify severity
  let severity: ChangeSeverity = "informational";
  if (removed.length >= 2) {
    severity = "breaking";
  } else if (removed.length === 1) {
    severity = "significant";
  } else if (added.length > 0) {
    severity = "informational";
  }

  await writeChangeEvent(pool, {
    installationId,
    change_type: "lineage_drift",
    severity,
    entity_type: "dataset",
    entity_id: currentRunId,
    diff: {
      before: { outputs: [...previousOutputs] },
      after:  { outputs: [...currentOutputs] },
      affected_fields: [
        ...added.map(id => `added:${id}`),
        ...removed.map(id => `removed:${id}`),
      ],
    },
    risk_assessment: removed.length > 0 ? {
      level: removed.length > 1 ? "high" : "medium",
      affected_outputs: removed,
      recommended_action: `Output dataset${removed.length > 1 ? "s" : ""} removed: ${removed.join(", ")}. Verify job configuration and downstream dependencies.`,
    } : undefined,
  });
}

