"use client";

import { useQuery } from "@tanstack/react-query";
import { useInstallation } from "@/contexts/installation-context";
import type { LineageAttribute } from "@/lib/adapters/types";
import { fetchLineageAttributes, type ApiResponse } from "@/lib/api";

export function useLineageAttributes() {
  const { installation } = useInstallation();
  const installationId = installation?.installation_id ?? null;
  return useQuery<ApiResponse<LineageAttribute[]>>({
    queryKey: ["lineage", "attributes", installationId ?? "all"],
    queryFn: () => fetchLineageAttributes(installationId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
