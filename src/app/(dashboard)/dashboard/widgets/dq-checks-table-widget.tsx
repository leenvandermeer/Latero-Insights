"use client";

import { useQuality } from "@/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/loading-skeleton";

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

function fmtTs(ts: string): string {
  try {
    return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

export function DqChecksTableWidget({ from, to, titleOverride }: Props) {
  const { data: response, isLoading, error } = useQuality(from, to);

  if (isLoading) return <TableSkeleton rows={8} />;
  if (error) return (
    <Card className="h-full flex items-center justify-center">
      <CardContent><p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Failed to load</p></CardContent>
    </Card>
  );

  const checks = [...(response?.data ?? [])]
    .sort((a, b) => b.timestamp_utc.localeCompare(a.timestamp_utc))
    .slice(0, 25);

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          {titleOverride ?? "DQ Check Results"}
        </p>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {checks.length} checks
        </p>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
              {["Check ID", "Dataset", "Step", "Category", "Status", "Time"].map((h) => (
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
            {checks.map((c, i) => {
              const st = statusStyle(c.check_status);
              return (
                <tr
                  key={c.run_id + c.check_id + i}
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "var(--color-surface)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
                >
                  <td className="px-4 py-2 font-mono truncate max-w-[140px]" style={{ color: "var(--color-text)" }}>{c.check_id}</td>
                  <td className="px-4 py-2 truncate max-w-[100px]" style={{ color: "var(--color-text-muted)" }}>{c.dataset_id}</td>
                  <td className="px-4 py-2" style={{ color: "var(--color-text-muted)" }}>{c.step}</td>
                  <td className="px-4 py-2" style={{ color: "var(--color-text-muted)" }}>{c.check_category ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ background: st.bg, color: st.text }}
                    >
                      {c.check_status}
                    </span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--color-text-muted)" }}>{fmtTs(c.timestamp_utc)}</td>
                </tr>
              );
            })}
            {checks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
                  No checks in selected period
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
