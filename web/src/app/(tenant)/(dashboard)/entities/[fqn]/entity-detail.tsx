"use client";

import { useEntityDetail, useEntityRuns, useEntityQuality } from "@/hooks/use-entities";
import type { DataQualityCheck } from "@/lib/adapters/types";
import {
  Boxes,
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  ArrowLeft,
  Activity,
  ShieldCheck,
  GitBranch,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const statusIcon = (status: string) => {
  switch (status) {
    case "SUCCESS":  return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
    case "FAILED":   return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case "WARNING":  return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
    default:         return <HelpCircle className="h-3.5 w-3.5 text-gray-400" />;
  }
};

const statusColor = (s: string) => ({
  SUCCESS: "bg-green-100 text-green-700",
  FAILED:  "bg-red-100 text-red-700",
  WARNING: "bg-yellow-100 text-yellow-700",
}[s] ?? "bg-gray-100 text-gray-500");

const CATEGORY_LABELS: Record<string, string> = {
  schema: "Schema", accuracy: "Accuracy", completeness: "Completeness",
  freshness: "Freshness", uniqueness: "Uniqueness",
};

export function EntityDetail({ fqn }: { fqn: string }) {
  const { data: entityData, isLoading, isError } = useEntityDetail(fqn);
  const { data: runsData } = useEntityRuns(fqn, 20);
  const { data: qualityData } = useEntityQuality(fqn);

  const entity = entityData?.data as Record<string, unknown> | undefined;
  const runs   = (runsData?.data ?? []) as Array<Record<string, unknown>>;
  const layers = (entity?.layer_statuses as Array<Record<string, string>>) ?? [];
  const checks = (qualityData?.data ?? []) as DataQualityCheck[];

  const dqByCategory = checks.reduce<Record<string, { total: number; passed: number }>>((acc, c) => {
    const cat = c.check_category ?? "other";
    if (!acc[cat]) acc[cat] = { total: 0, passed: 0 };
    acc[cat]!.total++;
    if (c.check_status === "SUCCESS") acc[cat]!.passed++;
    return acc;
  }, {});
  const dqCategories = Object.entries(dqByCategory);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--color-text-muted)" }}>
        Laden…
      </div>
    );
  }

  if (isError || !entity) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-red-500">Entity niet gevonden.</p>
        <Link href="/entities" className="text-sm hover:underline" style={{ color: "var(--color-brand)" }}>
          ← Terug naar Entities
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ padding: "var(--spacing-page, 24px)", gap: 24 }}>
      {/* Breadcrumb */}
      <Link
        href="/entities"
        className="flex items-center gap-1.5 text-sm w-fit hover:underline"
        style={{ color: "var(--color-text-muted)" }}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Entities
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-lg" style={{ background: "var(--color-surface-subtle)" }}>
          <Boxes className="h-6 w-6" style={{ color: "var(--color-brand)" }} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--color-text)" }}>{fqn}</h1>
          {Boolean(entity.data_product_id) && (
            <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              Product: {String(entity.data_product_id)}
            </p>
          )}
        </div>
      </div>

      {/* Layer status badges */}
      {layers.length > 0 && (
        <div className="rounded-xl border p-5" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>Layer status</h2>
          <div className="flex flex-wrap gap-3">
            {layers.map((ls) => (
              <div
                key={ls.layer}
                className="flex items-center gap-2 rounded-lg border px-4 py-3 min-w-32"
                style={{ borderColor: "var(--color-border)", background: "var(--color-surface-subtle)" }}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                    {ls.layer}
                  </span>
                  <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded", statusColor(ls.latest_status))}>
                    {statusIcon(ls.latest_status)} {ls.latest_status}
                  </span>
                  {ls.latest_run_at && (
                    <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                      {new Date(ls.latest_run_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent runs */}
      <div className="rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <Activity className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Recente runs</h2>
        </div>
        {runs.length === 0 ? (
          <p className="px-5 py-8 text-sm text-center" style={{ color: "var(--color-text-muted)" }}>
            Geen runs gevonden
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <th className="text-left px-5 py-2.5 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Status</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Step</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Gestart</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Duur</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run, i) => {
                const runId = String(run.run_id ?? "");
                return (
                  <tr
                    key={runId || i}
                    className="border-b last:border-0 hover:bg-[var(--color-surface-subtle)] cursor-pointer"
                    style={{ borderColor: "var(--color-border)" }}
                    onClick={() => runId && (window.location.href = `/runs/${encodeURIComponent(runId)}`)}
                  >
                    <td className="px-5 py-3">
                      <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded", statusColor(String(run.status ?? "")))}>
                        {statusIcon(String(run.status ?? ""))} {String(run.status ?? "UNKNOWN")}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: "var(--color-text)" }}>
                      {String(run.step ?? "—")}
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {run.started_at ? new Date(String(run.started_at)).toLocaleString() : "—"}
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {run.duration_ms != null ? `${Math.round(Number(run.duration_ms) / 1000)}s` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* DQ Summary (last 7 days) */}
      {dqCategories.length > 0 && (
        <div className="rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Data Quality (7 days)</h2>
            </div>
            <Link
              href={`/quality?entity_fqn=${encodeURIComponent(fqn)}`}
              className="text-xs hover:underline"
              style={{ color: "var(--color-brand)" }}
            >
              View all checks →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-px" style={{ background: "var(--color-border)" }}>
            {dqCategories.map(([cat, { total, passed }]) => {
              const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
              const failed = total - passed;
              return (
                <div
                  key={cat}
                  className="flex flex-col gap-1.5 px-4 py-3"
                  style={{ background: "var(--color-surface)" }}
                >
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                    {CATEGORY_LABELS[cat] ?? cat}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-surface-subtle)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: pct === 100 ? "var(--color-success, #16a34a)" : pct >= 70 ? "var(--color-warning, #ca8a04)" : "var(--color-danger, #dc2626)" }}
                      />
                    </div>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--color-text)" }}>{pct}%</span>
                  </div>
                  <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                    {passed}/{total} passed{failed > 0 ? ` · ${failed} failed` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lineage shortcut */}
      <Link
        href={`/lineage?entity_fqn=${encodeURIComponent(fqn)}`}
        className="flex items-center gap-3 rounded-xl border px-5 py-4 hover:shadow-sm transition-shadow"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <GitBranch className="h-4 w-4 shrink-0" style={{ color: "var(--color-brand)" }} />
        <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>View lineage for {fqn}</span>
        <span className="ml-auto text-xs" style={{ color: "var(--color-text-muted)" }}>→</span>
      </Link>
    </div>
  );
}
