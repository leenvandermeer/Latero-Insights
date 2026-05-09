// Typed client voor Business Impact Graph (WP-201)
// Gebruik altijd via hooks — nooit direct fetch() vanuit components.

const BASE_OUTPUTS = "/api/business-outputs";
const BASE_PRODUCTS = "/api/products";
const BASE_LINEAGE = "/api/lineage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BusinessOutputType = "kpi" | "dashboard" | "process" | "report" | "risk";
export type BusinessOutputCriticality = "low" | "medium" | "high" | "critical";

export interface BusinessOutput {
  id: string;
  installation_id: string;
  name: string;
  output_type: BusinessOutputType;
  owner_team: string | null;
  criticality: BusinessOutputCriticality;
  description: string | null;
  /** Only in list responses */
  linked_product_count?: number;
  /** Only in product-scoped responses */
  link_description?: string | null;
  /** Only in impact responses */
  via_product_id?: string;
  min_depth?: number;
}

export interface CreateBusinessOutputInput {
  name: string;
  output_type: BusinessOutputType;
  owner_team?: string;
  criticality?: BusinessOutputCriticality;
  description?: string;
}

export interface ListBusinessOutputsOptions {
  output_type?: BusinessOutputType;
  criticality?: BusinessOutputCriticality;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

export async function listBusinessOutputs(
  options: ListBusinessOutputsOptions = {}
): Promise<BusinessOutput[]> {
  const params = new URLSearchParams();
  if (options.output_type) params.set("output_type", options.output_type);
  if (options.criticality) params.set("criticality", options.criticality);

  const qs = params.size > 0 ? `?${params}` : "";
  const res = await fetch(`${BASE_OUTPUTS}${qs}`);
  if (!res.ok) throw new Error(`Failed to list business outputs: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function createBusinessOutput(
  input: CreateBusinessOutputInput
): Promise<BusinessOutput> {
  const res = await fetch(BASE_OUTPUTS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create business output: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function getProductBusinessOutputs(
  productId: string
): Promise<BusinessOutput[]> {
  const res = await fetch(`${BASE_PRODUCTS}/${productId}/business-outputs`);
  if (!res.ok) throw new Error(`Failed to get product business outputs: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function linkBusinessOutput(
  productId: string,
  output_id: string,
  description?: string
): Promise<void> {
  const res = await fetch(`${BASE_PRODUCTS}/${productId}/business-outputs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ output_id, description }),
  });
  if (!res.ok) throw new Error(`Failed to link business output: ${res.status}`);
}

export async function unlinkBusinessOutput(
  productId: string,
  outputId: string
): Promise<void> {
  const res = await fetch(`${BASE_PRODUCTS}/${productId}/business-outputs/${outputId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404)
    throw new Error(`Failed to unlink business output: ${res.status}`);
}

export async function getEntityImpact(
  entityFqn: string
): Promise<BusinessOutput[]> {
  const res = await fetch(`${BASE_LINEAGE}/${encodeURIComponent(entityFqn)}/impact`);
  if (!res.ok) throw new Error(`Failed to get entity impact: ${res.status}`);
  const json = await res.json();
  return json.data;
}
