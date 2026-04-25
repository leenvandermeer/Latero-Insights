"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDataQualityChecks } from "@/lib/api";
import { useInstallation } from "@/contexts/installation-context";
import type { DataQualityCheck } from "@/lib/adapters/types";
import type { ApiResponse } from "@/lib/api";

export function useQuality(from: string, to: string) {
  const { installation } = useInstallation();
  const installationId = installation?.installation_id ?? null;
  return useQuery<ApiResponse<DataQualityCheck[]>>({
    queryKey: ["quality", from, to, installationId ?? "all"],
    queryFn: () => fetchDataQualityChecks({ from, to, installationId }),
    enabled: !!from && !!to,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
