"use client";

import { useQuery } from "@tanstack/react-query";
import { listIncidents } from "@/lib/api/incidents";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import type { WidgetProps } from "../registry";

const SEVERITY_STYLE: Record<string, { bg: string; text: string }> = {
  critical: { bg: "rgba(239,68,68,0.12)",   text: "#dc2626" },
  high:     { bg: "rgba(249,115,22,0.12)",  text: "#ea580c" },
  medium:   { bg: "rgba(234,179,8,0.12)",   text: "#ca8a04" },
  low:      { bg: "rgba(100,116,139,0.12)", text: "var(--color-text-muted)" },
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  open:        { bg: "rgba(239,68,68,0.12)",  text: "#dc2626" },
  in_progress: { bg: "rgba(59,130,246,0.12)", text: "#2563eb" },
  resolved:    { bg: "rgba(34,197,94,0.12)",  text: "#16a34a" },
};

function fmtDate(ts: string): string {
  try {
    return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

export function OpenIncidentsTableWidget({ titleOverride }: WidgetProps) {
  const { data: incidents, isLoading, error } = useQuery({
    queryKey: ["incidents", "open"],
    queryFn: () => listIncidents({ status: "open" }),
    staleTime: 30_000,
  });

  if (isLoading) return <TableSkeleton rows={5} />;
  if (error) return (
    <Card className="h-full flex items-center justify-center p-6">
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Failed to load</p>
    </Card>
  );

  const rows = incidents ?? [];

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <div
        className="flex items-center gap-3 px-5 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          {titleOverride ?? "Open Incidents"}
        </p>
        <span
          className="ml-auto text-xs font-medium rounded-full px-2 py-0.5"
          style={{ background: rows.length > 0 ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)", color: rows.length > 0 ? "#dc2626" : "#16a34a" }}
        >
          {rows.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No open incidents</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                {["Title", "Severity", "Status", "Opened"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((inc) => {
                const sev = SEVERITY_STYLE[inc.severity] ?? SEVERITY_STYLE.low;
                const sta = STATUS_STYLE[inc.status] ?? STATUS_STYLE.open;
                return (
                  <tr key={inc.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td className="px-4 py-2.5 max-w-[220px] truncate" style={{ color: "var(--color-text)" }} title={inc.title}>{inc.title}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium capitalize" style={{ background: sev.bg, color: sev.text }}>{inc.severity}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: sta.bg, color: sta.text }}>{inc.status.replace("_", " ")}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--color-text-muted)" }}>{fmtDate(inc.created_at)}</td>
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
