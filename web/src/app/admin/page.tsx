"use client";

import React from "react";
import Link from "next/link";
import { useAdminHealth, useAdminAuditLog } from "@/hooks/use-admin";
import {
  Building2,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Clock,
  Database,
  ArrowUpRight,
  Users,
  ClipboardList,
  ActivitySquare,
} from "lucide-react";

function formatRelativeTime(iso: string): string {
  const date = new Date(iso).getTime();
  const now = Date.now();
  const diffSeconds = Math.max(1, Math.floor((now - date) / 1000));

  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function AdminOverviewPage() {
  const { data: health, isLoading: healthLoading } = useAdminHealth();
  const { data: auditData, isLoading: auditLoading } = useAdminAuditLog(10, 0);

  const actionFlows = [
    {
      href: "/admin/installations",
      title: "Tenant Lifecycle",
      text: "Onboard installations, manage environment metadata and rotate ingest credentials.",
      icon: Building2,
    },
    {
      href: "/admin/users",
      title: "Access & Roles",
      text: "Control who can access which tenant and manage admin privilege boundaries.",
      icon: Users,
    },
    {
      href: "/admin/health",
      title: "Reliability",
      text: "Track service health and identify degraded tenants before incidents escalate.",
      icon: ActivitySquare,
    },
    {
      href: "/admin/audit",
      title: "Audit & Compliance",
      text: "Review admin actions across tenants with traceable operational evidence.",
      icon: ClipboardList,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Latero Control Admin</h1>
        <p className="text-slate-600 dark:text-slate-400">
          System overview and operational metrics
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Active Sites */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Active Sites
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                {healthLoading ? "—" : health?.active_installations || 0}
              </p>
            </div>
            <Building2 className="h-8 w-8 text-slate-400 dark:text-slate-600" />
          </div>
        </div>

        {/* Inactive Sites */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Inactive Sites
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-700 dark:text-slate-300">
                {healthLoading ? "—" : health?.inactive_installations || 0}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Archived and hidden from tenant UX
              </p>
            </div>
            <ActivitySquare className="h-8 w-8 text-slate-400 dark:text-slate-500" />
          </div>
        </div>

        {/* Messages 24h */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Messages (24h)
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                {healthLoading ? "—" : (health?.total_messages_24h || 0).toLocaleString()}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-slate-400 dark:text-slate-600" />
          </div>
        </div>
      </div>


      {/* System Health Panel */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Database className="h-5 w-5" />
          System Health
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* PostgreSQL */}
          <div className="rounded border border-slate-100 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                PostgreSQL Connection
              </p>
              {health?.postgres_connection_ok ? (
                <span className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-semibold" style={{backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success-text)'}}>
                  <span className="h-2 w-2 rounded-full bg-current" />
                  OK
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-semibold" style={{backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error-text)'}}>
                  <span className="h-2 w-2 rounded-full bg-current" />
                  ERROR
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Latency: {health?.postgres_latency_ms}ms
            </p>
          </div>

          {/* Error Rate */}
          <div className="rounded border border-slate-100 p-4 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Average Error Rate
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {healthLoading ? "—" : `${(health?.avg_error_rate || 0).toFixed(2)}%`}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Audit Activity */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Clock className="h-5 w-5" />
          Recent Activity
        </h2>

        <div className="mt-4 space-y-3">
          {auditLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : auditData?.logs && auditData.logs.length > 0 ? (
            auditData.logs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded border border-slate-100 p-3 dark:border-slate-800"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {log.action}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {log.resource_type}: {log.resource_id}
                  </p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatRelativeTime(log.created_at)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}
