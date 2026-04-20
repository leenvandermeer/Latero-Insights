"use client";

import { useState } from "react";
import { useQuality } from "@/hooks";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { normalizeStatus } from "@/lib/chart-colors";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface Props {
  from: string;
  to: string;
  titleOverride?: string;
}

const S: Record<string, { bg: string; color: string }> = {
  SUCCESS: { bg: "rgba(34,197,94,0.12)",  color: "#16a34a" },
  WARNING: { bg: "rgba(234,179,8,0.12)",   color: "#ca8a04" },
  FAILED:  { bg: "rgba(239,68,68,0.12)",   color: "#dc2626" },
};
const ss = (s: string) => S[s] ?? { bg: "rgba(100,116,139,0.1)", color: "var(--color-text-muted)" };

const fmt = (ts: string) => {
  try { return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return ts; }
};

type Col = "check_id" | "dataset_id" | "step" | "check_category" | "check_status" | "timestamp_utc";
const COLS: { k: Col; l: string }[] = [
  { k: "check_id",       l: "Check ID" },
  { k: "dataset_id",     l: "Dataset" },
  { k: "step",           l: "Step" },
  { k: "check_category", l: "Category" },
  { k: "check_status",   l: "Status" },
  { k: "timestamp_utc",  l: "Time" },
];

export function DqChecksTableWidget({ from, to, titleOverride }: Props) {
  const { data: res, isLoading, error } = useQuality(from, to);
  const [col, setCol] = useState<Col>("timestamp_utc");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sort = (k: Col) => {
    if (k === col) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setCol(k); setDir(k === "timestamp_utc" ? "desc" : "asc"); }
  };

  if (isLoading) return <TableSkeleton rows={6} />;
  if (error) return <div className="h-full flex items-center justify-center text-xs" style={{ color: "var(--color-text-muted)" }}>Failed to load</div>;

  const rows = [...(res?.data ?? [])]
    .sort((a, b) => {
      const va = (a[col] ?? "") as string, vb = (b[col] ?? "") as string;
      return dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    })
    .slice(0, 50);

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-xl" style={{ border: "1px solid var(--color-border)", background: "var(--color-card)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>{titleOverride ?? "DQ Check Results"}</span>
        <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>{rows.length} checks</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full" style={{ fontSize: 11 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--color-surface)" }}>
            <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
              {COLS.map(({ k, l }) => {
                const active = col === k;
                const Icon = active ? (dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
                return (
                  <th key={k} onClick={() => sort(k)} className="px-2 py-1 text-left select-none"
                    style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap", cursor: "pointer",
                      color: active ? "var(--color-accent)" : "var(--color-text-muted)" }}>
                    <span className="inline-flex items-center gap-0.5">{l}<Icon className="h-2.5 w-2.5" style={{ opacity: active ? 1 : 0.45 }} /></span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => {
              const norm = normalizeStatus(c.check_status);
              const { bg, color } = ss(norm);
              return (
                <tr key={c.run_id + c.check_id + i} style={{ borderBottom: "1px solid var(--color-border)" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "var(--color-surface)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}>
                  <td className="px-2 py-0.5 font-mono truncate max-w-[120px]" style={{ color: "var(--color-text)" }}>{c.check_id}</td>
                  <td className="px-2 py-0.5 truncate max-w-[90px]" style={{ color: "var(--color-text-muted)" }}>{c.dataset_id}</td>
                  <td className="px-2 py-0.5" style={{ color: "var(--color-text-muted)" }}>{c.step}</td>
                  <td className="px-2 py-0.5" style={{ color: "var(--color-text-muted)" }}>{c.check_category ?? "—"}</td>
                  <td className="px-2 py-0.5">
                    <span className="inline-flex rounded-full px-1.5 py-px font-semibold" style={{ fontSize: 10, background: bg, color }}>{norm}</span>
                  </td>
                  <td className="px-2 py-0.5 whitespace-nowrap" style={{ color: "var(--color-text-muted)" }}>{fmt(c.timestamp_utc)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center" style={{ fontSize: 11, color: "var(--color-text-muted)" }}>No checks in selected period</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
