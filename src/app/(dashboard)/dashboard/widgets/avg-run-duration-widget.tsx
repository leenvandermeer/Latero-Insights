"use client";

import { usePipelines } from "@/hooks";
import { CounterCard, CounterCardSkeleton } from "@/components/ui";
import { Timer } from "lucide-react";

interface Props {
  from: string;
  to: string;
  titleOverride?: string;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export function AvgRunDurationWidget({ from, to, titleOverride }: Props) {
  const { data: response, isLoading, error } = usePipelines(from, to);

  if (isLoading) return <CounterCardSkeleton />;
  if (error) return (
    <div className="rounded-xl border bg-card p-6 shadow-sm flex items-center justify-center h-full">
      <p className="text-sm text-muted-foreground">Failed to load</p>
    </div>
  );

  const runs = (response?.data ?? []).filter((r) => r.duration_ms != null);
  const avg = runs.length > 0
    ? runs.reduce((sum, r) => sum + (r.duration_ms ?? 0), 0) / runs.length
    : 0;

  return (
    <CounterCard
      label={titleOverride ?? "Avg Run Duration"}
      value={runs.length > 0 ? formatDuration(avg) : "—"}
      icon={<Timer className="h-5 w-5" />}
    />
  );
}
