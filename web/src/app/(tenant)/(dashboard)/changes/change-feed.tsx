"use client";

import { useState } from "react";
import { GitCommit, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface ChangeEvent {
  id: number;
  installation_id: string;
  entity_id: string | null;
  change_type: string;
  severity: "low" | "medium" | "high" | "critical";
  summary: string;
  diff: Record<string, unknown> | null;
  risk_assessment: Record<string, unknown> | null;
  detected_at: string;
}

const SEVERITY_STYLE: Record<string, { bg: string; text: string; Icon: React.ElementType }> = {
  critical: { bg: "#fee2e2", text: "#b91c1c", Icon: AlertCircle },
  high:     { bg: "#ffedd5", text: "#c2410c", Icon: AlertTriangle },
  medium:   { bg: "#fef9c3", text: "#a16207", Icon: AlertTriangle },
  low:      { bg: "#f0f9ff", text: "#0369a1", Icon: Info },
};

const TYPE_LABELS: Record<string, string> = {
  ownership_drift:  "Ownership drift",
  contract_drift:   "Contract drift",
  schema_drift:     "Schema drift",
  statistical_drift:"Statistical drift",
};

async function fetchChanges(params: {
  type?: string;
  severity?: string;
  from?: string;
  limit?: number;
}) {
  const url = new URL("/api/changes", window.location.origin);
  if (params.type) url.searchParams.set("type", params.type);
  if (params.severity) url.searchParams.set("severity", params.severity);
  if (params.from) url.searchParams.set("from", params.from);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to load changes");
  const body = await res.json() as { data: ChangeEvent[] };
  return body.data;
}

function ChangeRow({ event }: { event: ChangeEvent }) {
  const s = SEVERITY_STYLE[event.severity] ?? SEVERITY_STYLE.low;
  const { Icon } = s;
  const label = TYPE_LABELS[event.change_type] ?? event.change_type;
  const when = new Date(event.detected_at).toLocaleString();

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-xl"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: s.text }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: s.text }}>
            {label}
          </span>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
            style={{ background: s.bg, color: s.text }}
          >
            {event.severity}
          </span>
        </div>
        <p className="text-sm mt-0.5 line-clamp-2" style={{ color: "var(--color-text)" }}>
          {event.summary}
        </p>
        {event.entity_id && (
          <span className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Entity: {event.entity_id}
          </span>
        )}
      </div>
      <span className="text-xs whitespace-nowrap flex-shrink-0 mt-0.5" style={{ color: "var(--color-text-muted)" }}>
        {when}
      </span>
    </div>
  );
}

type SeverityFilter = "all" | "critical" | "high" | "medium" | "low";

export function ChangeFeed() {
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [changeType, setChangeType] = useState("");

  const { data: events, isLoading } = useQuery({
    queryKey: ["changes", severity, changeType],
    queryFn: () =>
      fetchChanges({
        severity: severity === "all" ? undefined : severity,
        type: changeType || undefined,
        limit: 100,
      }),
    staleTime: 30_000,
    retry: 1,
  });

  const SEVERITY_FILTERS: { id: SeverityFilter; label: string }[] = [
    { id: "all",      label: "All" },
    { id: "critical", label: "Critical" },
    { id: "high",     label: "High" },
    { id: "medium",   label: "Medium" },
    { id: "low",      label: "Low" },
  ];

  return (
    <div className="page-content flex h-full flex-col overflow-x-hidden">
      <div className="mb-5">
        <h1 className="text-lg font-medium leading-tight" style={{ color: "var(--color-text)" }}>Change Intelligence</h1>
        <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
          Detected drift and change events across your data estate
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 border-b" style={{ borderColor: "var(--color-border)" }}>
          {SEVERITY_FILTERS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSeverity(id)}
              className="px-3 py-2 text-sm font-medium"
              style={{
                color: severity === id ? "var(--color-brand)" : "var(--color-text-muted)",
                borderBottom: severity === id ? "2px solid var(--color-brand)" : "2px solid transparent",
                background: "transparent",
                marginBottom: "-1px",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          value={changeType}
          onChange={(e) => setChangeType(e.target.value)}
          className="text-sm px-2 py-1.5 rounded-lg outline-none"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        >
          <option value="">All change types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
        {isLoading && (
          <p className="text-sm py-4" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
        )}
        {!isLoading && (!events || events.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <GitCommit className="h-8 w-8" style={{ color: "var(--color-text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No change events found.</p>
          </div>
        )}
        {events?.map((e) => <ChangeRow key={e.id} event={e} />)}
      </div>
    </div>
  );
}
