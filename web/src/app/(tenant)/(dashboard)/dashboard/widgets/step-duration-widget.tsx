"use client";

import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { usePipelines } from "@/hooks";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { ChartSkeleton } from "@/components/ui";

interface Props { from: string; to: string; titleOverride?: string; }

export function StepDurationWidget({ from, to, titleOverride }: Props) {
  const { data: response, isLoading, error } = usePipelines(from, to);

  const chartData = useMemo(() => {
    const runs = response?.data ?? [];
    const byJob = new Map<string, { total: number; count: number }>();
    for (const run of runs) {
      if (run.duration_ms == null) continue;
      const key = run.job_name ?? run.dataset_id ?? "unknown";
      const existing = byJob.get(key) ?? { total: 0, count: 0 };
      existing.total += run.duration_ms;
      existing.count++;
      byJob.set(key, existing);
    }
    return Array.from(byJob.entries())
      .map(([job, { total, count }]) => ({ step: job, avgDuration: Math.round(total / count / 100) / 10 }))
      .sort((a, b) => b.avgDuration - a.avgDuration);
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
                formatter={(value: number) => [`${value}s`, "Avg Duration"]}
              />
              <Bar dataKey="avgDuration" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
