"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "@/lib/api";
import type { ApiHealthResponse } from "@/lib/api";
import { useInstallation } from "@/contexts/installation-context";

export function useHealth() {
  const { installation } = useInstallation();
  const installationId = installation?.installation_id ?? null;
  return useQuery<ApiHealthResponse>({
    queryKey: ["health", installationId],
    queryFn: fetchHealth,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // poll every minute
  });
}
