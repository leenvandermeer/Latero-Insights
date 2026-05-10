"use client";

import { useQuery } from "@tanstack/react-query";
import { listIncidents } from "@/lib/api/incidents";
import { CounterCard, CounterCardSkeleton } from "@/components/ui";
import { AlertTriangle } from "lucide-react";
import type { WidgetProps } from "../registry";

export function OpenIncidentsWidget({ titleOverride }: WidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["incidents", "open"],
    queryFn: () => listIncidents({ status: "open" }),
    staleTime: 30_000,
  });

  if (isLoading) return <CounterCardSkeleton />;

  const count = data?.length ?? 0;

  return (
    <CounterCard
      label={titleOverride ?? "Open Incidents"}
      value={count}
      icon={<AlertTriangle className="h-5 w-5" />}
    />
  );
}
