"use client";

import { useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { useQuality } from "@/hooks";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { ChartSkeleton } from "@/components/ui";
import { STATUS_COLORS, normalizeStatus } from "@/lib/chart-colors";

interface Props { from: string; to: string; titleOverride?: string; }

export function DqTrendWidget({ from, to, titleOverride }: Props) {
  const [target, setTarget] = useState(95);
  const { data: response, isLoading, error } = useQuality(from, to);

  const chartData = useMemo(() => {
    const checks = response?.data ?? [];
    const byDate = new Map<string, { total: number; passed: number }>();
    for (const check of checks) {
      const entry = byDate.get(check.event_date) ?? { total: 0, passed: 0 };
      entry.total++;
      if (normalizeStatus(check.check_status) === "SUCCESS") entry.passed++;
      byDate.set(check.event_date, entry);
    }
    return Array.from(byDate.entries())
      .map(([date, { total, passed }]) => ({ date, passRate: Math.round((passed / total) * 100) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [response]);

  if (isLoading) return <ChartSkeleton className="h-full" />;
  if (error) return (
    <Card className="h-full flex items-center justify-center p-6">
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Failed to load</p>
    </Card>
  );

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle>{titleOverride ?? "DQ Pass Rate Trend"}</CardTitle>
        <label className="flex items-center gap-1.5 text-xs shrink-0" style={{ color: "var(--color-text-muted)" }}>
          Target
          <input
            type="number"
            min={0}
            max={100}
            value={target}
            onChange={(e) => setTarget(Math.max(0, Math.min(100, Number(e.target.value))))}
            className="w-12 rounded px-1.5 py-0.5 text-xs text-center outline-none"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          />
          %
        </label>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        {chartData.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--color-text-muted)" }}>No data</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "13px" }}
                formatter={(value: number) => [`${value}%`, "Pass Rate"]}
              />
              <ReferenceLine y={target} stroke={STATUS_COLORS.WARNING} strokeDasharray="5 5" label={{ value: `Target ${target}%`, position: "insideTopRight", fontSize: 11 }} />
              <Line type="monotone" dataKey="passRate" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
