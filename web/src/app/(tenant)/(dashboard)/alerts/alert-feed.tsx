"use client";

import { useState } from "react";
import { Bell, CheckCircle2, EyeOff, Filter } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Alert {
  id: number;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string | null;
  source_id: string | null;
  domain: string | null;
  product_id: string | null;
  status: "open" | "acknowledged" | "resolved" | "suppressed";
  routed_to: string | null;
  routing_rule_id: string | null;
  suppressed_by: number | null;
  digest_batch_id: string | null;
  created_at: string;
}

const SEVERITY_STYLE: Record<string, { bg: string; text: string }> = {
  critical: { bg: "#fee2e2", text: "#b91c1c" },
  high:     { bg: "#ffedd5", text: "#c2410c" },
  medium:   { bg: "#fef9c3", text: "#a16207" },
  low:      { bg: "#f0f9ff", text: "#0369a1" },
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  open:         { bg: "#fee2e2", text: "#b91c1c" },
  acknowledged: { bg: "#fef9c3", text: "#a16207" },
  resolved:     { bg: "#dcfce7", text: "#166534" },
  suppressed:   { bg: "#f1f5f9", text: "#475569" },
};

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

export function AlertFeed() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [severityFilter, setSeverityFilter] = useState<string>("");

  const params = new URLSearchParams();
  if (statusFilter) params.set("status", statusFilter);
  if (severityFilter) params.set("severity", severityFilter);

  const { data, isLoading } = useQuery({
    queryKey: ["alerts", statusFilter, severityFilter],
    queryFn: () =>
      fetch(`/api/alerts?${params.toString()}`)
        .then((r) => r.json())
        .then((b: { data: Alert[] }) => b.data),
    staleTime: 15_000,
    retry: 1,
  });

  const suppressMutation = useMutation({
    mutationFn: (alertId: number) =>
      fetch(`/api/alerts/${alertId}/suppress`, { method: "PUT" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const alerts = data ?? [];
  const openCount = alerts.filter((a) => a.status === "open").length;

  return (
    <div className="flex flex-col h-full" style={{ padding: "var(--spacing-page, 24px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>Alerts</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Alert feed with routing trace and cascade suppression
          </p>
        </div>
        {openCount > 0 && (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: "#fee2e2", color: "#b91c1c" }}>
            {openCount} open
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
        {["", "open", "acknowledged", "resolved", "suppressed"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="text-xs px-3 py-1.5 rounded-full transition-colors"
            style={{
              background: statusFilter === s ? "var(--color-brand)" : "var(--color-surface)",
              color: statusFilter === s ? "#fff" : "var(--color-text-muted)",
              border: "1px solid var(--color-border)",
            }}
          >
            {s || "All"}
          </button>
        ))}
        <span style={{ color: "var(--color-border)" }}>|</span>
        {["", "critical", "high", "medium", "low"].map((s) => (
          <button
            key={s}
            onClick={() => setSeverityFilter(s)}
            className="text-xs px-3 py-1.5 rounded-full transition-colors"
            style={{
              background: severityFilter === s ? "var(--color-brand)" : "var(--color-surface)",
              color: severityFilter === s ? "#fff" : "var(--color-text-muted)",
              border: "1px solid var(--color-border)",
            }}
          >
            {s || "Any severity"}
          </button>
        ))}
      </div>

      {/* Feed */}
      {isLoading && (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      )}
      {!isLoading && alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-2">
          <Bell className="h-8 w-8" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No alerts matching the current filter.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {alerts.map((alert) => {
          const sevStyle = SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.medium;
          const statStyle = STATUS_STYLE[alert.status] ?? STATUS_STYLE.open;
          return (
            <div key={alert.id} className="rounded-xl p-4 flex items-start gap-4"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <div className="flex flex-col gap-1 mt-0.5">
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
                  style={{ background: sevStyle.bg, color: sevStyle.text }}>
                  {alert.severity}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                  style={{ background: statStyle.bg, color: statStyle.text }}>
                  {alert.status}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>{alert.title}</p>
                {alert.message && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{alert.message}</p>
                )}
                <div className="flex flex-wrap gap-3 mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  <span>type: <b>{alert.type}</b></span>
                  {alert.domain && <span>domain: <b>{alert.domain}</b></span>}
                  {alert.product_id && <span>product: <b>{alert.product_id}</b></span>}
                  {alert.routed_to && (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" style={{ color: "#16a34a" }} />
                      routed → <b>{alert.routed_to}</b>
                    </span>
                  )}
                  {alert.digest_batch_id && <span>batch: <b>{alert.digest_batch_id}</b></span>}
                  {alert.suppressed_by && <span>suppressed by incident #{alert.suppressed_by}</span>}
                  <span>{relativeTime(alert.created_at)}</span>
                </div>
              </div>

              {alert.status === "open" && (
                <button
                  onClick={() => suppressMutation.mutate(alert.id)}
                  disabled={suppressMutation.isPending}
                  title="Suppress alert"
                  className="p-1.5 rounded-lg transition-colors hover:opacity-80 disabled:opacity-50"
                  style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)" }}
                >
                  <EyeOff className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
