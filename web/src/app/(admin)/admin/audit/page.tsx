"use client";

import React, { useState } from "react";
import { Activity } from "lucide-react";
import { useAdminAuditLog, useAdminUsers } from "@/hooks/use-admin";
import { AdminPageHeader, AdminSectionTitle, AdminSurface } from "@/components/admin/admin-ui";

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

function formatExactTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AdminAuditPage() {
  const [page, setPage] = useState(0);
  const limit = 50;
  const offset = page * limit;
  const { data, isLoading } = useAdminAuditLog(limit, offset);
  const { data: usersData } = useAdminUsers();

  const userMap = React.useMemo(() => {
    if (!usersData?.users) return {};
    const map: Record<string, string> = {};
    for (const user of usersData.users) map[user.user_id] = user.email;
    return map;
  }, [usersData]);

  const logs = data?.logs ?? [];
  const from = offset + 1;
  const to = offset + logs.length;
  const hasNext = logs.length === limit;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Audit evidence"
        title="Audit log"
      />

      <AdminSurface className="p-5 md:p-6">
        <AdminSectionTitle title="Audit log" />

        {isLoading ? (
          <div className="py-10 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
            Loading audit history…
          </div>
        ) : logs.length > 0 ? (
          <>
            <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--color-border)" }}>
              <table className="w-full min-w-[980px] text-sm">
                <thead style={{ background: "var(--color-surface)" }}>
                  <tr>
                    {["Time", "User", "Action", "Resource", "Resource ID", "IP", "User Agent"].map((label) => (
                      <th
                        key={label}
                        className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em]"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                      <td
                        className="px-4 py-3 whitespace-nowrap text-xs"
                        style={{ color: "var(--color-text-muted)" }}
                        title={formatExactTime(log.created_at)}
                      >
                        {formatRelativeTime(log.created_at)}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--color-text)" }}>
                        {userMap[log.admin_user_id] ?? log.admin_user_id}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--color-text)" }}>{log.action}</td>
                      <td className="px-4 py-3" style={{ color: "var(--color-text-muted)" }}>{log.resource_type}</td>
                      <td className="px-4 py-3" style={{ color: "var(--color-text-muted)" }}>{log.resource_id ?? "—"}</td>
                      <td className="px-4 py-3" style={{ color: "var(--color-text-muted)" }}>{log.ip_address ?? "—"}</td>
                      <td
                        className="max-w-[240px] truncate px-4 py-3"
                        style={{ color: "var(--color-text-subtle)" }}
                        title={log.user_agent ?? undefined}
                      >
                        {log.user_agent ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Showing {from}–{to} entries
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="rounded-full px-3 py-2 text-sm font-medium disabled:opacity-50"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!hasNext}
                  className="rounded-full px-3 py-2 text-sm font-medium disabled:opacity-50"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="py-14 text-center">
            <Activity className="mx-auto mb-3 h-10 w-10" style={{ color: "var(--color-text-subtle)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No audit log entries yet.</p>
            <p className="mt-1 text-xs" style={{ color: "var(--color-text-subtle)" }}>
              Operator actions will appear here as they occur.
            </p>
          </div>
        )}
      </AdminSurface>
    </div>
  );
}
