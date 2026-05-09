// Typed client voor Business Glossary (WP-207)
// Gebruik altijd via hooks — nooit direct fetch() vanuit components.

const BASE = "/api/glossary";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GlossaryTerm {
  id: string;
  installation_id: string;
  name: string;
  definition: string;
  owner_team: string | null;
  valid_from: string;
  /** Only in list responses */
  linked_dataset_count?: number;
}

export interface GlossaryTermDetail extends GlossaryTerm {
  dataset_links: GlossaryDatasetLink[];
}

export interface GlossaryDatasetLink {
  dataset_id: string;
  column_name: string | null;
  dataset_fqn: string | null;
}

export interface GlossaryConflict {
  normalized_name: string;
  terms: GlossaryTerm[];
}

export interface CreateGlossaryTermInput {
  name: string;
  definition: string;
  owner_team?: string;
}

export interface UpdateGlossaryTermInput {
  name?: string;
  definition?: string;
  owner_team?: string | null;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

export async function listGlossaryTerms(q?: string): Promise<GlossaryTerm[]> {
  const params = new URLSearchParams();
  if (q?.trim()) params.set("q", q.trim());
  const qs = params.size > 0 ? `?${params}` : "";
  const res = await fetch(`${BASE}${qs}`);
  if (!res.ok) throw new Error(`Failed to list glossary terms: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function getGlossaryTerm(id: string): Promise<GlossaryTermDetail> {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error(`Failed to get glossary term ${id}: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function createGlossaryTerm(
  input: CreateGlossaryTermInput
): Promise<GlossaryTerm> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create glossary term: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function updateGlossaryTerm(
  id: string,
  input: UpdateGlossaryTermInput
): Promise<GlossaryTerm> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to update glossary term ${id}: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function deleteGlossaryTerm(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404)
    throw new Error(`Failed to delete glossary term ${id}: ${res.status}`);
}

export async function getGlossaryConflicts(): Promise<GlossaryConflict[]> {
  const res = await fetch(`${BASE}/conflicts`);
  if (!res.ok) throw new Error(`Failed to get glossary conflicts: ${res.status}`);
  const json = await res.json();
  return json.data;
}
