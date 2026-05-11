"use client";

import Link from "next/link";
import {
  ActivitySquare,
  Building2,
  ClipboardList,
  Database,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { useAdminAuditLog, useAdminHealth } from "@/hooks/use-admin";
import {
  AdminActionCard,
  AdminPageHeader,
  AdminSectionTitle,
  AdminStatCard,
  AdminSurface,
} from "@/components/admin/admin-ui";

function formatRelativeTime(iso: string): string {
  const date = new Date(iso).getTime();
  const now = Date.now();
  const diffSeconds = Math.max(1, Math.floor((now - date) / 1000));

  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function AdminOverviewPage() {
  const { data: health, isLoading: healthLoading } = useAdminHealth();
  const { data: auditData, isLoading: auditLoading } = useAdminAuditLog(10, 0);

  const actionFlows = [
    {
      href: "/admin/installations",
      title: "Workspace lifecycle",
      icon: <Building2 className="h-5 w-5" />,
    },
    {
      href: "/admin/users",
      title: "Access and roles",
      icon: <Users className="h-5 w-5" />,
    },
    {
      href: "/admin/health",
      title: "Platform health",
      icon: <ActivitySquare className="h-5 w-5" />,
    },
    {
      href: "/admin/audit",
      title: "Audit evidence",
      icon: <ClipboardList className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Platform overview"
        title="Platform admin"
        actions={
          <>
            <Link
              href="/admin/installations"
              className="rounded-full px-4 py-2.5 text-sm font-semibold"
              style={{ background: "var(--color-brand)", color: "var(--color-text-on-dark)" }}
            >
              Open workspaces
            </Link>
            <Link
              href="/admin/users"
              className="rounded-full px-4 py-2.5 text-sm font-semibold"
              style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            >
              Manage users
            </Link>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Active workspaces"
          value={healthLoading ? "—" : health?.active_installations || 0}
          meta="Workspaces visible in the operational product"
        />
        <AdminStatCard
          label="Inactive workspaces"
          value={healthLoading ? "—" : health?.inactive_installations || 0}
          meta="Archived workspaces hidden from the tenant-facing UX"
        />
        <AdminStatCard
          label="Messages in 24h"
          value={healthLoading ? "—" : (health?.total_messages_24h || 0).toLocaleString()}
          meta="Recent ingest activity across all workspaces"
        />
        <AdminStatCard
          label="Average error rate"
          value={healthLoading ? "—" : `${(health?.avg_error_rate || 0).toFixed(2)}%`}
          meta="Cross-workspace error percentage"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminSurface className="p-5 md:p-6">
          <AdminSectionTitle title="Operator flows" />
          <div className="grid gap-3 md:grid-cols-2">
            {actionFlows.map((flow) => (
              <AdminActionCard key={flow.href} {...flow} />
            ))}
          </div>
        </AdminSurface>

        <AdminSurface className="p-5 md:p-6">
          <AdminSectionTitle title="Infrastructure health" />
          <div className="grid gap-3">
            <div
              className="rounded-2xl border p-4"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                    PostgreSQL connection
                  </p>
                  <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Latency {healthLoading ? "—" : `${health?.postgres_latency_ms ?? "—"}ms`}
                  </p>
                </div>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={
                    health?.postgres_connection_ok
                      ? { background: "var(--color-success-bg)", color: "var(--color-success-text)" }
                      : { background: "var(--color-error-bg)", color: "var(--color-error-text)" }
                  }
                >
                  <Database className="mr-1.5 h-3.5 w-3.5" />
                  {health?.postgres_connection_ok ? "Connected" : "Error"}
                </span>
              </div>
            </div>

            <div
              className="rounded-2xl border p-4"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                    Control posture
                  </p>
                </div>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ background: "var(--color-brand-subtle)", color: "var(--color-brand)" }}
                >
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  Admin plane
                </span>
              </div>
            </div>
          </div>
        </AdminSurface>
      </div>

      <AdminSurface className="p-5 md:p-6">
        <AdminSectionTitle
          title="Recent activity"
          action={
            <Link href="/admin/audit" className="text-sm font-semibold" style={{ color: "var(--color-brand)" }}>
              Open full audit log
            </Link>
          }
        />

        <div className="space-y-3">
          {auditLoading ? (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading activity…</p>
          ) : auditData?.logs?.length ? (
            auditData.logs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                    {log.action}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {log.resource_type}: {log.resource_id}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-subtle)" }}>
                  <TrendingUp className="h-3.5 w-3.5" />
                  {formatRelativeTime(log.created_at)}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No recent activity yet.</p>
          )}
        </div>
      </AdminSurface>
    </div>
  );
}
