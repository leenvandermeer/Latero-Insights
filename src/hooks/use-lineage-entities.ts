"use client";

import { useQuery } from "@tanstack/react-query";
import type { LineageEntity } from "@/lib/adapters/types";
import type { ApiResponse } from "@/lib/api";

async function fetchLineageEntities(): Promise<ApiResponse<LineageEntity[]>> {
  const res = await fetch("/api/lineage/entities");
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export function useLineageEntities() {
  return useQuery<ApiResponse<LineageEntity[]>>({
    queryKey: ["lineage", "entities"],
    queryFn: fetchLineageEntities,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
