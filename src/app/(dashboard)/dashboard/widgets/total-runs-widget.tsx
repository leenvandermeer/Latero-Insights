"use client";

import { usePipelines } from "@/hooks";
import { CounterCard, CounterCardSkeleton } from "@/components/ui";
import { Activity } from "lucide-react";
import { latestPipelineStepRuns } from "@/lib/pipeline-runs";

interface Props {
  from: string;
  to: string;
  titleOverride?: string;
}

export function TotalRunsWidget({ from, to, titleOverride }: Props) {
  const { data: response, isLoading, error } = usePipelines(from, to);

  if (isLoading) return <CounterCardSkeleton />;
  if (error) return (
    <div className="rounded-xl border bg-card p-6 shadow-sm flex items-center justify-center h-full">
      <p className="text-sm text-muted-foreground">Failed to load</p>
    </div>
  );

  const total = latestPipelineStepRuns(response?.data ?? []).length;

  return (
    <CounterCard
      label={titleOverride ?? "Total Runs"}
      value={total}
      icon={<Activity className="h-5 w-5" />}
    />
  );
}
