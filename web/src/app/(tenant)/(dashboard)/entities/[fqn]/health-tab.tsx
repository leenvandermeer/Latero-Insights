/**
 * Health Tab Component for Entity Detail Hub
 *
 * Shows:
 * - Layer status badges (per layer: landing, raw, bronze, silver, gold)
 * - Recent runs timeline
 * - Duration trends
 * - Error patterns
 */

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

interface HealthTabProps {
  entity: any;
  runs: any[];
}

export function HealthTab({ entity, runs }: HealthTabProps) {
  const layers = (entity?.layer_statuses as Array<Record<string, unknown>>) ?? [];

  // Calculate health metrics
  const successfulRuns = runs.filter((r) => r.status === "SUCCESS").length;
  const failedRuns = runs.filter((r) => r.status === "FAILED").length;
  const avgDuration = calculateAvgDuration(runs);
  const trend = calculateTrend(runs);

  return (
    <div className="space-y-6">
      {/* Health Score Card */}
      <div
        className="rounded-xl p-6"
        style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text)" }}>
          Health Score
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <HealthMetric
            label="Success Rate"
            value={runs.length > 0 ? `${Math.round((successfulRuns / runs.length) * 100)}%` : "—"}
            status={
              runs.length === 0
                ? "neutral"
                : successfulRuns / runs.length >= 0.95
                ? "success"
                : successfulRuns / runs.length >= 0.8
                ? "warning"
                : "error"
            }
          />
          <HealthMetric
            label="Failed Runs"
            value={failedRuns}
            status={failedRuns === 0 ? "success" : failedRuns <= 2 ? "warning" : "error"}
          />
          <HealthMetric
            label="Avg Duration"
            value={avgDuration ? formatDuration(avgDuration) : "—"}
            status="neutral"
          />
          <HealthMetric
            label="Trend"
            value={trend.label}
            status={trend.status}
            icon={trend.icon}
          />
        </div>
      </div>

      {/* Layer Status Section */}
      {layers.length > 0 && (
        <div
          className="rounded-xl p-6"
          style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
        >
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text)" }}>
            Layer Status
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {layers.map((layer) => (
              <LayerStatusCard
                key={layer.layer as string}
                layer={layer.layer as string}
                status={layer.latest_status as string}
                lastRun={layer.latest_run_at as string}
                datasetId={layer.dataset_id as string}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Runs Timeline */}
      <div
        className="rounded-xl p-6"
        style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text)" }}>
          Recent Runs
        </h2>
        {runs.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: "var(--color-text-muted)" }}>
            No runs recorded yet
          </p>
        ) : (
          <RunsTimeline runs={runs} />
        )}
      </div>
    </div>
  );
}

// ── Health Metric Card ────────────────────────────────────────────────────────

interface HealthMetricProps {
  label: string;
  value: string | number;
  status: "success" | "warning" | "error" | "neutral";
  icon?: React.ElementType;
}

function HealthMetric({ label, value, status, icon: Icon }: HealthMetricProps) {
  const statusColors = {
    success: { bg: "rgba(16,185,129,0.1)", text: "#059669", border: "#86efac" },
    warning: { bg: "rgba(245,158,11,0.1)", text: "#d97706", border: "#fde047" },
    error: { bg: "rgba(239,68,68,0.1)", text: "#dc2626", border: "#fca5a5" },
    neutral: { bg: "var(--color-surface)", text: "var(--color-text)", border: "var(--color-border)" },
  };

  const colors = statusColors[status];

  return (
    <div
      className="rounded-lg p-4 flex flex-col"
      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
    >
      <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </div>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-5 w-5" style={{ color: colors.text }} />}
        <div className="text-xl font-bold" style={{ color: colors.text }}>
          {value}
        </div>
      </div>
    </div>
  );
}

// ── Layer Status Card ─────────────────────────────────────────────────────────

interface LayerStatusCardProps {
  layer: string;
  status: string;
  lastRun: string;
  datasetId: string;
}

const UNKNOWN_STATUS_CONFIG = { icon: Clock, color: "#6b7280", bg: "rgba(107,114,128,0.1)", border: "#d1d5db" };

