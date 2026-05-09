/**
 * WP-102 — Data Product Registry v3: typed client
 *
 * Alle HTTP-aanroepen naar /api/data-products/* verlopen via deze module.
 * Client-componenten importeren uitsluitend deze functies — nooit directe fetch().
 */

export interface DataProductSla {
  freshness_minutes?: number;
  quality_threshold?: number;
}

export interface DataProduct {
  data_product_id: string;
  display_name: string;
  description: string | null;
  owner: string | null;
  domain: string | null;
  sla_tier: "bronze" | "silver" | "gold" | null;
  sla: DataProductSla | null;
  contract_ver: string | null;
  deprecated_at: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  entity_ids: string[];
  entity_count: number;
}

export interface ListDataProductsOptions {
  include_deprecated?: boolean;
}

export interface CreateDataProductInput {
  display_name: string;
  description?: string;
  owner?: string;
  domain?: string;
  sla_tier?: "bronze" | "silver" | "gold";
  sla?: DataProductSla;
  contract_ver?: string;
  entity_ids?: string[];
}

export interface UpdateDataProductInput {
  display_name?: string;
  description?: string | null;
  owner?: string | null;
  domain?: string | null;
  sla_tier?: "bronze" | "silver" | "gold" | null;
  sla?: DataProductSla | null;
  contract_ver?: string | null;
  entity_ids?: string[];
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function listDataProducts(
  options: ListDataProductsOptions = {}
): Promise<DataProduct[]> {
  const params = new URLSearchParams();
  if (options.include_deprecated) params.set("include_deprecated", "true");
  const qs = params.size > 0 ? `?${params}` : "";
  const result = await apiFetch<{ data: DataProduct[] }>(`/api/data-products${qs}`);
  return result.data;
}

export async function getDataProduct(id: string): Promise<DataProduct> {
  const result = await apiFetch<{ data: DataProduct }>(`/api/data-products/${encodeURIComponent(id)}`);
  return result.data;
}

export async function createDataProduct(input: CreateDataProductInput): Promise<DataProduct> {
  const result = await apiFetch<{ data: DataProduct }>("/api/data-products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return result.data;
}

export async function updateDataProduct(
  id: string,
  input: UpdateDataProductInput
): Promise<DataProduct> {
  const result = await apiFetch<{ data: DataProduct }>(`/api/data-products/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return result.data;
}

export async function deprecateDataProduct(
  id: string
): Promise<{ data_product_id: string; deprecated_at: string }> {
  const result = await apiFetch<{ data: { data_product_id: string; deprecated_at: string } }>(
    `/api/data-products/${encodeURIComponent(id)}/deprecate`,
    { method: "POST" }
  );
  return result.data;
}

export async function undeprecateDataProduct(
  id: string
): Promise<{ data_product_id: string; deprecated_at: null }> {
  const result = await apiFetch<{ data: { data_product_id: string; deprecated_at: null } }>(
    `/api/data-products/${encodeURIComponent(id)}/deprecate`,
    { method: "DELETE" }
  );
  return result.data;
}

export async function deleteDataProduct(id: string): Promise<void> {
  const res = await fetch(`/api/data-products/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
}
