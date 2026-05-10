"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchEstateHealth } from "@/lib/api";
import { CounterCard, CounterCardSkeleton } from "@/components/ui";
import { Database } from "lucide-react";
import type { WidgetProps } from "../registry";

export function MonitoredEntitiesWidget({ titleOverride }: WidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["estate-health"],
    queryFn: () => fetchEstateHealth(),
    staleTime: 60_000,
  });

  if (isLoading) return <CounterCardSkeleton />;

  const health = data?.data as { entity_count?: number } | undefined;

  return (
    <CounterCard
      label={titleOverride ?? "Monitored Entities"}
      value={health?.entity_count ?? 0}
      icon={<Database className="h-5 w-5" />}
    />
  );
}
