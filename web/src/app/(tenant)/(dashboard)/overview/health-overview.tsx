"use client";

import { useEstateHealth, useDataProducts } from "@/hooks/use-data-products";
import { useRuns } from "@/hooks/use-runs";
import { useIncidents } from "@/hooks/use-incidents";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Package,
  Boxes,
  TrendingUp,
  Clock,
  ClipboardList,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const statusIcon = (s: string) => {
  switch (s) {
    case "SUCCESS":  return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
    case "FAILED":   return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case "WARNING":  return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
    case "RUNNING":  return <Clock className="h-3.5 w-3.5 text-blue-500" />;
    default:         return <HelpCircle className="h-3.5 w-3.5 text-gray-400" />;
  }
};

const statusColor = (s: string) =>
  ({
    SUCCESS: "bg-green-100 text-green-700",
    FAILED:  "bg-red-100 text-red-700",
    WARNING: "bg-yellow-100 text-yellow-700",
    RUNNING: "bg-blue-100 text-blue-700",
  }[s] ?? "bg-gray-100 text-gray-500");

const productHealthColor = (s: string) =>
  ({
    SUCCESS: "var(--color-success, #16a34a)",
    FAILED:  "var(--color-danger, #dc2626)",
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

export function HealthOverview() {
  const { data: healthRes, isLoading: healthLoading } = useEstateHealth();
  const { data: productsRes, isLoading: productsLoading } = useDataProducts();
  const today = new Date().toISOString().split("T")[0]!;
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString().split("T")[0]!;
  const { data: runsRes, isLoading: runsLoading } = useRuns({ from: weekAgo, to: today, limit: 10 });

  const health = healthRes?.data as Record<string, unknown> | undefined;
  const products = (productsRes?.data ?? []) as Array<Record<string, unknown>>;
  const runs = (runsRes?.data ?? []) as Array<Record<string, unknown>>;

  // Operating model data
  const { data: complianceData } = useQuery({
    queryKey: ["compliance"],
    queryFn: () => fetch("/api/compliance").then((r) => r.json())
      .then((b: { data: { verdicts: Array<{ verdict: string }> } }) => b.data),
    staleTime: 60_000,
    retry: 1,
  });
  const { data: incidentData } = useIncidents({ status: "open" });

  const verdicts = complianceData?.verdicts ?? [];
  const compliancePassRate = verdicts.length > 0
    ? Math.round((verdicts.filter((v) => v.verdict === "pass").length / verdicts.length) * 100)
    : null;
  const openIncidents = incidentData != null ? incidentData.length : null;

  const statCards = [
    {
      label: "Data Products",
      value: health?.data_product_count ?? "—",
      icon: Package,
      href: "/products",
    },
    {
      label: "Open Issues",
      value: health?.issue_count ?? "—",
      icon: XCircle,
      href: "/quality",
      accent: Number(health?.issue_count) > 0 ? "var(--color-danger, #dc2626)" : undefined,
    },
    {
      label: "Entities",
      value: health?.entity_count ?? "—",
      icon: Boxes,
      href: "/catalog",
    },
    {
      label: "DQ Pass Rate",
      value: health?.dq_pass_rate != null ? `${health.dq_pass_rate}%` : "—",
      icon: TrendingUp,
      href: "/quality",
      accent: Number(health?.dq_pass_rate) < 80 ? "var(--color-warning, #ca8a04)" : undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-6" style={{ padding: "var(--spacing-page, 24px)" }}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--color-text)" }}>
          Estate Health
        </h1>
        {!!health?.last_run_at && (
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Last run {relativeTime(String(health.last_run_at))}
          </p>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, href, accent }) => (
          <Link
            key={label}
            href={href}
            className="rounded-xl border p-5 flex flex-col gap-2 hover:shadow-sm transition-shadow"
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
              style={{ color: healthLoading ? "var(--color-text-muted)" : (accent ?? "var(--color-text)") }}
            >
              {healthLoading ? "…" : String(value)}
            </span>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Data products */}
        <div className="rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Data Products</span>
            </div>
            <Link href="/products" className="text-xs hover:underline" style={{ color: "var(--color-brand)" }}>
              View all →
            </Link>
          </div>
          {productsLoading ? (
            <p className="px-5 py-8 text-sm text-center" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
          ) : products.length === 0 ? (
            <p className="px-5 py-8 text-sm text-center" style={{ color: "var(--color-text-muted)" }}>
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
                    className="flex items-center gap-3 px-5 py-3 border-b last:border-0"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: productHealthColor(hs) }}
                    />
                    <span className="flex-1 text-sm truncate" style={{ color: "var(--color-text)" }}>
                      {String(p.display_name ?? id)}
                    </span>
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {ec} {ec === 1 ? "entity" : "entities"}
                    </span>
                    <Link
                      href={`/products/${encodeURIComponent(id)}`}
                      className="text-xs hover:underline shrink-0"
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

        {/* Recent runs */}
        <div className="rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Recent Runs</span>
            </div>
            <Link href="/runs" className="text-xs hover:underline" style={{ color: "var(--color-brand)" }}>
              View all →
            </Link>
          </div>
          {runsLoading ? (
            <p className="px-5 py-8 text-sm text-center" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
          ) : runs.length === 0 ? (
            <p className="px-5 py-8 text-sm text-center" style={{ color: "var(--color-text-muted)" }}>
              No runs yet.
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
                      className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--color-surface-subtle)] transition-colors"
                    >
                      <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded shrink-0", statusColor(status))}>
                        {statusIcon(status)} {status}
                      </span>
                      <span className="flex-1 min-w-0 flex flex-col">
                        <span className="font-mono text-xs truncate" style={{ color: "var(--color-text)" }}>
                          {String(run.job_name ?? run.step ?? rid)}
                        </span>
                        {!!(run.job_name && run.step) && (
                          <span className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                            {String(run.step)}
                          </span>
                        )}
                      </span>
                      {!!run.started_at && (
                        <span className="text-xs shrink-0" style={{ color: "var(--color-text-muted)" }}>
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

      {/* Operating model */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-muted)" }}>
          Operating model
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <Link href="/compliance"
            className="rounded-xl p-4 flex items-center gap-3 hover:shadow-sm transition-shadow"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <ClipboardList className="h-5 w-5 shrink-0" style={{ color: "var(--color-brand)" }} />
            <div>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Policy pass rate</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: "var(--color-text)" }}>
                {compliancePassRate !== null ? `${compliancePassRate}%` : "—"}
              </p>
            </div>
          </Link>
          <Link href="/incidents"
            className="rounded-xl p-4 flex items-center gap-3 hover:shadow-sm transition-shadow"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: openIncidents && openIncidents > 0 ? "#dc2626" : "var(--color-text-muted)" }} />
            <div>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Open incidents</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: openIncidents && openIncidents > 0 ? "#dc2626" : "var(--color-text)" }}>
                {openIncidents !== null ? openIncidents : "—"}
              </p>
            </div>
          </Link>
          <Link href="/products"
            className="rounded-xl p-4 flex items-center gap-3 hover:shadow-sm transition-shadow"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <Shield className="h-5 w-5 shrink-0" style={{ color: "var(--color-brand)" }} />
            <div>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Data products</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: "var(--color-text)" }}>
                {productsLoading ? "…" : String(health?.data_product_count ?? products.length)}
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
