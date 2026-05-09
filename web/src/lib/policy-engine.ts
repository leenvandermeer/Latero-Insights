// Policy Engine (WP-301)
// Evalueert policies per product en schrijft verdicts naar meta.policy_verdicts.
// Policies zijn JSONB-gebaseerde rules; geen SQL in components.

import { getPgPool } from "@/lib/insights-saas-db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PolicyRule {
  subject: string;
  condition: string;
  threshold?: number;
}

export type PolicyScope =
  | { all: true }
  | { domains: string[] }
  | { products: string[] };

export interface Policy {
  id: string;
  installation_id: string;
  pack_id: string | null;
  name: string;
  description: string | null;
  rule: PolicyRule;
  scope: PolicyScope;
  action: "warn" | "block" | "notify";
  active: boolean;
}

export type PolicyVerdict = "pass" | "fail" | "exception";

// ---------------------------------------------------------------------------
// Condition evaluators
// ---------------------------------------------------------------------------

const CONDITIONS: Record<
  string,
  (productId: string, installationId: string, threshold?: number) => Promise<{ pass: boolean; detail?: Record<string, unknown> }>
> = {
  owner_missing: async (productId, installationId) => {
    const pool = getPgPool();
    const r = await pool.query(
      `SELECT owner FROM meta.data_products WHERE installation_id = $1 AND data_product_id = $2 AND valid_to IS NULL`,
      [installationId, productId]
    );
    return { pass: !!r.rows[0]?.owner };
  },

  sla_missing: async (productId, installationId) => {
    const pool = getPgPool();
    const r = await pool.query(
      `SELECT sla FROM meta.data_products WHERE installation_id = $1 AND data_product_id = $2 AND valid_to IS NULL`,
      [installationId, productId]
    );
    return { pass: !!r.rows[0]?.sla };
  },

  quality_below_threshold: async (productId, installationId, threshold = 95) => {
    const pool = getPgPool();
    const r = await pool.query(
      `SELECT
         COUNT(qr.result_id)::int AS total,
         COUNT(CASE WHEN qr.status = 'SUCCESS' THEN 1 END)::int AS passed
       FROM meta.quality_results qr
       JOIN meta.quality_rules rul ON rul.installation_id = qr.installation_id AND rul.check_id = qr.check_id
       JOIN meta.datasets d ON d.installation_id = rul.installation_id AND d.dataset_id = rul.dataset_id
       JOIN meta.entities e ON e.installation_id = d.installation_id AND e.entity_id = d.entity_id
       WHERE qr.installation_id = $1 AND e.data_product_id = $2
         AND qr.executed_at >= now() - INTERVAL '7 days'`,
      [installationId, productId]
    );
    const { total, passed } = r.rows[0] ?? { total: 0, passed: 0 };
    const rate = total > 0 ? (passed / total) * 100 : 100;
    return { pass: rate >= threshold, detail: { rate: Math.round(rate), threshold, total, passed } };
  },

  no_lineage: async (productId, installationId) => {
    const pool = getPgPool();
    const r = await pool.query(
      `SELECT COUNT(le.edge_id)::int AS edge_count
       FROM meta.entities e
       JOIN meta.datasets d ON d.installation_id = e.installation_id AND d.entity_id = e.entity_id AND d.valid_to IS NULL
       LEFT JOIN meta.lineage_edges le ON le.installation_id = $1 AND le.target_dataset_id = d.dataset_id
       WHERE e.installation_id = $1 AND e.data_product_id = $2 AND e.valid_to IS NULL`,
      [installationId, productId]
    );
    return { pass: (r.rows[0]?.edge_count ?? 0) > 0 };
  },

  open_incidents: async (productId, installationId, threshold = 0) => {
    const pool = getPgPool();
    const r = await pool.query(
      `SELECT COUNT(*)::int AS count FROM meta.incidents
       WHERE installation_id = $1 AND product_id = $2 AND status != 'resolved'`,
      [installationId, productId]
    );
    const count = r.rows[0]?.count ?? 0;
    return { pass: count <= threshold, detail: { open_count: count, threshold } };
  },

  contract_missing: async (productId, installationId) => {
    const pool = getPgPool();
    const r = await pool.query(
      `SELECT contract_ver FROM meta.data_products WHERE installation_id = $1 AND data_product_id = $2 AND valid_to IS NULL`,
      [installationId, productId]
    );
    return { pass: !!r.rows[0]?.contract_ver };
  },

  // ── WP-404: Advanced rule types ──────────────────────────────────────────

  /**
   * Fails if the volume of records in the latest pipeline run deviates more than
   * `threshold` % from the 30-day average.
   */
  volume_anomaly: async (productId, installationId, threshold = 30) => {
    const pool = getPgPool();
    const r = await pool.query(
      `WITH recent AS (
         SELECT row_count, started_at
         FROM meta.pipeline_runs pr
         JOIN meta.entities e ON e.installation_id = pr.installation_id AND e.data_product_id = $2
         WHERE pr.installation_id = $1 AND pr.started_at >= now() - INTERVAL '30 days'
         ORDER BY started_at DESC
       ),
       latest AS (SELECT row_count FROM recent LIMIT 1),
       avg_30 AS (SELECT AVG(row_count) AS avg FROM recent)
       SELECT latest.row_count AS latest_vol, avg_30.avg AS avg_vol
       FROM latest, avg_30`,
      [installationId, productId]
    );
    const row = r.rows[0] as { latest_vol: number | null; avg_vol: number | null } | undefined;
    if (!row?.latest_vol || !row.avg_vol) return { pass: true };
    const deviation = Math.abs((row.latest_vol - row.avg_vol) / row.avg_vol) * 100;
    return {
      pass: deviation <= threshold,
      detail: { deviation: Math.round(deviation), threshold, latest_vol: row.latest_vol, avg_vol: Math.round(row.avg_vol) },
    };
  },

  /**
   * Fails if there are no consumer access events for N days (default 30).
   */
  consumer_inactivity: async (productId, installationId, threshold = 30) => {
    const pool = getPgPool();
    const r = await pool.query(
      `SELECT MAX(last_access_at) AS last_access
       FROM meta.product_consumers
       WHERE installation_id = $1 AND product_id = $2`,
      [installationId, productId]
    );
    const lastAccess = r.rows[0]?.last_access as string | null;
    if (!lastAccess) return { pass: false, detail: { last_access: null, threshold_days: threshold } };
    const daysAgo = (Date.now() - new Date(lastAccess).getTime()) / 86400_000;
    return {
      pass: daysAgo <= threshold,
      detail: { days_since_access: Math.round(daysAgo), threshold_days: threshold },
    };
  },

  /**
   * Fails if a required evidence event_type is missing in the last N days (default 7).
   */
  evidence_gap: async (productId, installationId, threshold = 7) => {
    const pool = getPgPool();
    const r = await pool.query(
      `SELECT COUNT(*)::int AS cnt
       FROM meta.evidence_records
       WHERE installation_id = $1 AND product_id = $2
         AND recorded_at >= now() - ($3 || ' days')::INTERVAL`,
      [installationId, productId, threshold]
    );
    return {
      pass: (r.rows[0]?.cnt ?? 0) > 0,
      detail: { evidence_count: r.rows[0]?.cnt, threshold_days: threshold },
    };
  },

  /**
   * Fails if there are gaps of > threshold days in the evidence ledger
   * over the last 90 days (temporal coverage check).
   */
  temporal_coverage: async (productId, installationId, threshold = 7) => {
    const pool = getPgPool();
    // Find the longest gap in evidence records over last 90 days
    const r = await pool.query(
      `WITH daily AS (
         SELECT date_trunc('day', recorded_at)::date AS d
         FROM meta.evidence_records
         WHERE installation_id = $1 AND product_id = $2
           AND recorded_at >= now() - INTERVAL '90 days'
         GROUP BY 1
       ),
       gaps AS (
         SELECT d, LAG(d) OVER (ORDER BY d) AS prev_d,
                d - LAG(d) OVER (ORDER BY d) AS gap_days
         FROM daily
       )
       SELECT MAX(gap_days)::int AS max_gap FROM gaps`,
      [installationId, productId]
    );
    const maxGap = r.rows[0]?.max_gap ?? 0;
    return {
      pass: maxGap <= threshold,
      detail: { max_gap_days: maxGap, threshold_days: threshold },
    };
  },
};

