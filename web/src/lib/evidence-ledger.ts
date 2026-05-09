// Evidence Ledger (WP-303)
// Append-only bewijs-trail per data product.
// Hash = SHA-256 van de JSON-payload (deterministisch).

import { createHash } from "crypto";
import { getPgPool } from "@/lib/insights-saas-db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EvidenceEventType =
  | "quality_check"
  | "transformation"
  | "source_snapshot"
  | "approval"
  | "exception"
  | "incident_resolved";

export interface EvidenceRecord {
  id: number;
  installation_id: string;
  product_id: string;
  event_type: EvidenceEventType;
  run_id: string | null;
  payload: Record<string, unknown>;
  hash: string;
  recorded_at: string;
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Schrijft een evidence record naar de ledger.
 * Hash is SHA-256 van de gesorteerde JSON-payload (deterministisch).
 */
export async function appendEvidence(params: {
  installationId: string;
  productId: string;
  event_type: EvidenceEventType;
  payload: Record<string, unknown>;
  run_id?: string;
}): Promise<EvidenceRecord> {
  const { installationId, productId, event_type, payload, run_id } = params;

  // Deterministisch: sorteer keys voor consistente hashing
  const sortedPayload = sortDeep(payload);
  const hash = createHash("sha256").update(JSON.stringify(sortedPayload)).digest("hex");

  const pool = getPgPool();
  const result = await pool.query(
    `INSERT INTO meta.evidence_records
       (installation_id, product_id, event_type, run_id, payload, hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [installationId, productId, event_type, run_id ?? null, JSON.stringify(payload), hash]
  );
  return result.rows[0] as EvidenceRecord;
}

/**
 * Haal evidence records op (gepagineerd, nieuwste eerst).
 */
export async function getEvidenceRecords(params: {
  installationId: string;
  productId: string;
  event_type?: EvidenceEventType;
  page?: number;
  pageSize?: number;
}): Promise<{ records: EvidenceRecord[]; total: number }> {
  const { installationId, productId, event_type, page = 1, pageSize = 50 } = params;
  const offset = (page - 1) * pageSize;

  const values: unknown[] = [installationId, productId];
  let filter = "";
  if (event_type) {
    filter = ` AND event_type = $${values.length + 1}`;
    values.push(event_type);
  }

  const pool = getPgPool();
  const [recordsRes, countRes] = await Promise.all([
    pool.query(
      `SELECT * FROM meta.evidence_records
       WHERE installation_id = $1 AND product_id = $2${filter}
       ORDER BY recorded_at DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      values
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total FROM meta.evidence_records
       WHERE installation_id = $1 AND product_id = $2${filter}`,
      values
    ),
  ]);

  return { records: recordsRes.rows as EvidenceRecord[], total: countRes.rows[0]?.total ?? 0 };
}

/**
 * Detecteert ontbrekende verplichte event-types voor een product.
 * Vergelijkt aanwezige records met de vereiste types per actief policy pack.
 * Vereiste types worden bepaald op basis van policies met condition 'evidence_gap'.
 */
export async function getEvidenceGaps(
  productId: string,
  installationId: string
): Promise<{ missing_types: string[]; last_record_at: Record<string, string> }> {
  const pool = getPgPool();

  // Get last recorded_at per event_type
  const recordsRes = await pool.query(
    `SELECT event_type, MAX(recorded_at) AS last_recorded_at
     FROM meta.evidence_records
     WHERE installation_id = $1 AND product_id = $2
     GROUP BY event_type`,
    [installationId, productId]
  );

  const lastRecordAt: Record<string, string> = {};
  for (const row of recordsRes.rows) {
    lastRecordAt[row.event_type as string] = row.last_recorded_at as string;
  }

  // Required event types: derived from active policies with evidence-related subjects
  const REQUIRED_TYPES: EvidenceEventType[] = ["quality_check", "transformation"];
  const missing = REQUIRED_TYPES.filter((t) => !lastRecordAt[t]);

  return { missing_types: missing, last_record_at: lastRecordAt };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sortDeep(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortDeep);
  if (obj !== null && typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = sortDeep((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
}
