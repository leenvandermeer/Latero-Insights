"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchLineageHops } from "@/lib/api";
import type { LineageHop } from "@/lib/adapters/types";
import type { ApiResponse } from "@/lib/api";

export function useLineage(from: string, to: string) {
  return useQuery<ApiResponse<LineageHop[]>>({
    queryKey: ["lineage", from, to],
    queryFn: () => fetchLineageHops({ from, to }),
    enabled: !!from && !!to,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
