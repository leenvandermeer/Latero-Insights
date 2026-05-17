"use client";

import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useRuns } from "@/hooks/use-runs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { ChartSkeleton } from "@/components/ui";
import type { RunSummary } from "@/types/v2";

interface Props { from: string; to: string; titleOverride?: string; }

export function StepDurationWidget({ from, to, titleOverride }: Props) {
  const { data: response, isLoading, error } = useRuns({ from, to });

  const chartData = useMemo(() => {
    const runs = (response?.data ?? []) as RunSummary[];
    const byTask = new Map<string, { total: number; count: number }>();

    for (const run of runs) {
      const total = run.duration_ms != null ? Number(run.duration_ms) : null;
      if (total == null) continue;
      const key = String(run.task_name ?? run.job_name ?? run.dataset_id ?? "unknown");
      const existing = byTask.get(key) ?? { total: 0, count: 0 };
      existing.total += total;
      existing.count++;
      byTask.set(key, existing);
    }

    return Array.from(byTask.entries())
      .map(([task, { total, count }]) => ({
        step: task,
        duration: Math.round(total / count / 100) / 10,
      }))
      .sort((a, b) => b.duration - a.duration);
  }, [response]);

  if (isLoading) return <ChartSkeleton className="h-full" />;
  if (error) return (
    <Card className="h-full flex items-center justify-center p-6">
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Failed to load</p>
    </Card>
  );

  return (
    <Card className="h-full flex flex-col">
      <CardHeader><CardTitle>{titleOverride ?? "Avg Duration by Job"}</CardTitle></CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        {chartData.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--color-text-muted)" }}>No duration data</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={180}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tick={{ fontSize: 12 }} unit="s" />
              <YAxis type="category" dataKey="step" tick={{ fontSize: 12 }} width={120} />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "13px" }}
                formatter={(value: number, name: string) => [`${value}s`, name.charAt(0).toUpperCase() + name.slice(1)]}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar
                dataKey="duration"
                name="Avg Duration"
                fill="var(--color-primary)"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