function LayerStatusCard({ layer, status, lastRun, datasetId }: LayerStatusCardProps) {
  const statusConfig = ({
    SUCCESS: { icon: CheckCircle2, color: "#059669", bg: "rgba(16,185,129,0.1)", border: "#86efac" },
    FAILED: { icon: XCircle, color: "#dc2626", bg: "rgba(239,68,68,0.1)", border: "#fca5a5" },
    WARNING: { icon: AlertTriangle, color: "#d97706", bg: "rgba(245,158,11,0.1)", border: "#fde047" },
    UNKNOWN: UNKNOWN_STATUS_CONFIG,
  } as Record<string, typeof UNKNOWN_STATUS_CONFIG>)[status] ?? UNKNOWN_STATUS_CONFIG;

  const StatusIcon = statusConfig.icon;

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: statusConfig.bg, border: `1px solid ${statusConfig.border}` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <StatusIcon className="h-4 w-4" style={{ color: statusConfig.color }} />
        <span className="text-sm font-semibold capitalize" style={{ color: "var(--color-text)" }}>
          {layer}
        </span>
      </div>
      <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        {lastRun ? formatRelativeTime(lastRun) : "Never run"}
      </div>
      <div className="text-xs font-mono mt-1 truncate" style={{ color: "var(--color-text-muted)" }}>
        {datasetId}
      </div>
    </div>
  );
}

// ── Runs Timeline ─────────────────────────────────────────────────────────────

function RunsTimeline({ runs }: { runs: any[] }) {
  return (
    <div className="space-y-2">
      {runs.map((run, idx) => {
        const status = run.status as string;
        const statusConfig = {
          SUCCESS: { icon: CheckCircle2, color: "#059669" },
          FAILED: { icon: XCircle, color: "#dc2626" },
          WARNING: { icon: AlertTriangle, color: "#d97706" },
        }[status] ?? { icon: Clock, color: "#6b7280" };

        const StatusIcon = statusConfig.icon;

        return (
          <div
            key={run.run_id}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-black/5 transition-colors"
            style={{ border: "1px solid var(--color-border)" }}
          >
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <StatusIcon className="h-4 w-4 flex-shrink-0" style={{ color: statusConfig.color }} />
              {idx < runs.length - 1 && (
                <div
                  className="w-px h-8 mt-1"
                  style={{ background: "var(--color-border)" }}
                />
              )}
            </div>

            {/* Run info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  {run.step || "Run"}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{
                    background: statusConfig.color + "20",
                    color: statusConfig.color,
                  }}
                >
                  {status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                <span>{formatRelativeTime(run.ended_at)}</span>
                {run.duration_ms && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(run.duration_ms)}
                  </span>
                )}
              </div>
            </div>

            {/* Link to run detail */}
            <a
              href={`/runs/${run.run_id}`}
              className="text-xs font-medium px-2 py-1 rounded hover:bg-black/5"
              style={{ color: "var(--color-brand)" }}
            >
              Details →
            </a>
          </div>
        );
      })}
    </div>
  );
}

// ── Utility Functions ─────────────────────────────────────────────────────────

function calculateAvgDuration(runs: any[]): number | null {
  const durations = runs
    .map((r) => r.duration_ms)
    .filter((d): d is number => typeof d === "number");

  if (durations.length === 0) return null;
  return durations.reduce((sum, d) => sum + d, 0) / durations.length;
}

function calculateTrend(runs: any[]): {
  label: string;
  status: "success" | "warning" | "error" | "neutral";
  icon?: React.ElementType;
} {
  if (runs.length < 2) return { label: "—", status: "neutral" };

  const recentRuns = runs.slice(0, 5);
  const olderRuns = runs.slice(5, 10);

  const recentSuccess = recentRuns.filter((r) => r.status === "SUCCESS").length / recentRuns.length;
  const olderSuccess = olderRuns.length > 0
    ? olderRuns.filter((r) => r.status === "SUCCESS").length / olderRuns.length
    : recentSuccess;

  if (recentSuccess > olderSuccess + 0.1) {
    return { label: "Improving", status: "success", icon: TrendingUp };
  } else if (recentSuccess < olderSuccess - 0.1) {
    return { label: "Declining", status: "error", icon: TrendingDown };
  } else {
    return { label: "Stable", status: "neutral", icon: Minus };
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
