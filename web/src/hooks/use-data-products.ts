"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useInstallation } from "@/contexts/installation-context";

export interface DataProduct {
  data_product_id: string;
  display_name: string;
  description: string | null;
  owner: string | null;
  domain: string | null;
  sla_tier: "bronze" | "silver" | "gold" | null;
  tags: Record<string, unknown>;
  entity_ids: string[];
  entity_count: number;
  created_at: string;
  updated_at: string;
}

export interface DataProductInput {
  display_name: string;
  description?: string;
  owner?: string;
  domain?: string;
  sla_tier?: "bronze" | "silver" | "gold" | null;
  entity_ids: string[];
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function useDataProducts() {
  const { installation } = useInstallation();
  const installationId = installation?.installation_id ?? null;
  return useQuery({
    queryKey: ["data-products", installationId],
    queryFn: () => apiFetch("/api/data-products"),
    enabled: !!installationId,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useDataProduct(id: string) {
  const { installation } = useInstallation();
  const installationId = installation?.installation_id ?? null;
  return useQuery({
    queryKey: ["data-products", installationId, id],
    queryFn: () => apiFetch(`/api/data-products/${id}`),
    enabled: !!installationId && !!id,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useCreateDataProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DataProductInput) =>
      apiFetch("/api/data-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["data-products"] }),
  });
}

export function useUpdateDataProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<DataProductInput>) =>
      apiFetch(`/api/data-products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["data-products"] }),
  });
}

export function useEstateHealth() {
  const { installation } = useInstallation();
  const installationId = installation?.installation_id ?? null;
  return useQuery({
    queryKey: ["estate-health", installationId],
    queryFn: () => apiFetch("/api/estate-health"),
    enabled: !!installationId,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useDeleteDataProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/data-products/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["data-products"] }),
  });
}
