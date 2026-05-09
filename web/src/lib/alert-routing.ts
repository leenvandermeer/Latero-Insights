/**
 * alert-routing.ts
 * Alert routing and cascade-suppression logic.
 */

import { getPgPool } from "@/lib/insights-saas-db";

export interface Alert {
  id: number;
  installation_id: string;
  type: string;
  severity: string;
  title: string;
  message: string | null;
  source_id: string | null;
  domain: string | null;
  product_id: string | null;
  status: "open" | "acknowledged" | "resolved" | "suppressed";
  routed_to: string | null;
  routing_rule_id: string | null;
  suppressed_by: number | null;
  digest_batch_id: string | null;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

export interface RoutingRule {
  id: string;
  installation_id: string;
  name: string;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  priority: number;
  active: boolean;
  created_at: string;
}

/**
 * Evaluates routing rules in priority order (lowest number = highest priority).
 * Writes routed_to and routing_rule_id to the alert row.
 */
export async function routeAlert(
  alert: Alert,
  installationId: string
): Promise<{ routed_to: string | null; rule_id: string | null }> {
  const pool = getPgPool();

  const rulesResult = await pool.query<RoutingRule>(
    `SELECT * FROM meta.alert_routing_rules
     WHERE installation_id = $1 AND active = true
     ORDER BY priority ASC`,
    [installationId]
  );

  for (const rule of rulesResult.rows) {
    if (matchesConditions(alert, rule.conditions)) {
      const routedTo = (rule.actions as Record<string, string>)["notify"] ?? null;
      const digestBatch = (rule.actions as Record<string, string>)["digest_batch_id"] ?? null;

      await pool.query(
        `UPDATE meta.alerts
         SET routed_to = $1, routing_rule_id = $2, digest_batch_id = COALESCE($3, digest_batch_id)
         WHERE id = $4`,
        [routedTo, rule.id, digestBatch, alert.id]
      );

      return { routed_to: routedTo, rule_id: rule.id };
    }
  }

  return { routed_to: null, rule_id: null };
}

/**
 * Marks all alerts sharing the same source_id chain as suppressed by the given incident.
 */
export async function suppressCascade(
  rootIncidentId: number,
  installationId: string
): Promise<number> {
  const pool = getPgPool();

  // Find the source_id of all open alerts linked to this incident's product
  const incidentResult = await pool.query<{ product_id: string | null }>(
    `SELECT product_id FROM meta.incidents WHERE id = $1 AND installation_id = $2`,
    [rootIncidentId, installationId]
  );

  if (incidentResult.rowCount === 0) return 0;
  const productId = incidentResult.rows[0]?.product_id ?? null;
  if (!productId) return 0;

  const result = await pool.query<{ id: number }>(
    `UPDATE meta.alerts
     SET status = 'suppressed', suppressed_by = $1
     WHERE installation_id = $2
       AND product_id = $3
       AND status = 'open'
     RETURNING id`,
    [rootIncidentId, installationId, productId]
  );

  return result.rowCount ?? 0;
}

/**
 * Returns all alerts for an installation, optionally filtered.
 */
export async function listAlerts(
  installationId: string,
  params?: { status?: string; severity?: string; limit?: number }
): Promise<Alert[]> {
  const pool = getPgPool();
  const values: unknown[] = [installationId];
  const filters: string[] = [];

  if (params?.status) {
    values.push(params.status);
    filters.push(`status = $${values.length}`);
  }
  if (params?.severity) {
    values.push(params.severity);
    filters.push(`severity = $${values.length}`);
  }

  const where = filters.length > 0 ? `AND ${filters.join(" AND ")}` : "";
  const limit = params?.limit ?? 100;
  values.push(limit);

  const result = await pool.query<Alert>(
    `SELECT * FROM meta.alerts
     WHERE installation_id = $1 ${where}
     ORDER BY created_at DESC
     LIMIT $${values.length}`,
    values
  );

  return result.rows;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchesConditions(alert: Alert, conditions: Record<string, unknown>): boolean {
  if (conditions["type"] && conditions["type"] !== alert.type) return false;
  if (conditions["domain"] && conditions["domain"] !== alert.domain) return false;
  if (conditions["severity"] && conditions["severity"] !== alert.severity) return false;
  if (conditions["product_id"] && conditions["product_id"] !== alert.product_id) return false;
  return true;
}
