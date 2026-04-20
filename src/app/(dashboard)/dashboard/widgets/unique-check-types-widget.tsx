"use client";

import { useQuality } from "@/hooks";
import { CounterCard, CounterCardSkeleton } from "@/components/ui";
import { Tags } from "lucide-react";

interface Props { from: string; to: string; titleOverride?: string; }

export function UniqueCheckTypesWidget({ from, to, titleOverride }: Props) {
  const { data: response, isLoading, error } = useQuality(from, to);

  if (isLoading) return <CounterCardSkeleton />;
  if (error) return (
    <div className="rounded-xl border bg-card p-6 shadow-sm flex items-center justify-center h-full">
      <p className="text-sm text-muted-foreground">Failed to load</p>
    </div>
  );

  const unique = new Set((response?.data ?? []).map((c) => c.check_id)).size;

  return (
    <CounterCard
      label={titleOverride ?? "Unique Check Types"}
      value={unique}
      icon={<Tags className="h-5 w-5" />}
    />
  );
}
