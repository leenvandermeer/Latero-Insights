"use client";

import { useState, useMemo } from "react";
import { useQuality } from "@/hooks/use-quality";
import { useDateRange } from "@/hooks/use-date-range";
import { DateRangePicker } from "@/components/ui";
import { CheckCircle, XCircle, AlertTriangle, HelpCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DataQualityCheck } from "@/lib/adapters/types";

const STATUS_OPTIONS = ["", "SUCCESS", "FAILED", "WARNING"];

const statusIcon = (status: string) => {
  switch (status) {
    case "SUCCESS": return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
    case "FAILED":  return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case "WARNING": return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
    default:        return <HelpCircle className="h-3.5 w-3.5 text-gray-400" />;
  }
};

export function QualityExplorer() {
  const [status, setStatus] = useState("");
  const [dataset, setDataset] = useState("");
  const { from, to, preset, setRange, setPreset } = useDateRange({ scope: "monitor:quality", defaultPreset: "7d" });
  const { data, isLoading, isError } = useQuality(from, to);

  const checks = useMemo(() => {
    const all = (data?.data ?? []) as DataQualityCheck[];
    return all.filter((c) => {
      if (status && c.check_status !== status) return false;
      if (dataset && !c.dataset_id?.toLowerCase().includes(dataset.toLowerCase())) return false;
      return true;
    });
  }, [data, status, dataset]);

  return (
    <div className="page-content flex h-full flex-col overflow-x-hidden pt-3">
      <div className="mb-5 grid gap-2 lg:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto] lg:items-center">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 w-full min-w-0 text-sm rounded-md border px-2.5"
          style={{ background: "var(--color-surface)", color: "var(--color-text)", borderColor: "var(--color-border)" }}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Filter by dataset…"
          value={dataset}
          onChange={(e) => setDataset(e.target.value)}
          className="h-9 w-full min-w-0 text-sm rounded-md border px-2.5"
          style={{ background: "var(--color-surface)", color: "var(--color-text)", borderColor: "var(--color-border)" }}
        />
        <DateRangePicker
          from={from}
          to={to}
          preset={preset}
          onChange={setRange}
          onPresetChange={setPreset}
          className="w-full lg:w-auto"
        />
      </div>

      {/* Loading / error */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center" style={{ color: "var(--color-text-muted)" }}>
          Loading checks…
        </div>
      )}
      {isError && (
        <div className="flex-1 flex items-center justify-center text-red-500">
          Failed to load quality checks.
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && (
        <div className="overflow-auto rounded-lg border" style={{ borderColor: "var(--color-border)" }}>
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr style={{ background: "var(--color-surface-subtle)", borderBottom: "1px solid var(--color-border)" }}>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-text-muted)" }}>Status</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-text-muted)" }}>Check</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-text-muted)" }}>Dataset</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-text-muted)" }}>Category</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-text-muted)" }}>Time</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-text-muted)" }}></th>
              </tr>
            </thead>
            <tbody>
              {checks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center" style={{ color: "var(--color-text-muted)" }}>
                    No checks found
                  </td>
                </tr>
              )}
              {checks.map((check, i) => (
                <tr
                  key={`${check.check_id}-${check.timestamp_utc}-${i}`}
                  className="border-b hover:bg-[var(--color-surface-subtle)] transition-colors"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      {statusIcon(check.check_status)}
                      <span className={cn("text-xs font-medium",
                        check.check_status === "SUCCESS" && "text-green-600",
                        check.check_status === "FAILED"  && "text-red-600",
                        check.check_status === "WARNING" && "text-yellow-600",
                      )}>
                        {check.check_status ?? "UNKNOWN"}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--color-text)" }}>
                    <div className="font-medium">{check.check_name ?? check.check_id}</div>
                    <div className="font-mono text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>{check.check_id}</div>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {check.dataset_id ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {check.check_category ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {check.timestamp_utc ? new Date(check.timestamp_utc).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {check.result_id && (
                      <Link
                        href={`/quality/${encodeURIComponent(check.result_id)}`}
                        className="hover:underline"
                        style={{ color: "var(--color-brand)" }}
                      >
                        Details →
                      </Link>
                    )}
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
