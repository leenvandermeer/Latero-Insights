"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchEntities, fetchEntityDetail, fetchEntityRuns } from "@/lib/api";
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
    staleTime: 60_000,
    refetchOnMount: "always",
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
