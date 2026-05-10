"use client";

import { useMemo } from "react";
import { usePipelines } from "@/hooks";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { latestPipelineStepRuns } from "@/lib/pipeline-runs";
import type { WidgetProps } from "../registry";

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  SUCCESS: { bg: "rgba(34,197,94,0.12)",   text: "#16a34a" },
  WARNING: { bg: "rgba(234,179,8,0.12)",   text: "#ca8a04" },
  FAILED:  { bg: "rgba(239,68,68,0.12)",   text: "#dc2626" },
};

function statusStyle(s: string) {
  return STATUS_STYLE[s.toUpperCase()] ?? { bg: "rgba(100,116,139,0.12)", text: "var(--color-text-muted)" };
}

function fmtDate(ts: string): string {
  try {
    return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

function fmtDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

export function PipelineHealthTableWidget({ from, to, titleOverride }: WidgetProps) {
  const { data: response, isLoading, error } = usePipelines(from, to);

  const rows = useMemo(() => {
    const runs = latestPipelineStepRuns(response?.data ?? []);
    // Group by pipeline name (dataset_id), keep only the latest run per pipeline
    const byPipeline = new Map<string, typeof runs[number]>();
    for (const run of [...runs].sort((a, b) => b.timestamp_utc.localeCompare(a.timestamp_utc))) {
      if (!byPipeline.has(run.dataset_id)) {
        byPipeline.set(run.dataset_id, run);
      }
    }
    return [...byPipeline.values()].sort((a, b) => b.timestamp_utc.localeCompare(a.timestamp_utc));
  }, [response]);

  if (isLoading) return <TableSkeleton rows={6} />;
  if (error) return (
    <Card className="h-full flex items-center justify-center p-6">
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Failed to load</p>
    </Card>
  );

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <div
        className="flex items-center gap-3 px-5 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          {titleOverride ?? "Pipeline Health"}
        </p>
        <span className="ml-auto text-xs" style={{ color: "var(--color-text-muted)" }}>
          {rows.length} pipeline{rows.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No pipeline runs in this period</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                {["Pipeline", "Status", "Duration", "Last Run"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((run) => {
                const st = statusStyle(run.run_status);
                const label = (run.job_name ?? run.dataset_id).replace(/_/g, " ");
                return (
                  <tr key={run.run_id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td className="px-4 py-2.5 max-w-[200px] truncate font-medium" style={{ color: "var(--color-text)" }} title={label}>{label}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium capitalize" style={{ background: st.bg, color: st.text }}>{run.run_status}</span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-xs" style={{ color: "var(--color-text-muted)" }}>{fmtDuration(run.duration_ms)}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--color-text-muted)" }}>{fmtDate(run.timestamp_utc)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
