"use client";

import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useQuality } from "@/hooks";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { ChartSkeleton } from "@/components/ui";
import { STATUS_COLORS, normalizeStatus } from "@/lib/chart-colors";

interface Props { from: string; to: string; titleOverride?: string; }

export function SeverityCategoryWidget({ from, to, titleOverride }: Props) {
  const { data: response, isLoading, error } = useQuality(from, to);

  const chartData = useMemo(() => {
    const checks = response?.data ?? [];
    const byCategory = new Map<string, { SUCCESS: number; WARNING: number; FAILED: number }>();
    for (const check of checks) {
      const cat = check.check_category ?? "unknown";
      const entry = byCategory.get(cat) ?? { SUCCESS: 0, WARNING: 0, FAILED: 0 };
      const s = normalizeStatus(check.check_status);
      if (s === "SUCCESS") entry.SUCCESS++;
      else if (s === "WARNING") entry.WARNING++;
      else if (s === "FAILED") entry.FAILED++;
      byCategory.set(cat, entry);
    }
    return Array.from(byCategory.entries())
      .map(([category, counts]) => ({ category, ...counts }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [response]);

  if (isLoading) return <ChartSkeleton className="h-full" />;
  if (error) return (
    <Card className="h-full flex items-center justify-center p-6">
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Failed to load</p>
    </Card>
  );

  return (
    <Card className="h-full flex flex-col">
      <CardHeader><CardTitle>{titleOverride ?? "Results by Category"}</CardTitle></CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        {chartData.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--color-text-muted)" }}>No data</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={180}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="category" tick={{ fontSize: 12 }} />
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
