"use client";

import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { usePipelines } from "@/hooks";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { ChartSkeleton } from "@/components/ui";
import { STATUS_COLORS, normalizeStatus } from "@/lib/chart-colors";
import { latestPipelineStepRunsByDate } from "@/lib/pipeline-runs";

interface Props { from: string; to: string; titleOverride?: string; }

export function PipelineStatusWidget({ from, to, titleOverride }: Props) {
  const { data: response, isLoading, error } = usePipelines(from, to);

  const chartData = useMemo(() => {
    const runs = latestPipelineStepRunsByDate(response?.data ?? []);
    const byDate = new Map<string, { date: string; SUCCESS: number; WARNING: number; FAILED: number }>();
    for (const run of runs) {
      if (!byDate.has(run.event_date)) byDate.set(run.event_date, { date: run.event_date, SUCCESS: 0, WARNING: 0, FAILED: 0 });
      const entry = byDate.get(run.event_date)!;
      const s = normalizeStatus(run.run_status);
      if (s === "SUCCESS") entry.SUCCESS++;
      else if (s === "WARNING") entry.WARNING++;
      else if (s === "FAILED") entry.FAILED++;
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [response]);

  if (isLoading) return <ChartSkeleton className="h-full" />;
  if (error) return (
    <Card className="h-full flex items-center justify-center p-6">
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Failed to load</p>
    </Card>
  );

  return (
    <Card className="h-full flex flex-col">
      <CardHeader><CardTitle>{titleOverride ?? "Run Status Trend"}</CardTitle></CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        {chartData.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--color-text-muted)" }}>No data</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={180}>
            <BarChart data={chartData} barCategoryGap="40%">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "13px" }} />
              <Legend />
              <Bar dataKey="SUCCESS" stackId="a" fill={STATUS_COLORS.SUCCESS} radius={[0, 0, 0, 0]} />
              <Bar dataKey="WARNING" stackId="a" fill={STATUS_COLORS.WARNING} />
              <Bar dataKey="FAILED" stackId="a" fill={STATUS_COLORS.FAILED} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
