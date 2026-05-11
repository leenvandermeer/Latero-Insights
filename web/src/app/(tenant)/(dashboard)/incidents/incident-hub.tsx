"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Plus, X } from "lucide-react";
import { useIncidents, useCreateIncident, useUpdateIncident } from "@/hooks/use-incidents";
import type { Incident, CreateIncidentInput } from "@/hooks/use-incidents";

// ── Style maps ────────────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<string, { bg: string; text: string }> = {
  critical: { bg: "#fee2e2", text: "#b91c1c" },
  high:     { bg: "#ffedd5", text: "#c2410c" },
  medium:   { bg: "#fef9c3", text: "#a16207" },
  low:      { bg: "#f0f9ff", text: "#0369a1" },
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  open:        { bg: "#fee2e2", text: "#b91c1c" },
  in_progress: { bg: "#fef9c3", text: "#a16207" },
  resolved:    { bg: "#dcfce7", text: "#166534" },
};

const SOURCE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  manual: { bg: "#e0f2fe", text: "#0369a1", label: "Reported" },
  alert: { bg: "#dcfce7", text: "#166534", label: "Detected" },
  policy_violation: { bg: "#fef3c7", text: "#a16207", label: "Policy" },
};

function Badge({ style, label }: { style: { bg: string; text: string }; label: string }) {
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
      style={{ background: style.bg, color: style.text }}
    >
      {label}
    </span>
  );
}

// ── Create modal ──────────────────────────────────────────────────────────────

function CreateIncidentModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<CreateIncidentInput>({
    title: "",
    severity: "medium",
  });
  const createMutation = useCreateIncident();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await createMutation.mutateAsync(form);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            New issue
          </h2>
          <button onClick={onClose}>
            <X className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>
              Title *
            </label>
            <input
              required
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
              placeholder="Brief description of the issue"
            />
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>
              Issue type
            </label>
            <select
              value={form.source_type ?? "manual"}
              onChange={(e) => setForm((f) => ({ ...f, source_type: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              <option value="manual">Reported issue</option>
              <option value="alert">Detected issue</option>
              <option value="policy_violation">Policy issue</option>
            </select>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>
              Severity
            </label>
            <select
              value={form.severity}
              onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as CreateIncidentInput["severity"] }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>
              Description
            </label>
            <textarea
              value={form.description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              }}
              placeholder="Optional trust or remediation notes…"
            />
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>
              Assigned to
            </label>
            <input
              type="text"
              value={form.assignee ?? form.assigned_to ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value, assigned_to: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
              placeholder="Optional assignee"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm"
              style={{
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-muted)",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--color-brand)", color: "#fff" }}
            >
              {createMutation.isPending ? "Creating…" : "Create issue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Incident row ──────────────────────────────────────────────────────────────

function IncidentRow({ incident }: { incident: Incident }) {
  const updateMutation = useUpdateIncident();
  const [transitioning, setTransitioning] = useState(false);

  const nextStatus: Record<string, "in_progress" | "resolved"> = {
    open: "in_progress",
    in_progress: "resolved",
  };

  const handleAdvance = async () => {
    const next = nextStatus[incident.status];
    if (!next) return;
    setTransitioning(true);
    try {
      await updateMutation.mutateAsync({ id: incident.id, status: next });
    } finally {
      setTransitioning(false);
    }
  };

  const sev = SEVERITY_STYLE[incident.severity] ?? SEVERITY_STYLE.low;
  const sts = STATUS_STYLE[incident.status] ?? STATUS_STYLE.open;
  const when = new Date(incident.opened_at ?? incident.created_at).toLocaleDateString();
  const source = SOURCE_STYLE[incident.source_type ?? "manual"] ?? SOURCE_STYLE.manual;

  const StatusIcon =
    incident.status === "resolved"
      ? CheckCircle2
      : incident.status === "in_progress"
      ? Clock
      : AlertTriangle;

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <StatusIcon className="h-4 w-4 flex-shrink-0" style={{ color: sev.text }} />

      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block" style={{ color: "var(--color-text)" }}>
          {incident.title}
        </span>
        {(incident.assignee ?? incident.assigned_to) && (
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            → {incident.assignee ?? incident.assigned_to}
          </span>
        )}
      </div>

      <Badge style={{ bg: source.bg, text: source.text }} label={source.label} />
      <Badge style={sev} label={incident.severity} />
      <Badge style={sts} label={incident.status.replace("_", " ")} />

      <span className="text-xs whitespace-nowrap" style={{ color: "var(--color-text-muted)" }}>
        {when}
      </span>

      {incident.status !== "resolved" && (
        <button
          onClick={handleAdvance}
          disabled={transitioning}
          className="text-xs px-2 py-1 rounded-lg whitespace-nowrap disabled:opacity-50 transition-opacity"
          style={{
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          {incident.status === "open" ? "Start" : "Resolve"}
        </button>
      )}
    </div>
  );
}

// ── Hub ───────────────────────────────────────────────────────────────────────

type Filter = "all" | "open" | "in_progress" | "resolved";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all",         label: "All" },
  { id: "open",        label: "Open" },
  { id: "in_progress", label: "In Progress" },
  { id: "resolved",    label: "Resolved" },
];

export function IncidentHub() {
  const [filter, setFilter] = useState<Filter>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<"all" | "manual" | "alert" | "policy_violation">("all");

  const { data: incidents, isLoading } = useIncidents({
    status: filter === "all" ? undefined : filter,
  });

  const visibleIncidents = (incidents ?? []).filter((incident) =>
    sourceFilter === "all" ? true : (incident.source_type ?? "manual") === sourceFilter
  );

  const stats = {
    open: incidents?.filter((i) => i.status === "open").length ?? 0,
    in_progress: incidents?.filter((i) => i.status === "in_progress").length ?? 0,
    resolved: incidents?.filter((i) => i.status === "resolved").length ?? 0,
    critical: incidents?.filter((i) => i.severity === "critical" && i.status !== "resolved").length ?? 0,
  };

  return (
    <div className="page-content flex h-full flex-col overflow-x-hidden">
      <div className="mb-6 flex items-center justify-end gap-4 pt-3">
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
          style={{ background: "var(--color-brand)", color: "#fff" }}
        >
          <Plus className="h-3.5 w-3.5" />
          New issue
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Open", value: stats.open, color: "#b91c1c" },
          { label: "In Progress", value: stats.in_progress, color: "#a16207" },
          { label: "Resolved", value: stats.resolved, color: "#166534" },
          { label: "Critical", value: stats.critical, color: "#b91c1c" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl p-4 flex flex-col gap-1"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</span>
            <span className="text-2xl font-bold tabular-nums" style={{ color }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 border-b" style={{ borderColor: "var(--color-border)" }}>
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className="px-3 py-2 text-sm font-medium"
            style={{
              color: filter === id ? "var(--color-brand)" : "var(--color-text-muted)",
              borderBottom: filter === id ? "2px solid var(--color-brand)" : "2px solid transparent",
              background: "transparent",
              marginBottom: "-1px",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {[
          { id: "all", label: "All issues" },
          { id: "manual", label: "Reported" },
          { id: "alert", label: "Detected" },
          { id: "policy_violation", label: "Policy" },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setSourceFilter(id as typeof sourceFilter)}
            className="rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{
              background: sourceFilter === id ? "var(--color-brand)" : "var(--color-surface)",
              color: sourceFilter === id ? "#fff" : "var(--color-text-muted)",
              border: sourceFilter === id ? "none" : "1px solid var(--color-border)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
        {isLoading && (
          <p className="text-sm py-4" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
        )}
        {!isLoading && visibleIncidents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <CheckCircle2 className="h-8 w-8" style={{ color: "var(--color-text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No issues found.</p>
          </div>
        )}
        {visibleIncidents.map((inc) => <IncidentRow key={inc.id} incident={inc} />)}
      </div>

      {showCreate && <CreateIncidentModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
