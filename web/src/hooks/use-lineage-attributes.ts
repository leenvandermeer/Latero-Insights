"use client";

import { useQuery } from "@tanstack/react-query";
import { useInstallation } from "@/contexts/installation-context";
import type { LineageAttribute } from "@/lib/adapters/types";
import { fetchLineageAttributes, type ApiResponse } from "@/lib/api";

export function useLineageAttributes(asOf?: string | null) {
  const { installation } = useInstallation();
  const installationId = installation?.installation_id ?? null;
  return useQuery<ApiResponse<LineageAttribute[]>>({
    queryKey: ["lineage", "attributes", installationId ?? "all", asOf ?? "current"],
    queryFn: () => fetchLineageAttributes(installationId, asOf),
    staleTime: asOf ? 5 * 60 * 1000 : 0, // historical snapshots can be cached longer
    refetchOnMount: asOf ? false : "always",
    refetchOnWindowFocus: !asOf,
    retry: 1,
  });
}
