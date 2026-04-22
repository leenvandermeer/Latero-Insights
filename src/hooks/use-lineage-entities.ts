"use client";

import { useQuery } from "@tanstack/react-query";
import type { LineageEntity } from "@/lib/adapters/types";
import { fetchLineageEntities, type ApiResponse } from "@/lib/api";

export function useLineageEntities() {
  return useQuery<ApiResponse<LineageEntity[]>>({
    queryKey: ["lineage", "entities", "connected-layout"],
    queryFn: fetchLineageEntities,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
