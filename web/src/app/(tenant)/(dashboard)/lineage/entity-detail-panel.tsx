"use client";

import { X, Table2, ArrowRight, CheckCircle2, AlertTriangle, XCircle, Clock, Columns3 } from "lucide-react";
import type { LineageEntity, LineageAttribute } from "@/lib/adapters/types";
import { lineageNodeLabel, lineageKeyLabel } from "./lineage-utils";

const STATUS_CONFIG: Record<string, { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  SUCCESS: { label: "Success", color: "#10B981", Icon: CheckCircle2 },
  WARNING: { label: "Warning", color: "#F59E0B", Icon: AlertTriangle },
  FAILED:  { label: "Failed",  color: "#EF4444", Icon: XCircle },
  PARTIAL: { label: "Partial", color: "#F59E0B", Icon: AlertTriangle },
  IN_PROGRESS: { label: "In progress", color: "#3B82F6", Icon: Clock },
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
  onNavigateTo?: (entityFqn: string, direction: "upstream" | "downstream") => void;
  onOpenColumns?: (query?: string) => void;
}

export function EntityDetailPanel({ entity, attributes, onClose, onNavigateTo, onOpenColumns }: EntityDetailPanelProps) {
  const datasetLabel = lineageNodeLabel(entity);

  function refMatchesEntity(ref: string): boolean {
    const refLower = ref.toLowerCase();
    const entityLower = entity.name.toLowerCase();
    if (refLower === entityLower || refLower.endsWith(`.${entityLower}`)) return true;

    const refParts = refLower.split(/[/.]/).filter(Boolean);
    const entityParts = entityLower.split(".").filter(Boolean);
    const refLast = refParts.at(-1)?.replace(/_(raw|bronze|silver|gold)$/i, "");
    const entityLast = entityParts.at(-1)?.replace(/_(raw|bronze|silver|gold)$/i, "");
    const entityDataset = entityParts.at(-2);
    return Boolean(refLast && (refLast === entityLast || refLast === entityDataset || refParts.includes(entityLast ?? "")));
  }

  const outgoing = attributes.filter((a) => a.is_current && refMatchesEntity(a.source_name));
  const incoming = attributes.filter((a) => a.is_current && refMatchesEntity(a.target_name));
  const attributePreviewLimit = 14;
  const hasManyAttributes = outgoing.length + incoming.length > attributePreviewLimit;
  const outgoingPreview = hasManyAttributes ? outgoing.slice(0, Math.ceil(attributePreviewLimit / 2)) : outgoing;
  const incomingPreview = hasManyAttributes ? incoming.slice(0, Math.floor(attributePreviewLimit / 2)) : incoming;

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
            <p className="text-sm font-semibold leading-tight truncate" style={{ color: "var(--color-text)" }} title={entity.name}>
              {datasetLabel}
            </p>
            <p className="text-[10px] font-mono truncate mt-0.5" style={{ color: "var(--color-text-muted)" }} title={entity.name}>
              {entity.name}
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
        <section className="rounded-lg p-3" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--color-text-muted)" }}>Layer</dt>
              <dd
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{ background: "rgba(128,128,128,0.1)", color: "var(--color-text)" }}
              >
                {entity.layer || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--color-text-muted)" }}>Last Success</dt>
              <dd className="text-xs" style={{ color: "var(--color-text)" }}>{formatTs(entity.latest_success_at)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--color-text-muted)" }}>Latest</dt>
              <dd><StatusBadge status={entity.latest_status} /></dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--color-text-muted)" }}>End-to-End</dt>
              <dd><StatusBadge status={entity.end_to_end_status} /></dd>
            </div>
          </div>
        </section>

        {/* Chain */}
        {entity.lineage_group_id && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--color-text-muted)" }}>Chain</dt>
            <dd className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>{datasetLabel}</dd>
            {entity.last_completed_layer && (
              <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                Last completed layer: <strong style={{ color: "var(--color-text)" }}>{entity.last_completed_layer}</strong>
              </p>
            )}
          </div>
        )}

        {/* LADR-064: Bronnen (source datasets voor silver/gold entities) */}
        {entity.source_datasets && entity.source_datasets.length > 0 && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--color-text-muted)" }}>
              Fed by ({entity.source_datasets.length})
            </dt>
            <dd className="space-y-1">
              {entity.source_datasets.map((ds) => (
                <div
                  key={ds}
                  className="text-[11px] font-mono px-2 py-1 rounded-md truncate"
                  style={{ color: "var(--color-text-muted)", border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
                  title={ds}
                >
                  {ds}
                </div>
              ))}
            </dd>
          </div>
        )}

        {/* Upstream */}
        {entity.upstream_keys.length > 0 && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--color-text-muted)" }}>
              Upstream ({entity.upstream_keys.length})
            </dt>
            <dd className="space-y-1">
              {entity.upstream_keys.map((fqn) => (
                <button
                  key={fqn}
                  onClick={() => onNavigateTo?.(fqn, "upstream")}
                  className="block w-full text-left text-[11px] font-mono px-2 py-1 rounded-md truncate transition-colors hover:bg-muted"
                  style={{ color: "var(--color-primary)", border: "1px solid var(--color-border)" }}
                  title={fqn}
                >
                  {lineageKeyLabel(fqn)}
                </button>
              ))}
            </dd>
          </div>
        )}

        {/* Downstream */}
        {entity.downstream_keys.length > 0 && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--color-text-muted)" }}>
              Downstream ({entity.downstream_keys.length})
            </dt>
            <dd className="space-y-1">
              {entity.downstream_keys.map((fqn) => (
                <button
                  key={fqn}
                  onClick={() => onNavigateTo?.(fqn, "downstream")}
                  className="block w-full text-left text-[11px] font-mono px-2 py-1 rounded-md truncate transition-colors hover:bg-muted"
                  style={{ color: "var(--color-accent)", border: "1px solid var(--color-border)" }}
                  title={fqn}
                >
                  {lineageKeyLabel(fqn)}
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
            <p className="mb-2 text-[10px]" style={{ color: "var(--color-text-muted)" }}>
              {outgoing.length + incoming.length} current column mappings
            </p>
            {outgoing.length > 0 && (
              <div className="space-y-1 mb-2">
                <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "var(--color-text-muted)" }}>Outgoing ({outgoing.length})</p>
                {outgoingPreview.map((a, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[minmax(0,1fr)_14px_minmax(0,1fr)_auto] items-center gap-1.5 text-[10px] rounded-md px-2 py-1"
                    style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                  >
                    <span className="font-mono font-medium truncate" style={{ color: "var(--color-accent)" }} title={`${a.source_name}.${a.source_attribute}`}>{a.source_attribute}</span>
                    <ArrowRight className="h-3 w-3 shrink-0" style={{ color: "var(--color-text-muted)" }} />
                    <span className="font-mono truncate" style={{ color: "var(--color-text)" }} title={`${a.target_name}.${a.target_attribute}`}>{a.target_attribute}</span>
                    <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: "rgba(16,185,129,0.12)", color: "#047857" }} title={a.evidence ?? ""}>
                      Current
                    </span>
                  </div>
                ))}
              </div>
            )}
            {incoming.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "var(--color-text-muted)" }}>Incoming ({incoming.length})</p>
                {incomingPreview.map((a, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[minmax(0,1fr)_14px_minmax(0,1fr)_auto] items-center gap-1.5 text-[10px] rounded-md px-2 py-1"
                    style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                  >
                    <span className="font-mono truncate" style={{ color: "var(--color-text-muted)" }} title={`${a.source_name}.${a.source_attribute}`}>{a.source_attribute}</span>
                    <ArrowRight className="h-3 w-3 shrink-0" style={{ color: "var(--color-text-muted)" }} />
                    <span className="font-mono font-medium truncate" style={{ color: "var(--color-accent)" }} title={`${a.target_name}.${a.target_attribute}`}>{a.target_attribute}</span>
                    <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: "rgba(16,185,129,0.12)", color: "#047857" }} title={a.evidence ?? ""}>
                      Current
                    </span>
                  </div>
                ))}
              </div>
            )}
            {hasManyAttributes && onOpenColumns && (
              <button
                type="button"
                onClick={() => onOpenColumns(datasetLabel)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
                style={{ border: "1px solid var(--color-border)", color: "var(--color-brand)", background: "var(--color-surface)" }}
              >
                <Columns3 className="h-3.5 w-3.5" />
                View all {outgoing.length + incoming.length} attribute flows in Columns
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
