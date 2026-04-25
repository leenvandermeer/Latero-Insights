"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPipelineRuns } from "@/lib/api";
import { useInstallation } from "@/contexts/installation-context";
import type { PipelineRun } from "@/lib/adapters/types";
import type { ApiResponse } from "@/lib/api";

export function usePipelines(from: string, to: string) {
  const { installation } = useInstallation();
  const installationId = installation?.installation_id ?? null;
  return useQuery<ApiResponse<PipelineRun[]>>({
    queryKey: ["pipelines", from, to, installationId ?? "all"],
    queryFn: () => fetchPipelineRuns({ from, to, installationId }),
    enabled: !!from && !!to,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
