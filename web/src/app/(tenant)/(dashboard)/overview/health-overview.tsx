"use client";

import { useEstateHealth, useDataProducts } from "@/hooks/use-data-products";
import { useRuns } from "@/hooks/use-runs";
import { useDateRange } from "@/hooks/use-date-range";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Calendar,
  CheckCircle,
  Clock,
  HelpCircle,
  Package,
  TrendingUp,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "@/components/ui";

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
  ({
    SUCCESS: "bg-green-100 text-green-700",
    FAILED: "bg-red-100 text-red-700",
    WARNING: "bg-yellow-100 text-yellow-700",
    RUNNING: "bg-blue-100 text-blue-700",
  }[s] ?? "bg-gray-100 text-gray-500");

const productHealthColor = (s: string) =>
  ({
    SUCCESS: "var(--color-success, #16a34a)",
    FAILED: "var(--color-danger, #dc2626)",
    WARNING: "var(--color-warning, #ca8a04)",
  }[s] ?? "var(--color-text-muted)");

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

type CardConfig = {
  label: string;
  value: unknown;
  href: string;
  helper: string;
  accent?: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
};

function MetricCard({
  label,
  value,
  href,
  helper,
  accent,
  icon: Icon,
  loading,
}: CardConfig & { loading: boolean }) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-xl border p-5 transition-shadow hover:shadow-sm"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
          {label}
        </span>
        <Icon className="h-4 w-4" style={{ color: accent ?? "var(--color-text-muted)" }} />
      </div>
      <span
        className="text-3xl font-bold tabular-nums"
        style={{ color: loading ? "var(--color-text-muted)" : accent ?? "var(--color-text)" }}
      >
        {loading ? "…" : String(value)}
      </span>
      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        {helper}
      </span>
    </Link>
  );
}

export function HealthOverview() {
  const { from, to, preset, setRange, setPreset } = useDateRange({
    scope: "monitor:overview",
    defaultPreset: "7d",
  });
  const { data: healthRes, isLoading: healthLoading } = useEstateHealth({ from, to });
  const { data: productsRes, isLoading: productsLoading } = useDataProducts();
  const { data: runsRes, isLoading: runsLoading } = useRuns({ from, to, limit: 10 });

  const health = healthRes?.data as Record<string, unknown> | undefined;
  const products = (productsRes?.data ?? []) as Array<Record<string, unknown>>;
  const runs = (runsRes?.data ?? []) as Array<Record<string, unknown>>;

  const snapshotCards: CardConfig[] = [
    {
      label: "Data Products",
      value: health?.data_product_count ?? "—",
      icon: Package,
      href: "/products",
      helper: "Current registered products",
    },
    {
      label: "Entities",
      value: health?.entity_count ?? "—",
      icon: Boxes,
      href: "/catalog",
      helper: "Current monitored entities",
    },
  ];

  const periodCards: CardConfig[] = [
    {
      label: "Failed Checks",
      value: health?.issue_count ?? "—",
      icon: XCircle,
      href: "/quality",
      helper: "Quality failures in the selected period",
      accent: Number(health?.issue_count) > 0 ? "var(--color-danger, #dc2626)" : undefined,
    },
    {
      label: "Quality pass rate",
      value: health?.dq_pass_rate != null ? `${health.dq_pass_rate}%` : "—",
      icon: TrendingUp,
      href: "/quality",
      helper: "Pass rate in the selected period",
      accent: Number(health?.dq_pass_rate) < 80 ? "var(--color-warning, #ca8a04)" : undefined,
    },
  ];

  return (
    <div className="page-content flex flex-col gap-6 overflow-x-hidden">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {!!health?.last_run_at && (
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Last run {relativeTime(String(health.last_run_at))}
            </p>
          )}
        </div>
        <div className="flex w-full min-w-0 flex-col items-start gap-1 pb-0.5 lg:w-auto lg:items-end">
          <DateRangePicker
            from={from}
            to={to}
            preset={preset}
            onChange={setRange}
            onPresetChange={setPreset}
            className="w-full lg:w-auto"
          />
          <span className="flex max-w-full items-center gap-1 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            <Calendar className="h-3 w-3" />
            Applies to recent runs and quality signals
          </span>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            Current overview
          </h2>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Live inventory metrics that do not change with the date picker.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {snapshotCards.map((card) => (
            <MetricCard key={card.label} {...card} loading={healthLoading} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            This period
          </h2>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Metrics and activity that respond to the chosen date range.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {periodCards.map((card) => (
            <MetricCard key={card.label} {...card} loading={healthLoading} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
              <div>
                <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                  Data Products
                </span>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Current inventory snapshot
                </p>
              </div>
            </div>
            <Link href="/products" className="text-xs hover:underline" style={{ color: "var(--color-brand)" }}>
              View all →
            </Link>
          </div>
          {productsLoading ? (
            <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
              Loading…
            </p>
          ) : products.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
              No data products yet. Push events to get started.
            </p>
          ) : (
            <ul>
              {products.slice(0, 8).map((p) => {
                const id = String(p.data_product_id ?? "");
                const hs = String(p.health_status ?? "UNKNOWN");
                const ec = Number(p.entity_count ?? 0);
                return (
                  <li
                    key={id}
                    className="flex items-center gap-3 border-b px-5 py-3 last:border-0"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: productHealthColor(hs) }} />
                    <span className="flex-1 truncate text-sm" style={{ color: "var(--color-text)" }}>
                      {String(p.display_name ?? id)}
                    </span>
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {ec} {ec === 1 ? "entity" : "entities"}
                    </span>
                    <Link
                      href={`/products/${encodeURIComponent(id)}`}
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

        <div className="rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
              <div>
                <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                  Recent Runs
                </span>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Activity in this period
                </p>
              </div>
            </div>
            <Link href="/runs" className="text-xs hover:underline" style={{ color: "var(--color-brand)" }}>
              View all →
            </Link>
          </div>
          {runsLoading ? (
            <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
              Loading…
            </p>
          ) : runs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
              No runs found in this period.
            </p>
          ) : (
            <ul>
              {runs.map((run, i) => {
                const rid = String(run.run_id ?? "");
                const status = String(run.status ?? "UNKNOWN");
                return (
                  <li key={rid || i} className="border-b last:border-0" style={{ borderColor: "var(--color-border)" }}>
                    <Link
                      href={rid ? `/runs/${encodeURIComponent(rid)}` : "/runs"}
                      className="flex flex-col gap-2 px-5 py-3 transition-colors hover:bg-[var(--color-surface-subtle)] sm:flex-row sm:items-center"
                    >
                      <span className={cn("inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium", statusColor(status))}>
                        {statusIcon(status)} {status}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-mono text-xs" style={{ color: "var(--color-text)" }}>
                          {String(run.job_name ?? run.step ?? rid)}
                        </span>
                        {!!(run.job_name && run.step) && (
                          <span className="truncate text-xs" style={{ color: "var(--color-text-muted)" }}>
                            {String(run.step)}
                          </span>
                        )}
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
      </div>
    </div>
  );
}
