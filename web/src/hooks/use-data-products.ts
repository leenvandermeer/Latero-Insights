"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDataProducts, fetchEstateHealth } from "@/lib/api";
import { useInstallation } from "@/contexts/installation-context";

export function useDataProducts() {
  const { installation } = useInstallation();
  const installationId = installation?.installation_id ?? null;
  return useQuery({
    queryKey: ["data-products", installationId],
    queryFn: () => fetchDataProducts(),
    staleTime: 60_000,
    refetchOnMount: "always",
    retry: 1,
  });
}

export function useEstateHealth() {
  const { installation } = useInstallation();
  const installationId = installation?.installation_id ?? null;
  return useQuery({
    queryKey: ["estate-health", installationId],
    queryFn: () => fetchEstateHealth(),
    staleTime: 30_000,
    refetchOnMount: "always",
    retry: 1,
  });
}
