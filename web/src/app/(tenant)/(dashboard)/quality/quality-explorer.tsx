"use client";

import { useState, useMemo } from "react";
import { useQuality } from "@/hooks/use-quality";
import { useDateRange } from "@/hooks/use-date-range";
import { DateRangePicker } from "@/components/ui";
import { ShieldCheck, CheckCircle, XCircle, AlertTriangle, HelpCircle } from "lucide-react";
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
  const { from, to, setRange } = useDateRange();
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
    <div className="flex flex-col h-full" style={{ padding: "var(--spacing-page, 24px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5" style={{ color: "var(--color-brand)" }} />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>Data Quality</h1>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>DQ check results</p>
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
          {/* Dataset filter */}
          <input
            type="text"
            placeholder="Filter by dataset…"
            value={dataset}
            onChange={(e) => setDataset(e.target.value)}
            className="text-sm rounded-md border px-2 py-1.5 w-44"
            style={{ background: "var(--color-surface)", color: "var(--color-text)", borderColor: "var(--color-border)" }}
          />
          <DateRangePicker from={from} to={to} onChange={setRange} />
        </div>
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
          <table className="w-full text-sm">
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
