"use client";

import { useState } from "react";
import { useRuns } from "@/hooks/use-runs";
import { useDateRange } from "@/hooks/use-date-range";
import { DateRangePicker } from "@/components/ui";
import { Activity, CheckCircle, XCircle, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

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
  const { from, to, setRange } = useDateRange();
  const { data, isLoading, isError } = useRuns({ from, to, status: status || undefined, step: step || undefined });

  const runs = (data?.data ?? []) as Array<Record<string, string>>;

  return (
    <div className="flex flex-col h-full" style={{ padding: "var(--spacing-page, 24px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5" style={{ color: "var(--color-brand)" }} />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>Runs</h1>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Pipeline run history</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Status filter */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-sm rounded-md border px-2 py-1.5"
            style={{ background: "var(--color-surface)", color: "var(--color-text)", borderColor: "var(--color-border)" }}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {/* Step filter */}
          <input
            type="text"
            placeholder="Filter by step…"
            value={step}
            onChange={(e) => setStep(e.target.value)}
            className="text-sm rounded-md border px-2 py-1.5 w-44"
            style={{ background: "var(--color-surface)", color: "var(--color-text)", borderColor: "var(--color-border)" }}
          />
          <DateRangePicker from={from} to={to} onChange={setRange} />
        </div>
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
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-text-muted)" }}>Step</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-text-muted)" }}>Job</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-text-muted)" }}>Started</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-text-muted)" }}>Duration</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-text-muted)" }}></th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center" style={{ color: "var(--color-text-muted)" }}>
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
                    <span className="flex items-center gap-1.5">
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
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--color-text)" }}>{run.step ?? "—"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>{run.dataset_id ?? "—"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {run.started_at ? new Date(run.started_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {run.duration_ms != null ? `${Math.round(Number(run.duration_ms) / 1000)}s` : "—"}
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
