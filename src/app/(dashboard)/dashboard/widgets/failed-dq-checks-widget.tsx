"use client";

import { useQuality } from "@/hooks";
import { CounterCard, CounterCardSkeleton } from "@/components/ui";
import { ShieldAlert } from "lucide-react";
import { normalizeStatus } from "@/lib/chart-colors";

interface Props {
  from: string;
  to: string;
  titleOverride?: string;
}

export function FailedDqChecksWidget({ from, to, titleOverride }: Props) {
  const { data: response, isLoading, error } = useQuality(from, to);

  if (isLoading) return <CounterCardSkeleton />;
  if (error) return (
    <div className="rounded-xl border bg-card p-6 shadow-sm flex items-center justify-center h-full">
      <p className="text-sm text-muted-foreground">Failed to load</p>
    </div>
  );

  const failed = (response?.data ?? []).filter(
    (c) => normalizeStatus(c.check_status) === "FAILED"
  ).length;

  return (
    <CounterCard
      label={titleOverride ?? "Failed DQ Checks"}
      value={failed}
      icon={<ShieldAlert className="h-5 w-5" />}
    />
  );
}
