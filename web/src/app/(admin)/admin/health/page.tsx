"use client";

import Link from "next/link";
import { ActivitySquare, AlertCircle, CheckCircle, Database, RefreshCw, XCircle } from "lucide-react";
import { useAdminHealth, useAdminInstallations } from "@/hooks/use-admin";
import { AdminPageHeader, AdminSectionTitle, AdminStatCard, AdminSurface } from "@/components/admin/admin-ui";

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={
        ok
          ? { background: "var(--color-success-bg)", color: "var(--color-success-text)" }
          : { background: "var(--color-error-bg)", color: "var(--color-error-text)" }
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
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Platform health"
        title="Platform health"
        actions={
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Connected" value={isLoading ? "—" : health?.connected ?? 0} meta="Healthy tenant connections" />
        <AdminStatCard label="Degraded" value={isLoading ? "—" : health?.degraded ?? 0} meta="Tenants with partial platform health" />
        <AdminStatCard label="Offline" value={isLoading ? "—" : health?.offline ?? 0} meta="Tenants that need operator attention" />
        <AdminStatCard label="Unknown" value={isLoading ? "—" : health?.unknown ?? 0} meta="Tenants without enough health evidence" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <AdminSurface className="p-5 md:p-6">
          <AdminSectionTitle title="Infrastructure" />
          <div className="grid gap-3">
            <div className="rounded-2xl border p-4" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>PostgreSQL</p>
                  <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Latency {isLoading ? "—" : `${health?.postgres_latency_ms ?? "—"}ms`}
                  </p>
                </div>
                {isLoading ? (
                  <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>—</span>
                ) : (
                  <StatusBadge ok={health?.postgres_connection_ok ?? false} label={health?.postgres_connection_ok ? "Connected" : "Error"} />
                )}
              </div>
            </div>

            <div className="rounded-2xl border p-4" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Average error rate</p>
              <p className="mt-2 text-3xl font-semibold" style={{ color: "var(--color-text)" }}>
                {isLoading ? "—" : `${(health?.avg_error_rate ?? 0).toFixed(2)}%`}
              </p>
            </div>
          </div>
        </AdminSurface>

        <AdminSurface className="p-5 md:p-6">
          <AdminSectionTitle title="Attention required" />
          {degraded.length === 0 && offline.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              No degraded or offline tenants right now.
            </p>
          ) : (
            <div className="space-y-3">
              {[...offline, ...degraded].map((inst) => (
                <div
                  key={inst.installation_id}
                  className="flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between"
                  style={{
                    borderColor: inst.status === "offline" ? "var(--color-error)" : "var(--color-warning)",
                    background: inst.status === "offline" ? "var(--color-error-bg)" : "var(--color-warning-bg)",
                  }}
                >
                  <div>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: inst.status === "offline" ? "var(--color-error-text)" : "var(--color-warning-text)" }}
                    >
                      {inst.label ?? inst.installation_id}
                    </p>
                    <p
                      className="mt-1 text-xs"
                      style={{ color: inst.status === "offline" ? "var(--color-error-text)" : "var(--color-warning-text)" }}
                    >
                      {inst.installation_id} · {inst.status}
                    </p>
                  </div>
                  <Link
                    href={`/admin/installations/${inst.installation_id}`}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold"
                    style={{
                      border: `1px solid ${inst.status === "offline" ? "var(--color-error-text)" : "var(--color-warning-text)"}`,
                      color: inst.status === "offline" ? "var(--color-error-text)" : "var(--color-warning-text)",
                    }}
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    Open tenant
                  </Link>
                </div>
              ))}
            </div>
          )}
        </AdminSurface>
      </div>

      {health && (
        <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          Last updated {new Date(health.timestamp).toLocaleString()}
        </p>
      )}
    </div>
  );
}
