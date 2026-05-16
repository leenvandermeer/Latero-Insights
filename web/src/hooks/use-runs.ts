"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchRuns, fetchTypedRunDetail } from "@/lib/api";
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

function defaultDateRange() {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  return { from, to };
}

export function useRuns(filter: RunsFilter = {}) {
  const { installation } = useInstallation();
  const installationId = installation?.installation_id ?? null;
  const merged = { ...defaultDateRange(), ...filter };
  return useQuery({
    queryKey: ["runs", installationId, merged],
    queryFn: () => fetchRuns(merged),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export function useRunDetail(runId: string | null) {
  return useQuery({
    queryKey: ["run-detail", runId],
    queryFn: () => fetchTypedRunDetail(runId!),
    enabled: !!runId,
    staleTime: 30_000,
    retry: 1,
  });
}
