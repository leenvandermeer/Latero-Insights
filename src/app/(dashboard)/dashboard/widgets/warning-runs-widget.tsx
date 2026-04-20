"use client";

import { usePipelines } from "@/hooks";
import { CounterCard, CounterCardSkeleton } from "@/components/ui";
import { AlertTriangle } from "lucide-react";

interface Props {
  from: string;
  to: string;
  titleOverride?: string;
}

export function WarningRunsWidget({ from, to, titleOverride }: Props) {
  const { data: response, isLoading, error } = usePipelines(from, to);

  if (isLoading) return <CounterCardSkeleton />;
  if (error) return (
    <div className="rounded-xl border bg-card p-6 shadow-sm flex items-center justify-center h-full">
      <p className="text-sm text-muted-foreground">Failed to load</p>
    </div>
  );

  const warnings = (response?.data ?? []).filter(
    (r) => r.run_status.toUpperCase() === "WARNING"
  ).length;

  return (
    <CounterCard
      label={titleOverride ?? "Warning Runs"}
      value={warnings}
      icon={<AlertTriangle className="h-5 w-5" />}
    />
  );
}
