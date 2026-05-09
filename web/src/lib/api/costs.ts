// Typed API client — Cost & ROI (WP-305)

export interface CostRecord {
  id: number;
  installation_id: string;
  product_id: string;
  period_start: string;
  period_end: string;
  cost_usd: string;
  cost_breakdown: { compute?: number; storage?: number; query?: number; other?: number } | null;
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

export async function listCosts(params?: { from?: string; to?: string }): Promise<CostRecord[]> {
  const url = new URL("/api/costs", window.location.origin);
  if (params?.from) url.searchParams.set("from", params.from);
  if (params?.to) url.searchParams.set("to", params.to);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to load costs");
  const body = await res.json() as { data: CostRecord[] };
  return body.data;
}

export async function syncCostRecord(data: {
  product_id: string;
  period_start: string;
  period_end: string;
  cost_usd: number;
  cost_breakdown?: { compute?: number; storage?: number; query?: number; other?: number };
  source?: "databricks" | "manual" | "estimated";
}): Promise<CostRecord> {
  const res = await fetch("/api/costs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to sync cost record");
  const body = await res.json() as { data: CostRecord };
  return body.data;
}

export async function getProductCosts(
  productId: string
): Promise<{ records: CostRecord[]; summary: ProductCostSummary }> {
  const res = await fetch(`/api/products/${encodeURIComponent(productId)}/costs`);
  if (!res.ok) throw new Error("Failed to load product costs");
  const body = await res.json() as { data: { records: CostRecord[]; summary: ProductCostSummary } };
  return body.data;
}
