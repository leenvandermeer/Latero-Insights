"use client";

import { useQuery } from "@tanstack/react-query";
import type { LineageHop } from "@/lib/adapters/types";
import { fetchCanonicalLineage, type ApiResponse } from "@/lib/api";

export function useCanonicalLineage() {
  return useQuery<ApiResponse<LineageHop[]>>({
    queryKey: ["lineage", "canonical"],
    queryFn: fetchCanonicalLineage,
    staleTime: 10 * 60 * 1000, // canonical data is stable, cache 10 min
    retry: 1,
  });
}
