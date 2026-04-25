"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchLineageHops } from "@/lib/api";
import { useInstallation } from "@/contexts/installation-context";
import type { LineageHop } from "@/lib/adapters/types";
import type { ApiResponse } from "@/lib/api";

export function useLineage(from: string, to: string) {
  const { installationId } = useInstallation();
  return useQuery<ApiResponse<LineageHop[]>>({
    queryKey: ["lineage", from, to, installationId ?? "all"],
    queryFn: () => fetchLineageHops({ from, to, installationId }),
    enabled: !!from && !!to,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
