"use client";

import { useQuery } from "@tanstack/react-query";
import type { LineageHop } from "@/lib/adapters/types";
import type { ApiResponse } from "@/lib/api";

async function fetchCanonicalLineage(): Promise<ApiResponse<LineageHop[]>> {
  const res = await fetch("/api/lineage/canonical");
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export function useCanonicalLineage() {
  return useQuery<ApiResponse<LineageHop[]>>({
    queryKey: ["lineage", "canonical"],
    queryFn: fetchCanonicalLineage,
    staleTime: 10 * 60 * 1000, // canonical data is stable, cache 10 min
    retry: 1,
  });
}
