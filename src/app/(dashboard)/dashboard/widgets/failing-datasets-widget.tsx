"use client";

import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { useQuality } from "@/hooks";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { ChartSkeleton } from "@/components/ui";
import { normalizeStatus } from "@/lib/chart-colors";
import type { WidgetProps } from "../registry";

const TOP_N = 10;

export function FailingDatasetsWidget({ from, to, titleOverride }: WidgetProps) {
  const { data: response, isLoading, error } = useQuality(from, to);

  const chartData = useMemo(() => {
    const checks = response?.data ?? [];
    const byDataset = new Map<string, { total: number; failed: number }>();
    for (const check of checks) {
      const entry = byDataset.get(check.dataset_id) ?? { total: 0, failed: 0 };
      entry.total++;
      if (normalizeStatus(check.check_status) === "FAILED") entry.failed++;
      byDataset.set(check.dataset_id, entry);
    }
    return [...byDataset.entries()]
      .map(([id, { total, failed }]) => ({
        id,
        failRate: total > 0 ? Math.round((failed / total) * 100) : 0,
        failed,
        total,
      }))
      .filter((d) => d.failed > 0)
      .sort((a, b) => b.failRate - a.failRate || b.failed - a.failed)
      .slice(0, TOP_N)
      .map((d) => ({ ...d, label: d.id.length > 20 ? `${d.id.slice(0, 18)}…` : d.id }));
  }, [response]);

  if (isLoading) return <ChartSkeleton className="h-full" />;
  if (error) return (
    <Card className="h-full flex items-center justify-center p-6">
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Failed to load</p>
    </Card>
  );

  return (
    <Card className="h-full flex flex-col">
      <CardHeader><CardTitle>{titleOverride ?? "Failing Datasets"}</CardTitle></CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        {chartData.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--color-text-muted)" }}>No DQ failures in selected period</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={180}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 40 }}>
              <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
                formatter={(value: number, _: string, props: { payload?: { failed: number; total: number } }) => [
                  `${value}% (${props.payload?.failed ?? 0} / ${props.payload?.total ?? 0})`,
                  "Failure rate",
                ]}
                labelFormatter={(label: string) => label}
              />
              <Bar dataKey="failRate" radius={[0, 4, 4, 0]} maxBarSize={20}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={`rgba(239,68,68,${0.9 - i * 0.06})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
