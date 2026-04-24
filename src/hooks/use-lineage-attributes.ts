"use client";

import { useQuery } from "@tanstack/react-query";
import type { LineageAttribute } from "@/lib/adapters/types";
import { fetchLineageAttributes, type ApiResponse } from "@/lib/api";

export function useLineageAttributes() {
  return useQuery<ApiResponse<LineageAttribute[]>>({
    queryKey: ["lineage", "attributes", "current-only"],
    queryFn: fetchLineageAttributes,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
