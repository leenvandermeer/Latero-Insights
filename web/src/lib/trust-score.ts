// Trust Score Engine (WP-104)
// Server-side berekening van Trust Score per data product.
// Scores worden opgeslagen in meta.trust_score_snapshots.
// Aanroepen vanuit: run-ingest (automatisch) of API-route (on-demand).

import { getPgPool } from "@/lib/insights-saas-db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrustFactor {
  id: string;
  label: string;
  weight: number;       // maximale bijdrage (positief)
  delta: number;        // aftrek toegepast (negatief of 0)
  passed: boolean;
  link?: string;        // navigatie-hint voor de UI
}

export interface TrustScoreResult {
  product_id: string;
  installation_id: string;
  score: number;
  factors: TrustFactor[];
  calculated_at: Date;
}

// ---------------------------------------------------------------------------
// Factor-definities
// ---------------------------------------------------------------------------
const MAX_SCORE = 100;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export async function calculateTrustScore(
  productId: string,
  installationId: string
): Promise<TrustScoreResult> {
  const pool = getPgPool();
  const factors: TrustFactor[] = [];
  let deduction = 0;

  // --- Factor 1: Owner assigned (−25 indien ontbreekt) ---
  const ownerRes = await pool.query(
    `SELECT owner FROM meta.data_products
     WHERE installation_id = $1 AND data_product_id = $2 AND valid_to IS NULL`,
    [installationId, productId]
  );
  const ownerTeam = ownerRes.rows[0]?.owner ?? null;
  const ownerPassed = !!ownerTeam;
  const ownerDelta = ownerPassed ? 0 : -25;
  deduction += Math.abs(ownerDelta);
  factors.push({
    id: "owner_assigned",
    label: "Owner assigned",
    weight: 25,
    delta: ownerDelta,
    passed: ownerPassed,
    link: `/products/${productId}`,
  });

  // --- Factor 2: SLA tier defined (−10 indien ontbreekt) ---
  const slaRes = await pool.query(
    `SELECT sla_tier FROM meta.data_products
     WHERE installation_id = $1 AND data_product_id = $2 AND valid_to IS NULL`,
    [installationId, productId]
  );
  const slaTier = slaRes.rows[0]?.sla_tier ?? null;
  const slaPassed = !!slaTier;
  const slaDelta = slaPassed ? 0 : -10;
  deduction += Math.abs(slaDelta);
  factors.push({
    id: "sla_defined",
    label: slaTier ? `SLA tier (${slaTier})` : "SLA tier (not set)",
    weight: 10,
    delta: slaDelta,
    passed: slaPassed,
    link: `/products/${productId}`,
  });

  // --- Factor 3: Lineage coverage (−15 indien < 80%) ---
  // Gebaseerd op datasets van entiteiten die tot dit product behoren
  const lineageRes = await pool.query(
    `SELECT
       COUNT(d.dataset_id)::int AS total_datasets,
       COUNT(CASE WHEN EXISTS (
         SELECT 1 FROM meta.lineage_edges le
         WHERE le.target_dataset_id = d.dataset_id AND le.installation_id = $1
       ) THEN 1 END)::int AS linked_datasets
     FROM meta.entities e
     JOIN meta.datasets d
       ON d.installation_id = e.installation_id
      AND d.entity_id = e.entity_id
     WHERE e.installation_id = $1 AND e.data_product_id = $2
       AND d.valid_to IS NULL`,
    [installationId, productId]
  );
  const totalDatasets = lineageRes.rows[0]?.total_datasets ?? 0;
  const linkedDatasets = lineageRes.rows[0]?.linked_datasets ?? 0;
  const lineageCoverage = totalDatasets > 0 ? linkedDatasets / totalDatasets : 1;
  const lineagePassed = lineageCoverage >= 0.8;
  const lineageDelta = lineagePassed ? 0 : -15;
  deduction += Math.abs(lineageDelta);
  factors.push({
    id: "lineage_coverage",
    label: `Lineage coverage (${Math.round(lineageCoverage * 100)}%)`,
    weight: 15,
    delta: lineageDelta,
    passed: lineagePassed,
    link: `/lineage`,
  });

  // --- Factor 3: Quality check pass rate (−25 indien < 95%) ---
  // Via: product → entities → datasets → quality_rules → quality_results (laatste 7d)
  const qcRes = await pool.query(
    `SELECT
       COUNT(qr.result_id)::int AS total_checks,
       COUNT(CASE WHEN qr.status = 'SUCCESS' THEN 1 END)::int AS passed_checks
     FROM meta.quality_results qr
     JOIN meta.quality_rules rul
       ON rul.installation_id = qr.installation_id AND rul.check_id = qr.check_id
     JOIN meta.datasets d
       ON d.installation_id = rul.installation_id AND d.dataset_id = rul.dataset_id
     JOIN meta.entities e
       ON e.installation_id = d.installation_id AND e.entity_id = d.entity_id
     WHERE qr.installation_id = $1
       AND e.data_product_id = $2
       AND qr.executed_at >= now() - INTERVAL '7 days'`,
    [installationId, productId]
  );
  const totalChecks = qcRes.rows[0]?.total_checks ?? 0;
  const passedChecks = qcRes.rows[0]?.passed_checks ?? 0;
  const qcRate = totalChecks > 0 ? passedChecks / totalChecks : 1;
  const qcPassed = qcRate >= 0.95;
  const qcDelta = qcPassed ? 0 : -25;
  deduction += Math.abs(qcDelta);
  factors.push({
    id: "quality_pass_rate",
    label: `Quality check pass rate (${Math.round(qcRate * 100)}%)`,
    weight: 25,
    delta: qcDelta,
    passed: qcPassed,
    link: `/quality`,
  });

  // --- Factor 5: Open critical incidents (−5 per stuk, max −25) ---
  const incidentRes = await pool.query(
    `SELECT COUNT(*)::int AS critical_count
     FROM meta.incidents
     WHERE installation_id = $1 AND product_id = $2
       AND severity = 'critical' AND status != 'resolved'`,
    [installationId, productId]
  );
  const criticalCount = incidentRes.rows[0]?.critical_count ?? 0;
  const incidentDeduction = Math.min(criticalCount * 5, 25);
  const incidentPassed = criticalCount === 0;
  deduction += incidentDeduction;
  factors.push({
    id: "open_critical_incidents",
    label: `Open critical incidents (${criticalCount})`,
    weight: 25,
    delta: -incidentDeduction,
    passed: incidentPassed,
    link: `/incidents?severity=critical&product_id=${productId}`,
  });

  const score = Math.max(0, MAX_SCORE - deduction) as number;
  const calculatedAt = new Date();

  // Persist snapshot
  await pool.query(
    `INSERT INTO meta.trust_score_snapshots
       (installation_id, product_id, score, factors, calculated_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [installationId, productId, score, JSON.stringify(factors), calculatedAt]
  );

  return { product_id: productId, installation_id: installationId, score, factors, calculated_at: calculatedAt };
}

/**
 * Haal het meest recente Trust Score snapshot op.
 * Retourneert null als er nog geen snapshot is.
 */
export async function getLatestTrustScore(
  productId: string,
  installationId: string,
  asOf?: string
): Promise<{ score: number; factors: TrustFactor[]; calculated_at: string } | null> {
  const pool = getPgPool();
  const values: unknown[] = [installationId, productId];
  let filter = "";
  if (asOf) {
    values.push(asOf);
    filter = `AND calculated_at <= $${values.length}`;
  }
  const result = await pool.query(
    `SELECT score, factors, calculated_at
     FROM meta.trust_score_snapshots
     WHERE installation_id = $1 AND product_id = $2 ${filter}
     ORDER BY calculated_at DESC
     LIMIT 1`,
    values
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

/**
 * Haal de laatste N snapshots op voor een trend.
 */
export async function getTrustScoreHistory(
  productId: string,
  installationId: string,
  limit = 90
): Promise<Array<{ score: number; calculated_at: string }>> {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT score, calculated_at
     FROM meta.trust_score_snapshots
     WHERE installation_id = $1 AND product_id = $2
     ORDER BY calculated_at DESC
     LIMIT $3`,
    [installationId, productId, limit]
  );
  return result.rows;
}
