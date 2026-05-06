"use client";

import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { usePipelines } from "@/hooks";
import { Card, CardHeader, CardTitle, CardContent, ChartSkeleton } from "@/components/ui";
import { STATUS_COLORS, normalizeStatus } from "@/lib/chart-colors";
import { latestPipelineStepRuns } from "@/lib/pipeline-runs";

interface Props { from: string; to: string; titleOverride?: string; }

const TOP_N = 10;

export function RunsByPipelineWidget({ from, to, titleOverride }: Props) {
  const { data: response, isLoading, error } = usePipelines(from, to);

  const chartData = useMemo(() => {
    const counts = new Map<string, { total: number; failed: number }>();
    for (const run of latestPipelineStepRuns(response?.data ?? [])) {
      const key = run.dataset_id;
      const entry = counts.get(key) ?? { total: 0, failed: 0 };
      entry.total++;
      if (normalizeStatus(run.run_status) === "FAILED") entry.failed++;
      counts.set(key, entry);
    }
    return Array.from(counts.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, TOP_N);
  }, [response]);

  if (isLoading) return <ChartSkeleton className="h-full" />;
  if (error) return (
    <Card className="h-full flex items-center justify-center p-6">
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Failed to load</p>
    </Card>
  );

  return (
    <Card className="h-full flex flex-col">
      <CardHeader><CardTitle>{titleOverride ?? "Runs by Pipeline"}</CardTitle></CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No data</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 17) + "…" : v}
              />
              <Tooltip
                contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: "var(--color-sidebar-hover)" }}
              />
              <Bar dataKey="total" name="Total runs" radius={[0, 4, 4, 0]}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.failed > 0 ? STATUS_COLORS.FAILED : STATUS_COLORS.SUCCESS}
                    fillOpacity={entry.failed > 0 ? 1 : 0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
