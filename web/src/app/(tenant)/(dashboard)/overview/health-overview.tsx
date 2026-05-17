"use client";

import { useEstateHealth } from "@/hooks/use-data-products";
import { useRuns } from "@/hooks/use-runs";
import { useIncidents } from "@/hooks/use-incidents";
import { useDateRange } from "@/hooks/use-date-range";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  HelpCircle,
  XCircle,
  AlertCircle,
  Layers,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "@/components/ui";
import type { RunSummary } from "@/types/v2";

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const statusIcon = (s: string) => {
  switch (s) {
    case "SUCCESS": return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
    case "FAILED": return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case "WARNING": return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
    case "RUNNING": return <Clock className="h-3.5 w-3.5 text-blue-500" />;
    default: return <HelpCircle className="h-3.5 w-3.5 text-gray-400" />;
  }
};

const statusColor = (s: string) =>
  ({ SUCCESS: "bg-green-100 text-green-700", FAILED: "bg-red-100 text-red-700", WARNING: "bg-yellow-100 text-yellow-700", RUNNING: "bg-blue-100 text-blue-700" }[s] ?? "bg-gray-100 text-gray-500");

// ── Metric strip ──────────────────────────────────────────────────────────────

type MetricItem = {
  label: string;
  value: string | number;
  href: string;
  loading: boolean;
  accent?: string;
  dim?: boolean;
};

function MetricStrip({ metrics }: { metrics: MetricItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden border" style={{ borderColor: "var(--color-border)", background: "var(--color-border)" }}>
      {metrics.map(({ label, value, href, loading, accent, dim }) => (
        <Link
          key={label}
          href={href}
          className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-[var(--color-surface-subtle)]"
          style={{ background: "var(--color-surface)" }}
        >
          <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
            {label}
          </span>
          <span
            className="text-2xl font-bold tabular-nums leading-none"
            style={{ color: loading ? "var(--color-text-muted)" : dim ? "var(--color-text-muted)" : accent ?? "var(--color-text)" }}
          >
            {loading ? "…" : String(value)}
          </span>
        </Link>
      ))}
    </div>
  );
}

// ── Layer health bar ──────────────────────────────────────────────────────────

type LayerRow = { layer: string; run_count: number; success_count: number; success_rate: number };

const LAYER_ORDER = ["landing", "raw", "bronze", "silver", "gold"] as const;

