"use client";

import { usePipelines } from "@/hooks";
import { CounterCard, CounterCardSkeleton } from "@/components/ui";
import { XCircle } from "lucide-react";
import { latestPipelineStepRuns } from "@/lib/pipeline-runs";

interface Props {
  from: string;
  to: string;
  titleOverride?: string;
}

export function FailedRunsWidget({ from, to, titleOverride }: Props) {
  const { data: response, isLoading, error } = usePipelines(from, to);

  if (isLoading) return <CounterCardSkeleton />;
  if (error) return (
    <div className="rounded-xl border bg-card p-6 shadow-sm flex items-center justify-center h-full">
      <p className="text-sm text-muted-foreground">Failed to load</p>
    </div>
  );

  const failed = latestPipelineStepRuns(response?.data ?? []).filter(
    (r) => ["FAILED", "FAIL", "ERROR"].includes(r.run_status.toUpperCase())
  ).length;

  return (
    <CounterCard
      label={titleOverride ?? "Failed Runs"}
      value={failed}
      icon={<XCircle className="h-5 w-5" />}
    />
  );
}
