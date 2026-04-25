"use client";

import { useQuery } from "@tanstack/react-query";
import { useInstallation } from "@/contexts/installation-context";
import type { LineageEntity } from "@/lib/adapters/types";
import { fetchLineageEntities, type ApiResponse } from "@/lib/api";

export function useLineageEntities() {
  const { installationId } = useInstallation();
  return useQuery<ApiResponse<LineageEntity[]>>({
    queryKey: ["lineage", "entities", installationId ?? "all"],
    queryFn: () => fetchLineageEntities(installationId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