function LayerHealthPanel({ rows, loading }: { rows: LayerRow[]; loading: boolean }) {
  const byLayer = Object.fromEntries(rows.map((r) => [r.layer, r]));

  return (
    <div className="rounded-xl border flex flex-col" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
          <div>
            <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Pipeline Health by Layer</span>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Run success rate per medallion layer</p>
          </div>
        </div>
        <Link href="/lineage" className="text-xs hover:underline" style={{ color: "var(--color-brand)" }}>
          View lineage →
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3 px-5 py-4">
          {LAYER_ORDER.map((l) => (
            <div key={l} className="h-5 rounded animate-pulse" style={{ background: "var(--color-border)" }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
          No runs found in this period.
        </p>
      ) : (
        <ul className="flex flex-col gap-0 divide-y" style={{ borderColor: "var(--color-border)" }}>
          {LAYER_ORDER.map((layer) => {
            const row = byLayer[layer];
            if (!row) return null;
            const rate = row.success_rate ?? 0;
            const warn = rate < 70;
            const barColor = warn ? "var(--color-warning, #ca8a04)" : rate === 100 ? "var(--color-success, #16a34a)" : "var(--color-brand)";
            return (
              <li key={layer} className="flex items-center gap-3 px-5 py-3">
                <span
                  className="w-14 shrink-0 text-xs font-medium capitalize"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {layer}
                </span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${rate}%`, background: barColor }}
                  />
                </div>
                <span
                  className="w-10 shrink-0 text-right text-xs tabular-nums font-medium"
                  style={{ color: warn ? "var(--color-warning, #ca8a04)" : "var(--color-text)" }}
                >
                  {rate}%
                </span>
                {warn && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-500" />}
                <Link
                  href={`/lineage?layer=${layer}`}
                  className="shrink-0 text-xs hover:underline"
                  style={{ color: "var(--color-brand)" }}
                >
                  →
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── DQ severity panel ─────────────────────────────────────────────────────────

function DQSeverityPanel({
  failed, warning, loading,
}: { failed: number; warning: number; loading: boolean }) {
  const total = failed + warning;
  const bars: { label: string; count: number; color: string }[] = [
    { label: "Failed", count: failed, color: "var(--color-danger, #dc2626)" },
    { label: "Warning", count: warning, color: "var(--color-warning, #ca8a04)" },
  ];

  return (
    <div className="rounded-xl border flex flex-col" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
          <div>
            <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Quality Issues</span>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Failed and warning checks in this period</p>
          </div>
        </div>
        <Link href="/quality" className="text-xs hover:underline" style={{ color: "var(--color-brand)" }}>
          View all →
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3 px-5 py-4">
          {[1, 2].map((i) => <div key={i} className="h-6 rounded animate-pulse" style={{ background: "var(--color-border)" }} />)}
        </div>
      ) : total === 0 ? (
        <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
          No quality issues in this period.
        </p>
      ) : (
        <ul className="flex flex-col divide-y" style={{ borderColor: "var(--color-border)" }}>
          {bars.map(({ label, count, color }) => (
            <li key={label} className="flex items-center gap-3 px-5 py-3">
              <span className="w-14 shrink-0 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>{label}</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: total > 0 ? `${Math.round((count / total) * 100)}%` : "0%", background: color }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-xs tabular-nums font-semibold" style={{ color }}>
                {count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Open incidents panel ──────────────────────────────────────────────────────

function OpenIncidentsPanel() {
  const { data: open = [], isLoading } = useIncidents({ status: "open" });
  const { data: inProgress = [], isLoading: inProgressLoading } = useIncidents({ status: "in_progress" });

  const combined = [...open, ...inProgress].slice(0, 5);
  const loading = isLoading || inProgressLoading;

  return (
    <div className="rounded-xl border flex flex-col" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
          <div>
            <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Open Incidents</span>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Unresolved trust issues</p>
          </div>
        </div>
        <Link href="/incidents" className="text-xs hover:underline" style={{ color: "var(--color-brand)" }}>
          View all →
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 px-5 py-4">
          {[1, 2].map((i) => <div key={i} className="h-8 rounded animate-pulse" style={{ background: "var(--color-border)" }} />)}
        </div>
      ) : combined.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
          No open incidents.
        </p>
      ) : (
        <ul className="flex flex-col divide-y" style={{ borderColor: "var(--color-border)" }}>
          {combined.map((inc) => {
            const SEV_COLOR: Record<string, string> = { critical: "#b91c1c", high: "#c2410c", medium: "#a16207", low: "#0369a1" };
            const sevColor = SEV_COLOR[inc.severity] ?? "var(--color-text-muted)";
            return (
              <li key={inc.id}>
                <Link
                  href="/incidents"
                  className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--color-surface-subtle)] transition-colors"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" style={{ color: sevColor }} />
                  <span className="flex-1 min-w-0 truncate text-sm" style={{ color: "var(--color-text)" }}>
                    {inc.title}
                  </span>
                  <span className="shrink-0 text-xs capitalize" style={{ color: sevColor }}>{inc.severity}</span>
                  <span className="shrink-0 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {relativeTime(inc.created_at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Recent runs panel ─────────────────────────────────────────────────────────

function RecentRunsPanel({ runs, loading }: { runs: RunSummary[]; loading: boolean }) {
  return (
    <div className="rounded-xl border flex flex-col" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
          <div>
            <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Recent Runs</span>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Activity in this period</p>
          </div>
        </div>
        <Link href="/runs" className="text-xs hover:underline" style={{ color: "var(--color-brand)" }}>
          View all →
        </Link>
      </div>

      {loading ? (
        <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      ) : runs.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>No runs found in this period.</p>
      ) : (
        <ul>
          {runs.map((run, i) => {
            const rid = String(run.run_id ?? "");
            const status = String(run.status ?? "UNKNOWN");
            return (
              <li key={rid || i} className="border-b last:border-0" style={{ borderColor: "var(--color-border)" }}>
                <Link
                  href={rid ? `/runs/${encodeURIComponent(rid)}` : "/runs"}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--color-surface-subtle)]"
                >
                  <span className={cn("inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium", statusColor(status))}>
                    {statusIcon(status)} {status}
                  </span>
                  <span className="flex-1 min-w-0 truncate font-mono text-xs" style={{ color: "var(--color-text)" }}>
                    {String(run.task_name ?? run.job_name ?? rid)}
                  </span>
                  {!!run.started_at && (
                    <span className="shrink-0 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {relativeTime(String(run.started_at))}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Hub ───────────────────────────────────────────────────────────────────────

export function HealthOverview() {
  const { from, to, preset, setRange, setPreset } = useDateRange({
    scope: "monitor:overview",
    defaultPreset: "7d",
  });
  const { data: healthRes, isLoading: healthLoading } = useEstateHealth({ from, to });
  const { data: runsRes, isLoading: runsLoading } = useRuns({ from, to, limit: 10 });

  const health = healthRes?.data as Record<string, unknown> | undefined;
  const runs = (runsRes?.data ?? []) as RunSummary[];
  const layerHealth = (health?.layer_health ?? []) as Array<{ layer: string; run_count: number; success_count: number; success_rate: number }>;

  const h = (key: string): string | number => health != null ? (health[key] as string | number) ?? "—" : "—";
  const n = (key: string): number => Number(health?.[key] ?? 0);

  const metrics: MetricItem[] = [
    {
      label: "Runs",
      value: h("run_count"),
      href: "/runs",
      loading: healthLoading,
    },
    {
      label: "Failed checks",
      value: h("issue_count"),
      href: "/quality",
      loading: healthLoading,
      accent: n("issue_count") > 0 ? "var(--color-danger, #dc2626)" : undefined,
      dim: !healthLoading && n("issue_count") === 0,
    },
    {
      label: "Pass rate",
      value: health?.dq_pass_rate != null ? `${health.dq_pass_rate}%` : "—",
      href: "/quality",
      loading: healthLoading,
      accent: health?.dq_pass_rate != null && n("dq_pass_rate") < 80
        ? "var(--color-warning, #ca8a04)"
        : "var(--color-success, #16a34a)",
    },
    {
      label: "Open incidents",
      value: h("open_incident_count"),
      href: "/incidents",
      loading: healthLoading,
      accent: n("open_incident_count") > 0 ? "var(--color-danger, #dc2626)" : undefined,
      dim: !healthLoading && n("open_incident_count") === 0,
    },
    {
      label: "Critical",
      value: h("critical_incident_count"),
      href: "/incidents",
      loading: healthLoading,
      accent: n("critical_incident_count") > 0 ? "var(--color-danger, #dc2626)" : undefined,
      dim: !healthLoading && n("critical_incident_count") === 0,
    },
    {
      label: "Warnings",
      value: h("warning_count"),
      href: "/quality",
      loading: healthLoading,
      accent: n("warning_count") > 0 ? "var(--color-warning, #ca8a04)" : undefined,
      dim: !healthLoading && n("warning_count") === 0,
    },
  ];

  return (
    <div className="page-content flex flex-col gap-5 overflow-x-hidden">
      {/* Date picker + last-run context */}
      <div className="flex flex-col gap-2 pt-3 lg:flex-row lg:items-center lg:justify-between">
        {health?.last_run_at != null && (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Last run {relativeTime(String(health.last_run_at))}
          </p>
        )}
        <DateRangePicker
          from={from}
          to={to}
          preset={preset}
          onChange={setRange}
          onPresetChange={setPreset}
          className="w-full lg:w-auto lg:ml-auto"
        />
      </div>

      {/* 6-metric strip */}
      <MetricStrip metrics={metrics} />

      {/* Two-column panels */}
      <div className="grid gap-5 lg:grid-cols-2">
        <RecentRunsPanel runs={runs} loading={runsLoading} />
        <LayerHealthPanel rows={layerHealth} loading={healthLoading} />
        <OpenIncidentsPanel />
        <DQSeverityPanel
          failed={Number(health?.issue_count ?? 0)}
          warning={Number(health?.warning_count ?? 0)}
          loading={healthLoading}
        />
      </div>
    </div>
  );
}
