"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Incident {
  id: number;
  installation_id: string;
  title: string;
  description: string | null;
  product_id: string | null;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved";
  source_type: string | null;
  source_run_id: string | null;
  assigned_to: string | null;
  opened_at: string;
  resolved_at: string | null;
  created_at: string;
  step_count?: number;
}

export interface CreateIncidentInput {
  title: string;
  description?: string;
  product_id?: string;
  severity?: "low" | "medium" | "high" | "critical";
  source_type?: string;
  source_run_id?: string;
  assigned_to?: string;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export function useIncidents(params?: {
  status?: string;
  severity?: string;
  product_id?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.severity) searchParams.set("severity", params.severity);
  if (params?.product_id) searchParams.set("product_id", params.product_id);
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ["incidents", params],
    queryFn: () =>
      apiFetch<{ data: Incident[] }>(`/api/incidents${qs ? `?${qs}` : ""}`)
        .then((r) => r.data ?? []),
    staleTime: 30_000,
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
    mutationFn: ({ id, ...data }: { id: number } & Partial<Incident>) =>
      apiFetch<{ data: Incident }>(`/api/incidents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents"] }),
  });
}
