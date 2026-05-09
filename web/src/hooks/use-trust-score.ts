"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface TrustFactor {
  id: string;
  label: string;
  weight: number;
  delta: number;
  passed: boolean;
  link?: string;
}

export interface TrustScore {
  product_id: string;
  installation_id: string;
  score: number;
  factors: TrustFactor[];
  calculated_at: string;
}

export interface TrustScoreHistory {
  score: number;
  calculated_at: string;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export function useTrustScore(productId: string | null, asOf?: string) {
  return useQuery({
    queryKey: ["trust-score", productId, asOf],
    queryFn: () => {
      const params = asOf ? `?as_of=${encodeURIComponent(asOf)}` : "";
      return apiFetch<{ data: TrustScore }>(`/api/products/${encodeURIComponent(productId!)}/trust${params}`)
        .then((r) => r.data ?? null);
    },
    enabled: !!productId,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useTrustScoreHistory(productId: string | null, limit = 30) {
  return useQuery({
    queryKey: ["trust-score-history", productId, limit],
    queryFn: () =>
      apiFetch<{ data: TrustScoreHistory[] }>(
        `/api/products/${encodeURIComponent(productId!)}/trust/history?limit=${limit}`
      ).then((r) => r.data ?? []),
    enabled: !!productId,
    staleTime: 10 * 60_000,
    retry: 1,
  });
}

export function useRefreshTrustScore(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/products/${encodeURIComponent(productId)}/trust?refresh=true`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to refresh trust score");
      return (res.json() as Promise<{ data: TrustScore }>).then((r) => r.data);
    },
    onSuccess: (data) => {
      qc.setQueriesData({ queryKey: ["trust-score", productId] }, data);
      void qc.invalidateQueries({ queryKey: ["trust-score-history", productId] });
    },
  });
}
