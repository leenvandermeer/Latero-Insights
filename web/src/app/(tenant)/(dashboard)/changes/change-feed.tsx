"use client";

import { useState } from "react";
import { GitCommit, AlertTriangle, Info, AlertCircle, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

// DB severity vocabulary: informational | significant | breaking
type DbSeverity = "informational" | "significant" | "breaking";
type SeverityFilter = "all" | DbSeverity;

interface Diff {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  affected_fields: string[];
}

interface RiskAssessment {
  level: string;
  affected_outputs: string[];
  recommended_action: string;
}

interface ChangeEvent {
  id: number;
  entity_id: string | null;
  entity_type: string | null;
  change_type: string;
  severity: DbSeverity;
  diff: Diff | null;
  risk_assessment: RiskAssessment | null;
  detected_at: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG: Record<DbSeverity, { bg: string; text: string; Icon: React.ElementType; label: string }> = {
  breaking:      { bg: "#fee2e2", text: "#b91c1c", Icon: AlertCircle,   label: "Breaking" },
  significant:   { bg: "#ffedd5", text: "#c2410c", Icon: AlertTriangle, label: "Significant" },
  informational: { bg: "#f0f9ff", text: "#0369a1", Icon: Info,          label: "Informational" },
};

const TYPE_LABELS: Record<string, string> = {
  ownership_drift:   "Ownership drift",
  contract_drift:    "Contract drift",
  schema_drift:      "Schema drift",
  statistical_drift: "Statistical drift",
  lineage_drift:     "Lineage drift",
};

// ---------------------------------------------------------------------------
// Summary builder — renders meaningful text from diff instead of empty field
// ---------------------------------------------------------------------------

function buildSummary(changeType: string, diff: Diff | null): string {
  if (!diff) return "Change detected.";
  const { before, after, affected_fields } = diff;
  switch (changeType) {
    case "ownership_drift": {
      const prev = (before.owner as string | null) ?? "none";
      const curr = (after.owner as string | null) ?? "none";
      return `Owner changed from "${prev}" to "${curr}".`;
    }
    case "contract_drift": {
      const parts: string[] = [];
      if (affected_fields.includes("sla")) {
        parts.push(`SLA: ${JSON.stringify(before.sla)} → ${JSON.stringify(after.sla)}`);
      }
      if (affected_fields.includes("contract_ver")) {
        parts.push(`Contract version: ${before.contract_ver ?? "none"} → ${after.contract_ver ?? "none"}`);
      }
      return parts.join(" · ") || "Contract terms changed.";
    }
    case "schema_drift": {
      const prev = (before.object_name as string | null) ?? "—";
      const curr = (after.object_name as string | null) ?? "—";
      return `Object name changed from "${prev}" to "${curr}".`;
    }
    case "statistical_drift": {
      const z = (after.z_score as number | null) ?? null;
      const latest = (after.latest_duration_ms as number | null) ?? null;
      const avg = (before.avg_duration_ms as number | null) ?? null;
      if (z !== null && latest !== null && avg !== null) {
        const direction = latest > avg ? "slower" : "faster";
        return `Run duration ${direction} than usual (z-score ${z}, latest ${latest}ms vs avg ${avg}ms).`;
      }
      return "Run duration anomaly detected.";
    }
    default: {
      // lineage_drift: affected_fields = ["added:X", "removed:Y", ...]
      if (changeType === "lineage_drift") {
        const added   = affected_fields.filter(f => f.startsWith("added:")).map(f => f.slice(6));
        const removed = affected_fields.filter(f => f.startsWith("removed:")).map(f => f.slice(8));
        const parts: string[] = [];
        if (added.length)   parts.push(`New upstream: ${added.join(", ")}.`);
        if (removed.length) parts.push(`Upstream removed: ${removed.join(", ")}.`);
        return parts.join(" ") || "Lineage inputs changed.";
      }
      return affected_fields.length > 0
        ? `Changed: ${affected_fields.join(", ")}.`
        : "Change detected.";
    }
  }
}

// ---------------------------------------------------------------------------
// ChangeRow
// ---------------------------------------------------------------------------

function ChangeRow({ event }: { event: ChangeEvent }) {
  const cfg = SEVERITY_CONFIG[event.severity] ?? SEVERITY_CONFIG.informational;
  const { Icon } = cfg;
  const typeLabel = TYPE_LABELS[event.change_type] ?? event.change_type;
  const summary = buildSummary(event.change_type, event.diff);
  const when = new Date(event.detected_at).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const fields = event.diff?.affected_fields ?? [];
  const action = event.risk_assessment?.recommended_action ?? null;

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: cfg.text }} />
          <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
            {typeLabel}
          </span>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: cfg.bg, color: cfg.text }}
          >
            {cfg.label}
          </span>
          {event.entity_id && (
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{ background: "var(--color-surface-subtle)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
            >
              {event.entity_id}
            </span>
          )}
        </div>
        <span className="text-[11px] whitespace-nowrap flex-shrink-0" style={{ color: "var(--color-text-muted)" }}>
          {when}
        </span>
      </div>

      {/* Summary */}
      <p className="text-sm leading-snug" style={{ color: "var(--color-text)" }}>
        {summary}
      </p>

      {/* Affected fields */}
      {fields.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {fields.map((f) => (
            <span
              key={f}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }}
            >
              {f}
            </span>
          ))}
        </div>
      )}

      {/* Recommended action */}
      {action && (
        <div
          className="flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs"
          style={{ background: `${cfg.bg}`, color: cfg.text }}
        >
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          {action}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// API fetch
// ---------------------------------------------------------------------------

// DB severity values for filter queries
const DB_SEVERITY_VALUES: Record<SeverityFilter, string | undefined> = {
  all:           undefined,
  breaking:      "breaking",
  significant:   "significant",
  informational: "informational",
};

async function fetchChanges(params: { type?: string; severity?: string; limit?: number }) {
  const url = new URL("/api/changes", window.location.origin);
  if (params.type)     url.searchParams.set("type",     params.type);
  if (params.severity) url.searchParams.set("severity", params.severity);
  if (params.limit)    url.searchParams.set("limit",    String(params.limit));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to load changes");
  const body = await res.json() as { data: ChangeEvent[] };
  return body.data;
}

// ---------------------------------------------------------------------------
// ChangeFeed
// ---------------------------------------------------------------------------

const SEVERITY_FILTERS: { id: SeverityFilter; label: string }[] = [
  { id: "all",           label: "All" },
  { id: "breaking",      label: "Breaking" },
  { id: "significant",   label: "Significant" },
  { id: "informational", label: "Informational" },
];

export function ChangeFeed() {
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [changeType, setChangeType] = useState("");

  const { data: events, isLoading } = useQuery({
    queryKey: ["changes", severity, changeType],
    queryFn: () =>
      fetchChanges({
        severity: DB_SEVERITY_VALUES[severity],
        type:     changeType || undefined,
        limit:    100,
      }),
    staleTime: 30_000,
    retry: 1,
  });

  return (
    <div className="page-content flex h-full flex-col overflow-x-hidden">
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3 pt-3">
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
