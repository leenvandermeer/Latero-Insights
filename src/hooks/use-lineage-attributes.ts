"use client";

import { useQuery } from "@tanstack/react-query";
import type { LineageAttribute } from "@/lib/adapters/types";
import type { ApiResponse } from "@/lib/api";

async function fetchLineageAttributes(): Promise<ApiResponse<LineageAttribute[]>> {
  const res = await fetch("/api/lineage/attributes");
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export function useLineageAttributes() {
  return useQuery<ApiResponse<LineageAttribute[]>>({
    queryKey: ["lineage", "attributes"],
    queryFn: fetchLineageAttributes,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}
