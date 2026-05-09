// Typed client voor Incident Management (WP-106)
// Gebruik altijd via hooks — nooit direct fetch() vanuit components.

const BASE = "/api/incidents";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "in_progress" | "resolved";
export type IncidentSourceType = "alert" | "policy_violation" | "manual";

export interface IncidentStep {
  id: number;
  incident_id: number;
  label: string;
  completed_at: string | null;
  completed_by: string | null;
}

export interface IncidentEvidence {
  id: number;
  incident_id: number;
  evidence_type: string;
  payload: Record<string, unknown>;
  attached_at: string;
}

export interface Incident {
  id: number;
  installation_id: string;
  product_id: string | null;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  assignee: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  source_type: IncidentSourceType | null;
  source_id: string | null;
  /** Only present in list responses */
  step_count?: number;
  steps_completed?: number;
  duration_seconds?: number;
}

export interface IncidentDetail extends Incident {
  steps: IncidentStep[];
  evidence: IncidentEvidence[];
}

export interface ListIncidentsOptions {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  product_id?: string;
}

export interface CreateIncidentInput {
  title: string;
  severity?: IncidentSeverity;
  product_id?: string;
  assignee?: string;
  source_type?: IncidentSourceType;
  source_id?: string;
}

export interface UpdateIncidentInput {
  status?: IncidentStatus;
  assignee?: string;
  severity?: IncidentSeverity;
  title?: string;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

export async function listIncidents(
  options: ListIncidentsOptions = {}
): Promise<Incident[]> {
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.severity) params.set("severity", options.severity);
  if (options.product_id) params.set("product_id", options.product_id);

  const qs = params.size > 0 ? `?${params}` : "";
  const res = await fetch(`${BASE}${qs}`);
  if (!res.ok) throw new Error(`Failed to list incidents: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function getIncident(id: number): Promise<IncidentDetail> {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error(`Failed to get incident ${id}: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function createIncident(
  input: CreateIncidentInput
): Promise<Incident> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create incident: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function updateIncident(
  id: number,
  input: UpdateIncidentInput
): Promise<Incident> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to update incident ${id}: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function addIncidentStep(
  incidentId: number,
  params: { label?: string; step_id?: number; completed_by?: string }
): Promise<IncidentStep> {
  const res = await fetch(`${BASE}/${incidentId}/steps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to add step to incident ${incidentId}: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function addIncidentEvidence(
  incidentId: number,
  evidence_type: string,
  payload: Record<string, unknown>
): Promise<IncidentEvidence> {
  const res = await fetch(`${BASE}/${incidentId}/evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ evidence_type, payload }),
  });
  if (!res.ok) throw new Error(`Failed to add evidence to incident ${incidentId}: ${res.status}`);
  const json = await res.json();
  return json.data;
}
