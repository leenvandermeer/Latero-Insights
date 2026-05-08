"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchEntities, fetchEntityDetail, fetchEntityRuns, fetchEntityQuality } from "@/lib/api";
import { useInstallation } from "@/contexts/installation-context";

export interface EntitiesFilter {
  product_id?: string;
  status?: string;
  q?: string;
}

export function useEntities(filter: EntitiesFilter = {}) {
  const { installation } = useInstallation();
  const installationId = installation?.installation_id ?? null;
  return useQuery({
    queryKey: ["entities", installationId, filter],
    queryFn: () => fetchEntities(filter),
    enabled: !!installationId,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useEntityDetail(fqn: string | null) {
  return useQuery({
    queryKey: ["entity-detail", fqn],
    queryFn: () => fetchEntityDetail(fqn!),
    enabled: !!fqn,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useEntityRuns(fqn: string | null, limit?: number) {
  return useQuery({
    queryKey: ["entity-runs", fqn, limit],
    queryFn: () => fetchEntityRuns(fqn!, limit),
    enabled: !!fqn,
    staleTime: 0,
    refetchOnMount: "always",
    retry: 1,
  });
}

export function useEntityQuality(fqn: string | null, days = 7) {
  const from = new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0]!;
  const to = new Date().toISOString().split("T")[0]!;
  return useQuery({
    queryKey: ["entity-quality", fqn, from, to],
    queryFn: () => fetchEntityQuality(fqn!, from, to),
    enabled: !!fqn,
    staleTime: 60_000,
    retry: 1,
  });
}
