// Typed client voor Demand-Side Visibility (WP-205)
// Gebruik altijd via hooks — nooit direct fetch() vanuit components.

const BASE_PRODUCTS = "/api/products";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConsumerType = "team" | "system" | "person";
export type ContractRequestStatus = "pending" | "approved" | "declined";

export interface ProductConsumer {
  consumer_id: string;
  consumer_type: ConsumerType;
  registered_at: string;
  event_count: number;
  last_access_at: string | null;
}

export interface ProductUsageDay {
  day: string;
  event_count: number;
  unique_consumers: number;
}

export interface ContractRequest {
  id: number;
  installation_id: string;
  product_id: string;
  consumer_id: string;
  requirements: Record<string, unknown>;
  status: ContractRequestStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

export async function getProductConsumers(
  productId: string
): Promise<ProductConsumer[]> {
  const res = await fetch(`${BASE_PRODUCTS}/${productId}/consumers`);
  if (!res.ok) throw new Error(`Failed to get product consumers: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function registerConsumer(
  productId: string,
  consumer_id: string,
  consumer_type: ConsumerType
): Promise<void> {
  const res = await fetch(`${BASE_PRODUCTS}/${productId}/consumers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consumer_id, consumer_type }),
  });
  if (!res.ok) throw new Error(`Failed to register consumer: ${res.status}`);
}

export async function getProductUsage(
  productId: string,
  days = 90
): Promise<ProductUsageDay[]> {
  const res = await fetch(`${BASE_PRODUCTS}/${productId}/usage?days=${days}`);
  if (!res.ok) throw new Error(`Failed to get product usage: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function logUsageEvent(
  productId: string,
  consumer_id?: string
): Promise<void> {
  const res = await fetch(`${BASE_PRODUCTS}/${productId}/usage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consumer_id }),
  });
  if (!res.ok) throw new Error(`Failed to log usage event: ${res.status}`);
}

export async function submitContractRequest(
  productId: string,
  consumer_id: string,
  requirements: Record<string, unknown>
): Promise<ContractRequest> {
  const res = await fetch(`${BASE_PRODUCTS}/${productId}/contract-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consumer_id, requirements }),
  });
  if (!res.ok) throw new Error(`Failed to submit contract request: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function resolveContractRequest(
  productId: string,
  reqId: number,
  status: "approved" | "declined"
): Promise<ContractRequest> {
  const res = await fetch(`${BASE_PRODUCTS}/${productId}/contract-requests/${reqId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Failed to resolve contract request: ${res.status}`);
  const json = await res.json();
  return json.data;
}
