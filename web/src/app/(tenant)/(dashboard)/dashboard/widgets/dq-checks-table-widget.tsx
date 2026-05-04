"use client";

import { useState, useMemo } from "react";
import { useQuality } from "@/hooks";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { normalizeStatus } from "@/lib/chart-colors";
import { ChevronUp, ChevronDown, ChevronsUpDown, X, ChevronLeft, ChevronRight } from "lucide-react";
import type { DataQualityCheck } from "@/lib/adapters/types";

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
  const PAGE_SIZE = 50;
  const [col, setCol] = useState<Col>("timestamp_utc");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [selectedCheck, setSelectedCheck] = useState<DataQualityCheck | null>(null);

  const sort = (k: Col) => {
    if (k === col) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setCol(k); setDir(k === "timestamp_utc" ? "desc" : "asc"); setPage(0); }
  };

  const sorted = useMemo(() => [...(res?.data ?? [])].sort((a, b) => {
    const va = (a[col] ?? "") as string, vb = (b[col] ?? "") as string;
    return dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
  }), [res, col, dir]);

  if (isLoading) return <TableSkeleton rows={6} />;
  if (error) return <div className="h-full flex items-center justify-center text-xs" style={{ color: "var(--color-text-muted)" }}>Failed to load</div>;

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const rows = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="relative h-full flex flex-col overflow-hidden rounded-xl" style={{ border: "1px solid var(--color-border)", background: "var(--color-card)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>{titleOverride ?? "DQ Check Results"}</span>
        <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>{sorted.length} checks</span>
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
                <tr key={c.run_id + c.check_id + i} style={{ borderBottom: "1px solid var(--color-border)", cursor: "pointer" }}
                  onClick={() => setSelectedCheck(c)}
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
      {/* Pagination footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 shrink-0" style={{ borderTop: "1px solid var(--color-border)" }}>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="rounded p-0.5 disabled:opacity-30"
            style={{ color: "var(--color-text-muted)" }}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
            {safePage + 1} / {totalPages} · {sorted.length} total
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage === totalPages - 1}
            className="rounded p-0.5 disabled:opacity-30"
            style={{ color: "var(--color-text-muted)" }}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {selectedCheck && (
        <div
          className="absolute right-0 top-0 bottom-0 z-20 w-full max-w-[340px] overflow-y-auto p-4"
          style={{ background: "var(--color-card)", borderLeft: "1px solid var(--color-border)", boxShadow: "var(--shadow-drawer)" }}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>Check detail</p>
              <p className="truncate text-sm font-semibold" style={{ color: "var(--color-text)" }}>{selectedCheck.check_id}</p>
            </div>
            <button onClick={() => setSelectedCheck(null)} className="rounded-md p-1" aria-label="Close">
              <X className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
            </button>
          </div>
          <div className="space-y-3 text-xs">
            <Detail label="Dataset" value={selectedCheck.dataset_id} />
            <Detail label="Step" value={selectedCheck.step} />
            <Detail label="Status" value={normalizeStatus(selectedCheck.check_status)} />
            <Detail label="Category" value={selectedCheck.check_category ?? "—"} />
            <Detail label="Policy version" value={selectedCheck.policy_version ?? "—"} />
            <Detail label="Run ID" value={selectedCheck.run_id} mono />
            <Detail label="Time" value={fmt(selectedCheck.timestamp_utc)} />
          </div>
        </div>
      )}
    </div>
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
