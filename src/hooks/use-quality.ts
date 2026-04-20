"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDataQualityChecks } from "@/lib/api";
import type { DataQualityCheck } from "@/lib/adapters/types";
import type { ApiResponse } from "@/lib/api";

export function useQuality(from: string, to: string) {
  return useQuery<ApiResponse<DataQualityCheck[]>>({
    queryKey: ["quality", from, to],
    queryFn: () => fetchDataQualityChecks({ from, to }),
    enabled: !!from && !!to,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