// ---------------------------------------------------------------------------
// Core evaluation
// ---------------------------------------------------------------------------

/**
 * Evalueert één policy voor één product.
 * Controleert eerst of er een actieve, niet-verlopen uitzondering bestaat.
 */
export async function evaluatePolicy(
  policy: Policy,
  productId: string,
  installationId: string
): Promise<{ verdict: PolicyVerdict; detail?: Record<string, unknown> }> {
  const pool = getPgPool();

  // Check for active approved exception
  const exceptionRes = await pool.query(
    `SELECT 1 FROM meta.policy_exceptions
     WHERE installation_id = $1 AND policy_id = $2 AND product_id = $3
       AND status = 'approved' AND expiry_date >= CURRENT_DATE`,
    [installationId, policy.id, productId]
  );
  if (exceptionRes.rows.length > 0) return { verdict: "exception" };

  const evaluator = CONDITIONS[policy.rule.condition];
  if (!evaluator) {
    console.warn(`[policy-engine] Unknown condition: ${policy.rule.condition}`);
    return { verdict: "pass" };
  }

  const { pass, detail } = await evaluator(productId, installationId, policy.rule.threshold);
  return { verdict: pass ? "pass" : "fail", detail };
}

/**
 * Evalueert alle actieve policies voor alle producten in de installatie.
 * Schrijft verdicts naar meta.policy_verdicts.
 */
export async function runPolicyCheck(installationId: string): Promise<void> {
  const pool = getPgPool();

  const [policiesRes, productsRes] = await Promise.all([
    pool.query(
      `SELECT * FROM meta.policies WHERE installation_id = $1 AND active = true`,
      [installationId]
    ),
    pool.query(
      `SELECT data_product_id, domain FROM meta.data_products
       WHERE installation_id = $1 AND valid_to IS NULL AND deprecated_at IS NULL`,
      [installationId]
    ),
  ]);

  const policies = policiesRes.rows as Policy[];
  const products = productsRes.rows as { data_product_id: string; domain: string | null }[];

  for (const policy of policies) {
    const scope = policy.scope;
    const applicableProducts = products.filter((p) => {
      if ("all" in scope && scope.all) return true;
      if ("products" in scope) return scope.products.includes(p.data_product_id);
      if ("domains" in scope) return p.domain !== null && scope.domains.includes(p.domain);
      return false;
    });

    for (const product of applicableProducts) {
      try {
        const { verdict, detail } = await evaluatePolicy(policy, product.data_product_id, installationId);
        await pool.query(
          `INSERT INTO meta.policy_verdicts (policy_id, installation_id, product_id, verdict, detail)
           VALUES ($1, $2, $3, $4, $5)`,
          [policy.id, installationId, product.data_product_id, verdict, detail ? JSON.stringify(detail) : null]
        );
      } catch (err) {
        console.error(`[policy-engine] Error evaluating policy ${policy.id} for product ${product.data_product_id}:`, err);
      }
    }
  }
}
