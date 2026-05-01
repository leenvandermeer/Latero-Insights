"use client";

import React, { useState } from "react";
import { Activity } from "lucide-react";
import { useAdminAuditLog, useAdminUsers } from "@/hooks/use-admin";

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

function formatExactTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
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
    for (const user of usersData.users) {
      map[user.user_id] = user.email;
    }
    return map;
  }, [usersData]);

  const logs = data?.logs ?? [];
  const from = offset + 1;
  const to = offset + logs.length;
  const hasNext = logs.length === limit;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold text-slate-900 dark:text-white">
          <Activity className="h-8 w-8" />
          Audit Log
        </h1>
        <p className="text-slate-600 dark:text-slate-400">Admin actions across all tenants</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {isLoading ? (
          <div className="p-6 text-center text-slate-500">Loading...</div>
        ) : logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white">Time</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white">User</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white">Action</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white">Resource</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white">Resource ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white">IP</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white">User Agent</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                  >
                    <td
                      className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap cursor-default"
                      title={formatExactTime(log.created_at)}
                    >
                      {formatRelativeTime(log.created_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{userMap[log.admin_user_id] ?? log.admin_user_id}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{log.action}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{log.resource_type}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{log.resource_id ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{log.ip_address ?? "—"}</td>
                    <td
                      className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[200px] truncate"
                      title={log.user_agent ?? undefined}
                    >
                      {log.user_agent ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <Activity className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No audit log entries yet.</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Admin actions will appear here as they occur.</p>
          </div>
        )}
      </div>

      {logs.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing {from}–{to} entries
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={!hasNext}
              className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
