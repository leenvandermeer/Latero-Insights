"use client";

import { useAdminHealth, useAdminInstallations } from "@/hooks/use-admin";
import { ActivitySquare, CheckCircle, AlertCircle, XCircle, Database, RefreshCw } from "lucide-react";

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={ok
        ? { backgroundColor: "var(--color-success-bg)", color: "var(--color-success-text)" }
        : { backgroundColor: "var(--color-error-bg)", color: "var(--color-error-text)" }
      }
    >
      {ok ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

export default function AdminHealthPage() {
  const { data: health, isLoading, refetch, isFetching } = useAdminHealth();
  const { data: installationsData } = useAdminInstallations(0, 200);

  const installations = installationsData?.installations ?? [];
  const degraded = installations.filter((i) => i.status === "degraded");
  const offline = installations.filter((i) => i.status === "offline");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-slate-900 dark:text-white">
            <ActivitySquare className="h-8 w-8" />
            System Health
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Infrastructure status and tenant connectivity
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Infrastructure */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white mb-4">
          <Database className="h-5 w-5" />
          Infrastructure
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded border border-slate-100 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">PostgreSQL</p>
              {isLoading ? (
                <span className="text-xs text-slate-400">—</span>
              ) : (
                <StatusBadge ok={health?.postgres_connection_ok ?? false} label={health?.postgres_connection_ok ? "OK" : "ERROR"} />
              )}
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Latency: {isLoading ? "—" : `${health?.postgres_latency_ms ?? "—"}ms`}
            </p>
          </div>
          <div className="rounded border border-slate-100 p-4 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Avg error rate</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {isLoading ? "—" : `${(health?.avg_error_rate ?? 0).toFixed(2)}%`}
            </p>
          </div>
        </div>
      </div>

      {/* Tenant status summary */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Tenant status</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Connected", value: health?.connected, color: "var(--color-success-text)", bg: "var(--color-success-bg)" },
            { label: "Degraded", value: health?.degraded, color: "var(--color-warning-text)", bg: "var(--color-warning-bg)" },
            { label: "Offline", value: health?.offline, color: "var(--color-error-text)", bg: "var(--color-error-bg)" },
            { label: "Unknown", value: health?.unknown, color: "var(--color-text-muted)", bg: "var(--color-surface-alt)" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="rounded-lg p-4 text-center" style={{ background: bg }}>
              <p className="text-2xl font-bold" style={{ color }}>{isLoading ? "—" : (value ?? 0)}</p>
              <p className="text-xs font-medium mt-1" style={{ color }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Attention required */}
      {(degraded.length > 0 || offline.length > 0) && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white mb-4">
            <AlertCircle className="h-5 w-5" style={{ color: "var(--color-error)" }} />
            Attention required
          </h2>
          <div className="space-y-2">
            {[...offline, ...degraded].map((inst) => (
              <div key={inst.installation_id} className="flex items-center justify-between rounded border p-3"
                style={{
                  borderColor: inst.status === "offline" ? "var(--color-error)" : "var(--color-warning)",
                  background: inst.status === "offline" ? "var(--color-error-bg)" : "var(--color-warning-bg)",
                }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: inst.status === "offline" ? "var(--color-error-text)" : "var(--color-warning-text)" }}>
                    {inst.label ?? inst.installation_id}
                  </p>
                  <p className="text-xs" style={{ color: inst.status === "offline" ? "var(--color-error-text)" : "var(--color-warning-text)", opacity: 0.8 }}>
                    {inst.installation_id} · {inst.status}
                  </p>
                </div>
                <a
                  href={`/admin/installations/${inst.installation_id}`}
                  className="rounded border px-2 py-1 text-xs font-medium hover:opacity-80"
                  style={{ borderColor: inst.status === "offline" ? "var(--color-error-text)" : "var(--color-warning-text)", color: inst.status === "offline" ? "var(--color-error-text)" : "var(--color-warning-text)" }}
                >
                  View
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {health && (
        <p className="text-xs text-slate-400">
          Last updated: {new Date(health.timestamp).toLocaleString()}
        </p>
      )}
    </div>
  );
}
