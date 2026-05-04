"use client";

import { useEntityDetail, useEntityRuns } from "@/hooks/use-entities";
import {
  Boxes,
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  ArrowLeft,
  Activity,
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

export function EntityDetail({ fqn }: { fqn: string }) {
  const { data: entityData, isLoading, isError } = useEntityDetail(fqn);
  const { data: runsData } = useEntityRuns(fqn, 20);

  const entity = entityData?.data as Record<string, unknown> | undefined;
  const runs   = (runsData?.data ?? []) as Array<Record<string, unknown>>;
  const layers = (entity?.layer_statuses as Array<Record<string, string>>) ?? [];

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
              {runs.map((run, i) => (
                <tr
                  key={String(run.run_id ?? i)}
                  className="border-b last:border-0"
                  style={{ borderColor: "var(--color-border)" }}
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
