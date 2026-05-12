"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useInstallation } from "@/contexts/installation-context";

// ---------------------------------------------------------------------------
// Types — aligned to meta.incidents schema
// ---------------------------------------------------------------------------

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
  title: string;
  product_id: string | null;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved";
  source_type: "manual" | "alert" | "policy_violation" | null;
  source_id: string | null;
  assignee: string | null;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
  step_count: number;
  steps_completed: number;
}

export interface IncidentDetail extends Incident {
  steps: IncidentStep[];
  evidence: IncidentEvidence[];
}

export interface CreateIncidentInput {
  title: string;
  severity?: Incident["severity"];
  source_type?: Incident["source_type"];
  assignee?: string;
  product_id?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useIncidents(params?: {
  status?: string;
  severity?: string;
  product_id?: string;
}) {
  const { installation } = useInstallation();
  const installationId = installation?.installation_id ?? null;
  const sp = new URLSearchParams();
  if (params?.status)     sp.set("status", params.status);
  if (params?.severity)   sp.set("severity", params.severity);
  if (params?.product_id) sp.set("product_id", params.product_id);
  const qs = sp.toString();

  return useQuery({
    queryKey: ["incidents", installationId, params],
    queryFn: () =>
      apiFetch<{ data: Incident[] }>(`/api/incidents${qs ? `?${qs}` : ""}`)
        .then((r) => r.data ?? []),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useIncident(id: number | null) {
  return useQuery({
    queryKey: ["incident", id],
    queryFn: () =>
      apiFetch<{ data: IncidentDetail }>(`/api/incidents/${id}`)
        .then((r) => r.data),
    enabled: id != null,
    staleTime: 15_000,
    retry: 1,
  });
}

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateIncidentInput) =>
      apiFetch<{ data: Incident }>("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents"] }),
  });
}

export function useUpdateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<Pick<Incident, "status" | "severity" | "assignee" | "title">>) =>
      apiFetch<{ data: Incident }>(`/api/incidents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["incident", vars.id] });
    },
  });
}

export function useAddStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ incidentId, label }: { incidentId: number; label: string }) =>
      apiFetch<{ data: IncidentStep }>(`/api/incidents/${incidentId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      }).then((r) => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["incident", vars.incidentId] });
      qc.invalidateQueries({ queryKey: ["incidents"] });
    },
  });
}

export function useAddEvidence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ incidentId, evidence_type, payload }: {
      incidentId: number;
      evidence_type: string;
      payload: Record<string, unknown>;
    }) =>
      apiFetch<{ data: IncidentEvidence }>(`/api/incidents/${incidentId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidence_type, payload }),
      }).then((r) => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["incident", vars.incidentId] });
    },
  });
}
