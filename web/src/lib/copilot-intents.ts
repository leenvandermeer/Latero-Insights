/**
 * copilot-intents.ts
 * Intent classification and execution for the Latero Copilot query layer.
 * Operates on structured metadata only — never sends raw data to any LLM.
 */

import {
  traverseDownstream,
  findProductsByFilter,
  getProductSnapshot,
} from "@/lib/metadata-graph";
import { getPgPool } from "@/lib/insights-saas-db";

// ── Intent types ──────────────────────────────────────────────────────────────

export type IntentType =
  | "impact_analysis"
  | "gap_query"
  | "historical_state"
  | "owner_lookup"
  | "compliance_query"
  | "incident_lookup"
  | "change_history"
  | "trust_query"
  | "unknown";

export interface ParsedIntent {
  type: IntentType;
  params: Record<string, string>;
  confidence: number;
}

export interface IntentResult {
  answer: string;
  citations: Array<{ label: string; href?: string }>;
  navigation_links: Array<{ label: string; href: string }>;
}

// ── Intent parsing ────────────────────────────────────────────────────────────

/**
 * Rule-based intent classification.
 * Avoids sending raw data to any LLM — classification is deterministic.
 */
export function parseIntent(query: string): ParsedIntent {
  const q = query.toLowerCase();

  if (/impact|downstream|affect|depend/.test(q)) {
    const entityMatch = query.match(/[`"']([^`"']+)[`"']/);
    return { type: "impact_analysis", params: { entity: entityMatch?.[1] ?? "" }, confidence: 0.85 };
  }

  if (/gap|missing|no owner|without owner|unowned/.test(q)) {
    return { type: "gap_query", params: { field: "owner" }, confidence: 0.8 };
  }

  if (/as of|on \d{4}|historical|last (week|month|year)|at \d/.test(q)) {
    const dateMatch = query.match(/\d{4}-\d{2}-\d{2}/);
    return { type: "historical_state", params: { as_of: dateMatch?.[0] ?? "" }, confidence: 0.75 };
  }

  if (/who owns|owner of|owned by|contact/.test(q)) {
    const productMatch = query.match(/[`"']([^`"']+)[`"']/);
    return { type: "owner_lookup", params: { product: productMatch?.[1] ?? "" }, confidence: 0.8 };
  }

  if (/trust score|trust|data quality score|quality score/.test(q)) {
    return { type: "trust_query", params: {}, confidence: 0.8 };
  }

  if (/compli|policy|policies|pass|fail|regulation|bcbs|csrd/.test(q)) {
    return { type: "compliance_query", params: {}, confidence: 0.8 };
  }

  if (/incident|outage|issue|problem|broken|failed/.test(q)) {
    return { type: "incident_lookup", params: {}, confidence: 0.75 };
  }

  if (/change|modified|updated|schema|drift|evolv/.test(q)) {
    return { type: "change_history", params: {}, confidence: 0.7 };
  }

  return { type: "unknown", params: {}, confidence: 0 };
}

// ── Intent execution ──────────────────────────────────────────────────────────

export async function executeIntent(
  intent: ParsedIntent,
  installationId: string
): Promise<IntentResult> {
  const pool = getPgPool();

  switch (intent.type) {
    case "gap_query": {
      const products = await findProductsByFilter({ has_owner: false }, installationId);
      if (products.length === 0) {
        return {
          answer: "All data products have an owner assigned.",
          citations: [],
          navigation_links: [{ label: "Products", href: "/products" }],
        };
      }
      return {
        answer: `${products.length} data product(s) have no owner assigned: ${products.slice(0, 5).map((p) => p.display_name).join(", ")}${products.length > 5 ? ` and ${products.length - 5} more` : ""}.`,
        citations: products.slice(0, 3).map((p) => ({ label: p.display_name, href: `/products/${p.data_product_id}` })),
        navigation_links: [{ label: "View all products", href: "/products" }],
      };
    }

    case "owner_lookup": {
      const products = await findProductsByFilter({}, installationId);
      const match = products.find((p) =>
        p.display_name.toLowerCase().includes((intent.params["product"] ?? "").toLowerCase())
      );
      if (!match) {
        return { answer: "No matching product found.", citations: [], navigation_links: [{ label: "Products", href: "/products" }] };
      }
      return {
        answer: match.owner
          ? `The owner of "${match.display_name}" is ${match.owner}.`
          : `"${match.display_name}" has no owner assigned.`,
        citations: [{ label: match.display_name, href: `/products/${match.data_product_id}` }],
        navigation_links: [{ label: "Open product", href: `/products/${match.data_product_id}` }],
      };
    }

    case "incident_lookup": {
      const result = await pool.query(
        `SELECT title, severity, status, product_id, created_at
         FROM meta.incidents
         WHERE installation_id = $1 AND status = 'open'
         ORDER BY created_at DESC LIMIT 10`,
        [installationId]
      );
      const incidents = result.rows as Array<{ title: string; severity: string; status: string; product_id: string; created_at: string }>;
      if (incidents.length === 0) {
        return { answer: "No open incidents found.", citations: [], navigation_links: [{ label: "Incidents", href: "/incidents" }] };
      }
      return {
        answer: `There are ${incidents.length} open incident(s). Most recent: "${incidents[0]?.title}" (${incidents[0]?.severity}).`,
        citations: incidents.slice(0, 3).map((i) => ({ label: i.title })),
        navigation_links: [{ label: "View all incidents", href: "/incidents" }],
      };
    }

    case "compliance_query": {
      const result = await pool.query(
        `SELECT verdict, COUNT(*)::int AS cnt
         FROM meta.policy_verdicts
         WHERE installation_id = $1
         GROUP BY verdict`,
        [installationId]
      );
      const counts = Object.fromEntries(result.rows.map((r: { verdict: string; cnt: number }) => [r.verdict, r.cnt]));
      const pass = counts["pass"] ?? 0;
      const fail = counts["fail"] ?? 0;
      const total = pass + fail + (counts["exception"] ?? 0);
      return {
        answer: total === 0
          ? "No policy verdicts recorded yet."
          : `Policy compliance: ${pass}/${total} checks passing (${Math.round((pass / total) * 100)}%).`,
        citations: [],
        navigation_links: [{ label: "Compliance matrix", href: "/compliance" }],
      };
    }

    case "change_history": {
      const result = await pool.query(
        `SELECT change_type, severity, entity_id, detected_at
         FROM meta.change_events
         WHERE installation_id = $1
         ORDER BY detected_at DESC LIMIT 5`,
        [installationId]
      );
      const changes = result.rows as Array<{ change_type: string; severity: string; entity_id: string; detected_at: string }>;
      return {
        answer: changes.length === 0
          ? "No recent changes recorded."
          : `${changes.length} recent change(s). Latest: ${changes[0]?.change_type} (${changes[0]?.severity}).`,
        citations: [],
        navigation_links: [{ label: "Change feed", href: "/changes" }],
      };
    }

    case "historical_state": {
      const asOf = intent.params["as_of"];
      if (!asOf) {
        return { answer: "Please specify a date (YYYY-MM-DD) for the historical query.", citations: [], navigation_links: [] };
      }
      const products = await findProductsByFilter({}, installationId);
      const snapshots = await Promise.all(
        products.slice(0, 5).map((p) => getProductSnapshot(p.data_product_id, asOf, installationId))
      );
      const valid = snapshots.filter(Boolean);
      return {
        answer: `As of ${asOf}: ${valid.length} product snapshot(s) available. Use the time-travel bar to view the full historical state.`,
        citations: valid.slice(0, 3).map((s) => ({ label: s!.display_name, href: `/products/${s!.data_product_id}` })),
        navigation_links: [{ label: "Products", href: "/products" }],
      };
    }

    case "trust_query": {
      const result = await pool.query(
        `SELECT dp.display_name, dp.data_product_id, t.score, t.calculated_at
         FROM meta.trust_score_snapshots t
         JOIN meta.data_products dp ON dp.data_product_id = t.product_id AND dp.installation_id = t.installation_id
         WHERE t.installation_id = $1
         ORDER BY t.calculated_at DESC, t.score DESC`,
        [installationId]
      );
      const scores = result.rows as Array<{ display_name: string; data_product_id: string; score: number; calculated_at: string }>;
      const unique = Object.values(
        scores.reduce((acc, r) => { if (!acc[r.data_product_id]) acc[r.data_product_id] = r; return acc; }, {} as Record<string, typeof scores[0]>)
      ).sort((a, b) => b.score - a.score);
      if (unique.length === 0) {
        return { answer: "No trust score data available yet.", citations: [], navigation_links: [{ label: "Products", href: "/products" }] };
      }
      const top = unique[0]!;
      return {
        answer: `Highest trust score: "${top.display_name}" at ${top.score}/100. Scores: ${unique.map((u) => `${u.display_name} (${u.score})`).join(", ")}.`,
        citations: unique.slice(0, 3).map((u) => ({ label: `${u.display_name}: ${u.score}`, href: `/products/${u.data_product_id}` })),
        navigation_links: [{ label: "View products", href: "/products" }],
      };
    }

    default:
      return {
        answer: "I don't have enough information to answer that query. Try asking about compliance, incidents, owners, or changes.",
        citations: [],
        navigation_links: [{ label: "Overview", href: "/overview" }],
      };
  }
}
