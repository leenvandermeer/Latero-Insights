"use client";

import { useQuery } from "@tanstack/react-query";
import { useInstallation } from "@/contexts/installation-context";

export interface DatasetsFilter {
  layer?: string;
  q?: string;
}

async function fetchDatasets(filter: DatasetsFilter) {
  const params = new URLSearchParams();
  if (filter.layer) params.set("layer", filter.layer);
  if (filter.q) params.set("q", filter.q);
  const qs = params.toString();
  const res = await fetch(`/api/datasets${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch datasets");
  return res.json();
}

export function useDatasets(filter: DatasetsFilter = {}) {
  const { installation } = useInstallation();
  const installationId = installation?.installation_id ?? null;
  return useQuery({
    queryKey: ["datasets", installationId, filter],
    queryFn: () => fetchDatasets(filter),
    staleTime: 60_000,
    refetchOnMount: "always",
    retry: 1,
  });
}
