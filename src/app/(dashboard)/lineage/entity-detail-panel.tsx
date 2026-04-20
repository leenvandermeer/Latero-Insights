"use client";

import { X, Table2, Database, ArrowRight, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import type { LineageEntity, LineageAttribute } from "@/lib/adapters/types";

const STATUS_CONFIG: Record<string, { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  SUCCESS: { label: "Success", color: "#10B981", Icon: CheckCircle2 },
  WARNING: { label: "Warning", color: "#F59E0B", Icon: AlertTriangle },
  FAILED:  { label: "Failed",  color: "#EF4444", Icon: XCircle },
  PARTIAL: { label: "Partial", color: "#F59E0B", Icon: AlertTriangle },
  UNKNOWN: { label: "Unknown", color: "var(--color-text-muted)", Icon: Clock },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.UNKNOWN;
  const { Icon } = cfg;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold">
      <span style={{ color: cfg.color }}><Icon className="h-3.5 w-3.5" /></span>
      <span style={{ color: cfg.color }}>{cfg.label}</span>
    </span>
  );
}

interface EntityDetailPanelProps {
  entity: LineageEntity;
  attributes: LineageAttribute[];
  onClose: () => void;
  onNavigateTo?: (entityFqn: string) => void;
}

export function EntityDetailPanel({ entity, attributes, onClose, onNavigateTo }: EntityDetailPanelProps) {
  const parts = entity.entity_fqn.split(".");
  const shortName = parts[parts.length - 1] ?? entity.entity_fqn;

  const outgoing = attributes.filter(
    (a) => a.source_entity_fqn === entity.entity_fqn && a.is_current
  );
  const incoming = attributes.filter(
    (a) => a.target_entity_fqn === entity.entity_fqn && a.is_current
  );

  function formatTs(ts: string | null): string {
    if (!ts) return "—";
    try {
      return new Date(ts).toLocaleString(undefined, {
        month: "short", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return ts;
    }
  }

  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-80 overflow-y-auto z-10"
      style={{ borderLeft: "1px solid var(--color-border)", background: "var(--color-card)" }}
    >
      {/* Header */}
      <div
        className="flex items-start justify-between px-4 py-3 sticky top-0"
        style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-card)", zIndex: 1 }}
      >
        <div className="flex items-start gap-2 min-w-0">
          <Table2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--color-primary)" }} />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate" style={{ color: "var(--color-text)" }} title={entity.entity_fqn}>
              {shortName}
            </p>
            <p className="text-[10px] font-mono truncate mt-0.5" style={{ color: "var(--color-text-muted)" }} title={entity.entity_fqn}>
              {entity.entity_fqn}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 shrink-0 transition-colors hover:bg-muted"
          aria-label="Close"
        >
          <X className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Layer */}
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--color-text-muted)" }}>Layer</dt>
          <dd
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: "rgba(128,128,128,0.1)", color: "var(--color-text)" }}
          >
            {entity.layer || "—"}
          </dd>
        </div>

        {/* Status */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--color-text-muted)" }}>Latest</dt>
            <dd><StatusBadge status={entity.latest_status} /></dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--color-text-muted)" }}>End-to-End</dt>
            <dd><StatusBadge status={entity.end_to_end_status} /></dd>
          </div>
        </div>

        {/* Last success */}
        {entity.latest_success_at && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--color-text-muted)" }}>Last Success</dt>
            <dd className="text-xs" style={{ color: "var(--color-text)" }}>{formatTs(entity.latest_success_at)}</dd>
          </div>
        )}

        {/* Chain */}
        {entity.lineage_group_id && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--color-text-muted)" }}>Chain</dt>
            <dd className="text-xs font-mono break-all" style={{ color: "var(--color-text)" }}>{entity.lineage_group_id}</dd>
            {entity.last_completed_layer && (
              <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                Last completed: <strong style={{ color: "var(--color-text)" }}>{entity.last_completed_layer}</strong>
              </p>
            )}
          </div>
        )}

        {/* Upstream */}
        {entity.upstream_entity_fqns.length > 0 && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--color-text-muted)" }}>
              Upstream ({entity.upstream_entity_fqns.length})
            </dt>
            <dd className="space-y-1">
              {entity.upstream_entity_fqns.map((fqn) => (
                <button
                  key={fqn}
                  onClick={() => onNavigateTo?.(fqn)}
                  className="block w-full text-left text-[11px] font-mono px-2 py-1 rounded-md truncate transition-colors hover:bg-muted"
                  style={{ color: "var(--color-primary)", border: "1px solid var(--color-border)" }}
                  title={fqn}
                >
                  {fqn.split(".").pop() ?? fqn}
                </button>
              ))}
            </dd>
          </div>
        )}

        {/* Downstream */}
        {entity.downstream_entity_fqns.length > 0 && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--color-text-muted)" }}>
              Downstream ({entity.downstream_entity_fqns.length})
            </dt>
            <dd className="space-y-1">
              {entity.downstream_entity_fqns.map((fqn) => (
                <button
                  key={fqn}
                  onClick={() => onNavigateTo?.(fqn)}
                  className="block w-full text-left text-[11px] font-mono px-2 py-1 rounded-md truncate transition-colors hover:bg-muted"
                  style={{ color: "var(--color-accent)", border: "1px solid var(--color-border)" }}
                  title={fqn}
                >
                  {fqn.split(".").pop() ?? fqn}
                </button>
              ))}
            </dd>
          </div>
        )}

        {/* Column lineage */}
        {(outgoing.length > 0 || incoming.length > 0) && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--color-text-muted)" }}>
              Column Lineage
            </dt>
            {outgoing.length > 0 && (
              <div className="space-y-1 mb-2">
                <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "var(--color-text-muted)" }}>Outgoing</p>
                {outgoing.slice(0, 8).map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 text-[10px] rounded-md px-2 py-1"
                    style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                  >
                    <span className="font-mono font-medium truncate max-w-[90px]" style={{ color: "var(--color-accent)" }}>{a.source_attribute}</span>
                    <ArrowRight className="h-3 w-3 shrink-0" style={{ color: "var(--color-text-muted)" }} />
                    <span className="font-mono truncate" style={{ color: "var(--color-text)" }}>{a.target_attribute}</span>
                  </div>
                ))}
                {outgoing.length > 8 && (
                  <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>+{outgoing.length - 8} more</p>
                )}
              </div>
            )}
            {incoming.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "var(--color-text-muted)" }}>Incoming</p>
                {incoming.slice(0, 5).map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 text-[10px] rounded-md px-2 py-1"
                    style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                  >
                    <span className="font-mono truncate max-w-[80px]" style={{ color: "var(--color-text-muted)" }}>{a.source_attribute}</span>
                    <ArrowRight className="h-3 w-3 shrink-0" style={{ color: "var(--color-text-muted)" }} />
                    <span className="font-mono font-medium truncate" style={{ color: "var(--color-accent)" }}>{a.target_attribute}</span>
                  </div>
                ))}
                {incoming.length > 5 && (
                  <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>+{incoming.length - 5} more</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
