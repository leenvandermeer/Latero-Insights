"use client";

import { X, ArrowRight, ShieldAlert } from "lucide-react";
import { useEntityDetail } from "@/hooks/use-entities";

interface EntityDetailDrawerProps {
  entityId: string | null;
  open: boolean;
  onClose: () => void;
  onOpenTrace?: (entityId: string) => void;
}

type EntityDetail = {
  entity_id: string;
  display_name: string;
  data_product_id: string | null;
  source_system: string | null;
  owner: string | null;
  description: string | null;
  layer_statuses: Array<{
    dataset_id: string;
    layer: string;
    latest_status: string;
    latest_run_at?: string | null;
  }>;
};

function formatTime(value?: string | null) {
  if (!value) return "No recent run";
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function StatusTone({ status }: { status: string }) {
  const tone =
    status === "FAILED" ? { bg: "#fee2e2", color: "#dc2626" }
    : status === "WARNING" ? { bg: "#fef3c7", color: "#b45309" }
    : status === "SUCCESS" ? { bg: "#dcfce7", color: "#15803d" }
    : { bg: "var(--color-surface)", color: "var(--color-text-muted)" };

  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
      style={{ background: tone.bg, color: tone.color }}
    >
      {status}
    </span>
  );
}

export function EntityDetailDrawer({ entityId, open, onClose, onOpenTrace }: EntityDetailDrawerProps) {
  const { data, isLoading, isError } = useEntityDetail(open ? entityId : null);
  const entity = (data?.data ?? null) as EntityDetail | null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 transition-opacity"
        style={{
          background: "rgba(0,0,0,0.4)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={onClose}
      />

      <div
        className="fixed top-0 right-0 z-50 flex h-full flex-col"
        style={{
          width: 420,
          background: "var(--color-card)",
          borderLeft: "1px solid var(--color-border)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s ease",
          boxShadow: open ? "-8px 0 32px rgba(0,0,0,0.15)" : "none",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Entity details</h2>
            {entityId && (
              <p className="mt-0.5 text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>{entityId}</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded" style={{ color: "var(--color-text-muted)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {isLoading && (
            <div className="space-y-3">
              <div className="h-20 animate-pulse rounded-xl" style={{ background: "var(--color-surface)" }} />
              <div className="h-32 animate-pulse rounded-xl" style={{ background: "var(--color-surface)" }} />
            </div>
          )}

          {isError && (
            <p className="text-sm" style={{ color: "#ef4444" }}>
              Failed to load entity details.
            </p>
          )}

          {!isLoading && !isError && entity && (
            <div className="space-y-4">
              <section className="rounded-xl px-4 py-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
                      {entity.display_name || entity.entity_id}
                    </p>
                    <p className="mt-1 text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
                      {entity.entity_id}
                    </p>
                  </div>
                  {entity.layer_statuses.some((layer) => layer.latest_status === "FAILED") && (
                    <ShieldAlert className="h-5 w-5 shrink-0" style={{ color: "#ef4444" }} />
                  )}
                </div>
                {entity.description && (
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                    {entity.description}
                  </p>
                )}
              </section>

              <section className="rounded-xl px-4 py-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                  Context
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Owner</p>
                    <p className="mt-1 text-sm" style={{ color: "var(--color-text)" }}>{entity.owner || "Unassigned"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Source system</p>
                    <p className="mt-1 text-sm" style={{ color: "var(--color-text)" }}>{entity.source_system || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Data product</p>
                    <p className="mt-1 text-sm font-mono" style={{ color: "var(--color-text)" }}>{entity.data_product_id || "Not grouped yet"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Tracked layers</p>
                    <p className="mt-1 text-sm" style={{ color: "var(--color-text)" }}>{entity.layer_statuses.length}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-xl px-4 py-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                  Layer status
                </p>
                <div className="mt-3 space-y-2">
                  {entity.layer_statuses.map((layer) => (
                    <div
                      key={`${layer.dataset_id}-${layer.layer}`}
                      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                      style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold capitalize" style={{ color: "var(--color-text)" }}>{layer.layer}</p>
                        <p className="mt-0.5 truncate text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>{layer.dataset_id}</p>
                      </div>
                      <div className="text-right">
                        <StatusTone status={layer.latest_status} />
                        <p className="mt-1 text-[11px]" style={{ color: "var(--color-text-muted)" }}>{formatTime(layer.latest_run_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--color-border)" }}>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          >
            Close
          </button>
          {entityId && onOpenTrace && (
            <button
              type="button"
              onClick={() => onOpenTrace(entityId)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: "var(--color-brand)" }}
            >
              Open Trace
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
