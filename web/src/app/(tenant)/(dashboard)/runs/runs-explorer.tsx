"use client";

import { useState } from "react";
import { useRuns } from "@/hooks/use-runs";
import { useDateRange } from "@/hooks/use-date-range";
import { DateRangePicker } from "@/components/ui";
import { CheckCircle, XCircle, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { RunSummary } from "@/types/v2";

const STATUS_OPTIONS = ["", "SUCCESS", "FAILED", "WARNING", "RUNNING"];

const statusIcon = (status: string) => {
  switch (status) {
    case "SUCCESS": return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
    case "FAILED": return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case "WARNING": return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
    case "RUNNING": return <Clock className="h-3.5 w-3.5 text-blue-500" />;
    default: return <span className="h-3.5 w-3.5 rounded-full bg-gray-300 inline-block" />;
  }
};

export function RunsExplorer() {
  const [status, setStatus] = useState("");
  const [step, setStep] = useState("");
  const { from, to, preset, setRange, setPreset } = useDateRange({ scope: "monitor:runs", defaultPreset: "7d" });
  const { data, isLoading, isError } = useRuns({ from, to, status: status || undefined, step: step || undefined });

  const runs = (data?.data ?? []) as RunSummary[];

  const formatDuration = (raw: number | null | undefined) => {
    if (raw == null) return "—";
    const seconds = Math.round(raw / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
  };

  const taskLabel = (run: RunSummary) => run.task_name || run.job_name || "—";

  return (
    <div className="page-content flex h-full flex-col overflow-x-hidden pt-3">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 text-sm rounded-md border px-2.5 min-w-40"
          style={{ background: "var(--color-surface)", color: "var(--color-text)", borderColor: "var(--color-border)" }}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Filter by job or task…"
          value={step}
          onChange={(e) => setStep(e.target.value)}
          className="h-9 text-sm rounded-md border px-2.5 min-w-56 flex-1"
          style={{ background: "var(--color-surface)", color: "var(--color-text)", borderColor: "var(--color-border)" }}
        />
        <DateRangePicker
          from={from}
          to={to}
          preset={preset}
          onChange={setRange}
          onPresetChange={setPreset}
        />
      </div>

      {/* Table */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center" style={{ color: "var(--color-text-muted)" }}>
          Loading runs…
        </div>
      )}
      {isError && (
        <div className="flex-1 flex items-center justify-center text-red-500">
          Failed to load runs.
        </div>
      )}
      {!isLoading && !isError && (
        <div className="overflow-auto rounded-lg border" style={{ borderColor: "var(--color-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--color-surface-subtle)", borderBottom: "1px solid var(--color-border)" }}>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-text-muted)" }}>Status</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-text-muted)" }}>Job</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-text-muted)" }}>Task</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-text-muted)" }}>Environment</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-text-muted)" }}>Started</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-text-muted)" }}>Duration</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-text-muted)" }}>DQ</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-text-muted)" }}></th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center" style={{ color: "var(--color-text-muted)" }}>
                    No runs found
                  </td>
                </tr>
              )}
              {runs.map((run) => (
                <tr
                  key={run.run_id}
                  className="border-b hover:bg-[var(--color-surface-subtle)] transition-colors"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 flex-wrap">
                      {statusIcon(run.status)}
                      <span className={cn("text-xs font-medium",
                        run.status === "SUCCESS" && "text-green-600",
                        run.status === "FAILED" && "text-red-600",
                        run.status === "WARNING" && "text-yellow-600",
                        run.status === "RUNNING" && "text-blue-600",
                      )}>
                        {run.status ?? "UNKNOWN"}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--color-text)" }}>
                    {run.job_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="font-mono" style={{ color: "var(--color-text)" }}>
                      {taskLabel(run)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {run.environment ? (
                      <span
                        className="px-1.5 py-0.5 rounded text-xs font-medium"
                        style={{
                          background: run.environment === "prod" ? "var(--color-brand-subtle)" : "var(--color-surface-alt, #ece4d6)",
                          color: run.environment === "prod" ? "var(--color-brand)" : "var(--color-text-muted)",
                        }}
                      >
                        {run.environment}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {run.started_at ? new Date(run.started_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {formatDuration(run.duration_ms)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {Number(run.dq_count) > 0 ? (
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                        {run.dq_count}
                      </span>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <Link
                      href={`/runs/${encodeURIComponent(run.run_id)}`}
                      className="hover:underline"
                      style={{ color: "var(--color-brand)" }}
                    >
                      Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
