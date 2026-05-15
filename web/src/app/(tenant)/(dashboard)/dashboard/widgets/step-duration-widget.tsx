"use client";

import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useRuns } from "@/hooks/use-runs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { ChartSkeleton } from "@/components/ui";

interface Props { from: string; to: string; titleOverride?: string; }

export function StepDurationWidget({ from, to, titleOverride }: Props) {
  const { data: response, isLoading, error } = useRuns({ from, to });

  const chartData = useMemo(() => {
    const runs = (response?.data ?? []) as Array<Record<string, unknown>>;
    const byJob = new Map<string, { queue: number; setup: number; exec: number; count: number }>();

    for (const run of runs) {
      const total = run.duration_ms != null ? Number(run.duration_ms) : null;
      if (total == null) continue;
      const key   = String(run.job_name ?? run.dataset_id ?? "unknown");
      const queue = run.queue_duration_ms != null ? Number(run.queue_duration_ms) : 0;
      const setup = run.setup_duration_ms != null ? Number(run.setup_duration_ms) : 0;
      const exec  = Math.max(0, total - queue - setup);
      const existing = byJob.get(key) ?? { queue: 0, setup: 0, exec: 0, count: 0 };
      existing.queue += queue;
      existing.setup += setup;
      existing.exec  += exec;
      existing.count++;
      byJob.set(key, existing);
    }

    return Array.from(byJob.entries())
      .map(([job, { queue, setup, exec, count }]) => ({
        step:  job,
        queue: Math.round(queue / count / 100) / 10,
        setup: Math.round(setup / count / 100) / 10,
        exec:  Math.round(exec  / count / 100) / 10,
      }))
      .sort((a, b) => (b.queue + b.setup + b.exec) - (a.queue + a.setup + a.exec));
  }, [response]);

  const hasBreakdown = chartData.some((d) => d.queue > 0 || d.setup > 0);

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
              {hasBreakdown && <Legend wrapperStyle={{ fontSize: "12px" }} />}
              {hasBreakdown && <Bar dataKey="queue" name="Queue" stackId="a" fill="var(--color-surface-alt, #e2e8f0)" radius={[0, 0, 0, 0]} />}
              {hasBreakdown && <Bar dataKey="setup" name="Setup" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />}
              <Bar
                dataKey="exec"
                name={hasBreakdown ? "Execution" : "Avg Duration"}
                stackId="a"
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
