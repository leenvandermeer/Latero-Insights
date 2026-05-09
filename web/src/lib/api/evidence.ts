// Typed API client — Evidence Ledger (WP-303)

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

export interface EvidenceGaps {
  missing_types: string[];
  last_record_at: Record<string, string>;
}

export async function getProductEvidence(
  productId: string,
  params?: { event_type?: EvidenceEventType; page?: number; page_size?: number }
): Promise<{ data: EvidenceRecord[]; meta: { total: number; page: number; page_size: number } }> {
  const url = new URL(`/api/products/${encodeURIComponent(productId)}/evidence`, window.location.origin);
  if (params?.event_type) url.searchParams.set("event_type", params.event_type);
  if (params?.page) url.searchParams.set("page", String(params.page));
  if (params?.page_size) url.searchParams.set("page_size", String(params.page_size));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to load evidence");
  return res.json() as Promise<{ data: EvidenceRecord[]; meta: { total: number; page: number; page_size: number } }>;
}

export async function appendEvidence(
  productId: string,
  data: { event_type: EvidenceEventType; payload: Record<string, unknown>; run_id?: string }
): Promise<EvidenceRecord> {
  const res = await fetch(`/api/products/${encodeURIComponent(productId)}/evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to append evidence");
  const body = await res.json() as { data: EvidenceRecord };
  return body.data;
}

export async function getEvidenceGaps(productId: string): Promise<EvidenceGaps> {
  const res = await fetch(`/api/products/${encodeURIComponent(productId)}/evidence/gaps`);
  if (!res.ok) throw new Error("Failed to load evidence gaps");
  const body = await res.json() as { data: EvidenceGaps };
  return body.data;
}
