// Cost & ROI Attribution (WP-305)

import { getPgPool } from "@/lib/insights-saas-db";

export interface CostRecord {
  id: number;
  installation_id: string;
  product_id: string;
  period_start: string;
  period_end: string;
  cost_usd: string;
  cost_breakdown: {
    compute?: number;
    storage?: number;
    query?: number;
    other?: number;
  } | null;
  source: "databricks" | "manual" | "estimated";
  recorded_at: string;
}

export interface ProductCostSummary {
  product_id: string;
  total_cost_usd: number;
  latest_period_start: string | null;
  latest_period_end: string | null;
  record_count: number;
}

/**
 * ROI score: eenvoudige ratio consumentenwaarde / kostprijs.
 * Geeft null terug als de kostprijs nul is.
 */
export function roiScore(params: {
  consumerCount: number;
  usageEventCount: number;
  totalCostUsd: number;
}): number | null {
  const { consumerCount, usageEventCount, totalCostUsd } = params;
  if (totalCostUsd <= 0) return null;
  // Waarde-proxy: consumers × (1 + log10(events+1))
  const valueProxy = consumerCount * (1 + Math.log10(usageEventCount + 1));
  return Math.round((valueProxy / totalCostUsd) * 100) / 100;
}

export async function getProductCostSummary(
  installationId: string,
  productId: string
): Promise<{ records: CostRecord[]; summary: ProductCostSummary }> {
  const pool = getPgPool();
  const [recordsRes, summaryRes] = await Promise.all([
    pool.query(
      `SELECT * FROM meta.product_cost_records
       WHERE installation_id = $1 AND product_id = $2
       ORDER BY period_start DESC`,
      [installationId, productId]
    ),
    pool.query(
      `SELECT product_id,
              SUM(cost_usd)::numeric AS total_cost_usd,
              MAX(period_start) AS latest_period_start,
              MAX(period_end)   AS latest_period_end,
              COUNT(*)::int     AS record_count
       FROM meta.product_cost_records
       WHERE installation_id = $1 AND product_id = $2
       GROUP BY product_id`,
      [installationId, productId]
    ),
  ]);

  const summary: ProductCostSummary = summaryRes.rows[0] ?? {
    product_id: productId,
    total_cost_usd: 0,
    latest_period_start: null,
    latest_period_end: null,
    record_count: 0,
  };
  return { records: recordsRes.rows as CostRecord[], summary };
}

export async function listAllCosts(
  installationId: string,
  params?: { from?: string; to?: string }
): Promise<CostRecord[]> {
  const pool = getPgPool();
  const values: unknown[] = [installationId];
  let filter = "";

  if (params?.from) {
    values.push(params.from);
    filter += ` AND period_start >= $${values.length}`;
  }
  if (params?.to) {
    values.push(params.to);
    filter += ` AND period_end <= $${values.length}`;
  }

  const res = await pool.query(
    `SELECT * FROM meta.product_cost_records
     WHERE installation_id = $1${filter}
     ORDER BY period_start DESC, product_id`,
    values
  );
  return res.rows as CostRecord[];
}
