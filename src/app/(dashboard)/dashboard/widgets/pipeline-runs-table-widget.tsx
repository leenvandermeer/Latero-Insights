"use client";

import { useState } from "react";
import { usePipelines } from "@/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { latestPipelineStepRuns } from "@/lib/pipeline-runs";
import { X } from "lucide-react";
import type { PipelineRun } from "@/lib/adapters/types";

interface Props {
  from: string;
  to: string;
  titleOverride?: string;
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  SUCCESS: { bg: "rgba(34,197,94,0.12)", text: "#16a34a" },
  WARNING: { bg: "rgba(234,179,8,0.12)",  text: "#ca8a04" },
  FAILED:  { bg: "rgba(239,68,68,0.12)",  text: "#dc2626" },
};

function statusStyle(s: string) {
  return STATUS_STYLE[s.toUpperCase()] ?? { bg: "rgba(100,116,139,0.12)", text: "var(--color-text-muted)" };
}

function fmtDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function fmtTs(ts: string): string {
  try {
    return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

export function PipelineRunsTableWidget({ from, to, titleOverride }: Props) {
  const { data: response, isLoading, error } = usePipelines(from, to);
  const [selectedRun, setSelectedRun] = useState<PipelineRun | null>(null);
  const [envFilter, setEnvFilter] = useState<string>("__all__");

  if (isLoading) return <TableSkeleton rows={8} />;
  if (error) return (
    <Card className="h-full flex items-center justify-center">
      <CardContent><p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Failed to load</p></CardContent>
    </Card>
  );

  const allRuns = latestPipelineStepRuns(response?.data ?? [])
    .sort((a, b) => b.timestamp_utc.localeCompare(a.timestamp_utc));

  const environments = [...new Set(allRuns.map((r) => r.environment).filter(Boolean) as string[])].sort();
  const runs = envFilter === "__all__" ? allRuns : allRuns.filter((r) => r.environment === envFilter);

  return (
    <Card className="relative h-full flex flex-col overflow-hidden">
      <div
        className="flex items-center justify-between gap-3 px-5 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          {titleOverride ?? "Recent Pipeline Runs"}
        </p>
        <div className="flex items-center gap-2">
          {environments.length > 0 && (
            <select
              value={envFilter}
              onChange={(e) => setEnvFilter(e.target.value)}
              className="text-xs rounded-md px-2 py-1 outline-none"
              style={{ background: "var(--color-surface)", border: `1px solid ${envFilter !== "__all__" ? "var(--color-accent)" : "var(--color-border)"}`, color: envFilter !== "__all__" ? "var(--color-accent)" : "var(--color-text-muted)", fontWeight: envFilter !== "__all__" ? 600 : 400 }}
            >
              <option value="__all__">All environments</option>
              {environments.map((env) => <option key={env} value={env}>{env}</option>)}
            </select>
          )}
          <p className="text-xs whitespace-nowrap" style={{ color: "var(--color-text-muted)" }}>
            {runs.length} runs
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
              {["Dataset", "Step", "Status", "Duration", "Time"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2 text-left font-semibold uppercase tracking-wider"
                  style={{ color: "var(--color-text-muted)", fontSize: "10px" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map((r, i) => {
              const st = statusStyle(r.run_status);
              return (
                <tr
                  key={r.run_id + i}
                  style={{ borderBottom: "1px solid var(--color-border)", cursor: "pointer" }}
                  onClick={() => setSelectedRun(r)}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "var(--color-surface)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
                >
                  <td className="px-4 py-2 font-medium truncate max-w-[120px]" style={{ color: "var(--color-text)" }}>{r.dataset_id}</td>
                  <td className="px-4 py-2" style={{ color: "var(--color-text-muted)" }}>{r.step}</td>
                  <td className="px-4 py-2">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ background: st.bg, color: st.text }}
                    >
                      {r.run_status}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono" style={{ color: "var(--color-text-muted)" }}>{fmtDuration(r.duration_ms)}</td>
                  <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--color-text-muted)" }}>{fmtTs(r.timestamp_utc)}</td>
                </tr>
              );
            })}
            {runs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
                  No runs in selected period
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {selectedRun && (
        <div
          className="absolute right-0 top-0 bottom-0 z-20 w-full max-w-[340px] overflow-y-auto p-4"
          style={{ background: "var(--color-card)", borderLeft: "1px solid var(--color-border)", boxShadow: "var(--shadow-drawer)" }}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>Run detail</p>
              <p className="truncate text-sm font-semibold" style={{ color: "var(--color-text)" }}>{selectedRun.dataset_id}</p>
            </div>
            <button onClick={() => setSelectedRun(null)} className="rounded-md p-1" aria-label="Close">
              <X className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
            </button>
          </div>
          <div className="space-y-3 text-xs">
            <Detail label="Run ID" value={selectedRun.run_id} mono />
            <Detail label="Step" value={selectedRun.step} />
            <Detail label="Status" value={selectedRun.run_status} />
            <Detail label="Duration" value={fmtDuration(selectedRun.duration_ms)} />
            <Detail label="Time" value={fmtTs(selectedRun.timestamp_utc)} />
            <Detail label="Source system" value={selectedRun.source_system} />
            <Detail label="Environment" value={selectedRun.environment ?? "—"} />
          </div>
        </div>
      )}
    </Card>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>{label}</p>
      <p className={mono ? "break-all font-mono" : "break-words"} style={{ color: "var(--color-text)" }}>{value}</p>
    </div>
  );
}
