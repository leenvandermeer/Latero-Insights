"use client";

import { usePipelines } from "@/hooks";
import { Card, WidgetHeader } from "@/components/ui";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { STATUS_COLORS, STATUS_BG, normalizeStatus, type StatusKey } from "@/lib/chart-colors";
import { CheckCircle2, XCircle, AlertTriangle, Clock, Activity } from "lucide-react";

interface Props {
  from: string;
  to: string;
  titleOverride?: string;
}

const STATUS_ICON: Record<StatusKey, typeof CheckCircle2> = {
  SUCCESS: CheckCircle2,
  WARNING: AlertTriangle,
  FAILED: XCircle,
};

function fmtTs(ts: string): string {
  try {
    const d = new Date(ts);
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch { return ts; }
}

function fmtDuration(ms: number | null): string {
  if (ms === null) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

export function EventLogWidget({ from, to, titleOverride }: Props) {
  const { data: response, isLoading, error } = usePipelines(from, to);

  if (isLoading) return <TableSkeleton rows={6} />;
  if (error) return (
    <Card className="h-full flex items-center justify-center p-6">
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Failed to load</p>
    </Card>
  );

  const events = [...(response?.data ?? [])]
    .sort((a, b) => b.timestamp_utc.localeCompare(a.timestamp_utc));

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <WidgetHeader
        title={titleOverride ?? "Event Log"}
        icon={<Activity className="h-4 w-4" style={{ color: "var(--color-accent)" }} />}
        meta={`${events.length} events`}
      />

      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-24">
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>No events in selected period</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {events.map((run, i) => {
              const s = (normalizeStatus(run.run_status) as StatusKey) in STATUS_COLORS
                ? (normalizeStatus(run.run_status) as StatusKey)
                : "FAILED" as StatusKey;
              const Icon = STATUS_ICON[s];
              return (
                <div
                  key={run.run_id + i}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{ background: "transparent" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "var(--color-surface)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
                >
                  {/* Status icon */}
                  <div
                    className="shrink-0 flex items-center justify-center rounded-full"
                    style={{ width: 24, height: 24, background: STATUS_BG[s], border: `1.5px solid ${STATUS_COLORS[s]}` }}
                  >
                    <Icon style={{ width: 12, height: 12, color: STATUS_COLORS[s] }} />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold truncate" style={{ color: "var(--color-text)" }}>
                        {run.dataset_id}
                      </p>
                      <span className="text-[10px] shrink-0" style={{ color: "var(--color-text-muted)" }}>
                        {fmtTs(run.timestamp_utc)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-mono truncate" style={{ color: "var(--color-text-muted)" }}>
                        {run.step}
                      </span>
                      {run.duration_ms !== null && (
                        <>
                          <span style={{ color: "var(--color-border)" }}>·</span>
                          <Clock style={{ width: 9, height: 9, color: "var(--color-text-muted)", flexShrink: 0 }} />
                          <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                            {fmtDuration(run.duration_ms)}
                          </span>
                        </>
                      )}
                      <span style={{ color: "var(--color-border)" }}>·</span>
                      <span className="text-[10px] font-semibold shrink-0" style={{ color: STATUS_COLORS[s] }}>
                        {run.run_status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
