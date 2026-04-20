"use client";

import { useQuality } from "@/hooks";
import { CounterCard, CounterCardSkeleton } from "@/components/ui";
import { CheckCircle } from "lucide-react";

interface Props {
  from: string;
  to: string;
  titleOverride?: string;
}

const normalise = (s: string) => s.toUpperCase();

export function PassRateWidget({ from, to, titleOverride }: Props) {
  const { data: response, isLoading, error } = useQuality(from, to);

  if (isLoading) return <CounterCardSkeleton />;
  if (error) return (
    <div className="rounded-xl border bg-card p-6 shadow-sm flex items-center justify-center h-full">
      <p className="text-sm text-muted-foreground">Failed to load</p>
    </div>
  );

  const checks = response?.data ?? [];
  const total = checks.length;
  const passed = checks.filter((c) => ["SUCCESS", "PASS"].includes(normalise(c.check_status))).length;
  const rate = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <CounterCard
      label={titleOverride ?? "DQ Pass Rate"}
      value={`${rate}%`}
      icon={<CheckCircle className="h-5 w-5" />}
    />
  );
}
