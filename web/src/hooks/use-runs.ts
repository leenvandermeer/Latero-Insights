"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchRuns, fetchRunDetail } from "@/lib/api";
import { useInstallation } from "@/contexts/installation-context";

export interface RunsFilter {
  from?: string;
  to?: string;
  status?: string;
  step?: string;
  product_id?: string;
  entity?: string;
  cursor?: string;
  limit?: number;
}

export function useRuns(filter: RunsFilter = {}) {
  const { installation } = useInstallation();
  const installationId = installation?.installation_id ?? null;
  return useQuery({
    queryKey: ["runs", installationId, filter],
    queryFn: () => fetchRuns(filter),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export function useRunDetail(runId: string | null) {
  return useQuery({
    queryKey: ["run-detail", runId],
    queryFn: () => fetchRunDetail(runId!),
    enabled: !!runId,
    staleTime: 30_000,
    retry: 1,
  });
}
