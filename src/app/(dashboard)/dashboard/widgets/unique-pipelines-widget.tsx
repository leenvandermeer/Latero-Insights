"use client";

import { usePipelines } from "@/hooks";
import { CounterCard, CounterCardSkeleton } from "@/components/ui";
import { GitBranch } from "lucide-react";

interface Props { from: string; to: string; titleOverride?: string; }

export function UniquePipelinesWidget({ from, to, titleOverride }: Props) {
  const { data: response, isLoading, error } = usePipelines(from, to);

  if (isLoading) return <CounterCardSkeleton />;
  if (error) return (
    <div className="rounded-xl border bg-card p-6 shadow-sm flex items-center justify-center h-full">
      <p className="text-sm text-muted-foreground">Failed to load</p>
    </div>
  );

  const unique = new Set((response?.data ?? []).map((r) => r.dataset_id)).size;

  return (
    <CounterCard
      label={titleOverride ?? "Unique Pipelines"}
      value={unique}
      icon={<GitBranch className="h-5 w-5" />}
    />
  );
}
