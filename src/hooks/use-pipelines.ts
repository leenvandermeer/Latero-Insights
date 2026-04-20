"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPipelineRuns } from "@/lib/api";
import type { PipelineRun } from "@/lib/adapters/types";
import type { ApiResponse } from "@/lib/api";

export function usePipelines(from: string, to: string) {
  return useQuery<ApiResponse<PipelineRun[]>>({
    queryKey: ["pipelines", from, to],
    queryFn: () => fetchPipelineRuns({ from, to }),
    enabled: !!from && !!to,
    staleTime: 5 * 60 * 1000, // 5 minutes — server cache handles longer TTL
    retry: 1,
  });
}
