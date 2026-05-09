// Typed API client — Policy Engine (WP-301)

export interface PolicyPack {
  id: string;
  installation_id: string;
  name: string;
  description: string | null;
  framework: string | null;
  created_at: string;
}

export interface Policy {
  id: string;
  installation_id: string;
  pack_id: string | null;
  name: string;
  description: string | null;
  rule: Record<string, unknown>;
  scope: Record<string, unknown>;
  action: "warn" | "block" | "notify";
  active: boolean;
  created_at: string;
  fail_count?: number;
  pass_count?: number;
  last_evaluated_at?: string | null;
}

export interface PolicyVerdict {
  policy_id: string;
  product_id: string;
  verdict: "pass" | "fail" | "exception";
  detail: Record<string, unknown> | null;
  evaluated_at: string;
  pack_id?: string | null;
  policy_name?: string;
  action?: string;
}

export interface PolicyException {
  id: number;
  policy_id: string;
  installation_id: string;
  product_id: string;
  justification: string;
  expiry_date: string;
  status: "pending" | "approved" | "declined";
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface ComplianceMatrix {
  verdicts: PolicyVerdict[];
  products: { data_product_id: string; display_name: string; domain: string | null; owner: string | null }[];
  packs: PolicyPack[];
}

export async function listPolicies(): Promise<{ policies: Policy[]; packs: PolicyPack[] }> {
  const res = await fetch("/api/policies");
  if (!res.ok) throw new Error("Failed to load policies");
  const body = await res.json() as { data: { policies: Policy[]; packs: PolicyPack[] } };
  return body.data;
}

export async function getPolicy(id: string): Promise<Policy & { latest_verdicts: PolicyVerdict[] }> {
  const res = await fetch(`/api/policies/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error("Failed to load policy");
  const body = await res.json() as { data: Policy & { latest_verdicts: PolicyVerdict[] } };
  return body.data;
}

export async function createPolicy(data: {
  name: string;
  rule: Record<string, unknown>;
  scope?: Record<string, unknown>;
  action: "warn" | "block" | "notify";
  pack_id?: string;
  description?: string;
  active?: boolean;
}): Promise<Policy> {
  const res = await fetch("/api/policies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create policy");
  const body = await res.json() as { data: Policy };
  return body.data;
}

export async function updatePolicy(
  id: string,
  data: Partial<{
    name: string;
    rule: Record<string, unknown>;
    scope: Record<string, unknown>;
    action: "warn" | "block" | "notify";
    description: string;
    active: boolean;
    pack_id: string | null;
  }>
): Promise<Policy> {
  const res = await fetch(`/api/policies/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update policy");
  const body = await res.json() as { data: Policy };
  return body.data;
}

export async function getComplianceMatrix(): Promise<ComplianceMatrix> {
  const res = await fetch("/api/compliance");
  if (!res.ok) throw new Error("Failed to load compliance matrix");
  const body = await res.json() as { data: ComplianceMatrix };
  return body.data;
}

export async function getProductCompliance(productId: string): Promise<PolicyVerdict[]> {
  const res = await fetch(`/api/compliance/${encodeURIComponent(productId)}`);
  if (!res.ok) throw new Error("Failed to load product compliance");
  const body = await res.json() as { data: PolicyVerdict[] };
  return body.data;
}

export async function submitException(data: {
  policy_id: string;
  product_id: string;
  justification: string;
  expiry_date: string;
}): Promise<PolicyException> {
  const res = await fetch("/api/compliance/exceptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to submit exception");
  const body = await res.json() as { data: PolicyException };
  return body.data;
}

export async function resolveException(
  id: number,
  data: { status: "approved" | "declined"; approved_by?: string }
): Promise<PolicyException> {
  const res = await fetch(`/api/compliance/exceptions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to resolve exception");
  const body = await res.json() as { data: PolicyException };
  return body.data;
}
