/**
 * metadata-graph.ts
 * Server-side graph traversal for the Latero metadata graph.
 */

import { getPgPool } from "@/lib/insights-saas-db";

export interface ProductFilter {
  owner?: string;
  domain?: string;
  sla_tier?: string;
  health_status?: string;
  has_owner?: boolean;
  trust_score_lt?: number;
  trust_score_gt?: number;
}

export interface GraphNode {
  entity_id: string;
  display_name: string;
  entity_type: string;
  product_id: string;
}

export interface ProductSnapshot {
  data_product_id: string;
  display_name: string;
  owner: string | null;
  domain: string | null;
  sla_tier: string | null;
  health_status: string | null;
  trust_score: number | null;
  entity_count: number;
  open_incidents: number;
}

/**
 * Traverse all downstream nodes from an entity (following lineage_edges).
 * Returns nodes up to maxDepth hops away.
 */
export async function traverseDownstream(
  entityId: string,
  installationId: string,
  maxDepth = 5
): Promise<GraphNode[]> {
  const pool = getPgPool();
  // Use a recursive CTE to traverse lineage_edges via datasets → entities
  const result = await pool.query<GraphNode>(
    `WITH RECURSIVE downstream AS (
       -- Seed: datasets linked to the given entity
       SELECT ds.dataset_id, ds.entity_id, 1 AS depth
       FROM meta.datasets ds
       WHERE ds.entity_id = $1 AND ds.installation_id = $2 AND ds.valid_to IS NULL

       UNION ALL

       -- Follow edges forward
       SELECT target.dataset_id, target.entity_id, d.depth + 1
       FROM downstream d
       JOIN meta.lineage_edges le ON le.source_dataset_id = d.dataset_id AND le.installation_id = $2
       JOIN meta.datasets target ON target.dataset_id = le.target_dataset_id AND target.valid_to IS NULL
       WHERE d.depth < $3
     )
     SELECT DISTINCT
       e.entity_id,
       e.display_name,
       e.entity_type,
       e.data_product_id AS product_id
     FROM downstream ds2
     JOIN meta.entities e ON e.entity_id = ds2.entity_id AND e.installation_id = $2`,
    [entityId, installationId, maxDepth]
  );
  return result.rows;
}

/**
 * Traverse all upstream nodes from an entity.
 */
export async function traverseUpstream(
  entityId: string,
  installationId: string,
  maxDepth = 5
): Promise<GraphNode[]> {
  const pool = getPgPool();
  const result = await pool.query<GraphNode>(
    `WITH RECURSIVE upstream AS (
       SELECT ds.dataset_id, ds.entity_id, 1 AS depth
       FROM meta.datasets ds
       WHERE ds.entity_id = $1 AND ds.installation_id = $2 AND ds.valid_to IS NULL

       UNION ALL

       SELECT source.dataset_id, source.entity_id, u.depth + 1
       FROM upstream u
       JOIN meta.lineage_edges le ON le.target_dataset_id = u.dataset_id AND le.installation_id = $2
       JOIN meta.datasets source ON source.dataset_id = le.source_dataset_id AND source.valid_to IS NULL
       WHERE u.depth < $3
     )
     SELECT DISTINCT
       e.entity_id,
       e.display_name,
       e.entity_type,
       e.data_product_id AS product_id
     FROM upstream u2
     JOIN meta.entities e ON e.entity_id = u2.entity_id AND e.installation_id = $2`,
    [entityId, installationId, maxDepth]
  );
  return result.rows;
}

/**
 * Find products matching a structured filter.
 */
export async function findProductsByFilter(
  filter: ProductFilter,
  installationId: string
): Promise<ProductSnapshot[]> {
  const pool = getPgPool();
  const values: unknown[] = [installationId];
  const conditions: string[] = [];

  if (filter.owner !== undefined) {
    values.push(filter.owner);
    conditions.push(`p.owner = $${values.length}`);
  }
  if (filter.domain !== undefined) {
    values.push(filter.domain);
    conditions.push(`p.domain = $${values.length}`);
  }
  if (filter.sla_tier !== undefined) {
    values.push(filter.sla_tier);
    conditions.push(`p.sla_tier = $${values.length}`);
  }
  if (filter.has_owner === true) {
    conditions.push("p.owner IS NOT NULL AND p.owner != ''");
  }
  if (filter.has_owner === false) {
    conditions.push("(p.owner IS NULL OR p.owner = '')");
  }

  const where = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

  const result = await pool.query<ProductSnapshot>(
    `SELECT
       p.data_product_id,
       p.display_name,
       p.owner,
       p.domain,
       p.sla_tier,
       p.health_status,
       (SELECT ts.score FROM meta.trust_score_snapshots ts
        WHERE ts.installation_id = $1 AND ts.product_id = p.data_product_id
        ORDER BY ts.calculated_at DESC LIMIT 1) AS trust_score,
       (SELECT COUNT(*)::int FROM meta.entities e
        WHERE e.installation_id = $1 AND e.data_product_id = p.data_product_id) AS entity_count,
       (SELECT COUNT(*)::int FROM meta.incidents i
        WHERE i.installation_id = $1 AND i.product_id = p.data_product_id AND i.status = 'open') AS open_incidents
     FROM meta.data_products p
     WHERE p.installation_id = $1 ${where}
     ORDER BY p.display_name`,
    values
  );

  return result.rows;
}

/**
 * Get a complete product snapshot at a specific point in time.
 */
export async function getProductSnapshot(
  productId: string,
  asOf: string,
  installationId: string
): Promise<ProductSnapshot | null> {
  const pool = getPgPool();
  const result = await pool.query<ProductSnapshot>(
    `SELECT
       p.data_product_id,
       p.display_name,
       p.owner,
       p.domain,
       p.sla_tier,
       p.health_status,
       (SELECT ts.score FROM meta.trust_score_snapshots ts
        WHERE ts.installation_id = $1 AND ts.product_id = p.data_product_id
          AND ts.calculated_at <= $3
        ORDER BY ts.calculated_at DESC LIMIT 1) AS trust_score,
       (SELECT COUNT(*)::int FROM meta.entities e
        WHERE e.installation_id = $1 AND e.data_product_id = p.data_product_id) AS entity_count,
       (SELECT COUNT(*)::int FROM meta.incidents i
        WHERE i.installation_id = $1 AND i.product_id = p.data_product_id
          AND i.status = 'open' AND i.opened_at <= $3) AS open_incidents
     FROM meta.data_products p
     WHERE p.installation_id = $1 AND p.data_product_id = $2`,
    [installationId, productId, asOf]
  );

  return result.rows[0] ?? null;
}
