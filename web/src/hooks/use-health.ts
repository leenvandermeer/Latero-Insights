"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "@/lib/api";
import type { ApiHealthResponse } from "@/lib/api";

export function useHealth() {
  return useQuery<ApiHealthResponse>({
    queryKey: ["health"],
    queryFn: fetchHealth,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // poll every minute
  });
}
