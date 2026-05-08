"use client";

import { X, ArrowRight, Database } from "lucide-react";

type DatasetDetail = {
  dataset_id: string;
  namespace: string | null;
  object_name: string;
  platform: string | null;
  layer: string;
  entity_id: string | null;
  latest_run_status: string | null;
  latest_run_at: string | null;
};

interface DatasetDetailDrawerProps {
  dataset: DatasetDetail | null;
  open: boolean;
  onClose: () => void;
  onOpenTrace?: (entityId: string) => void;
}

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

function StatusTone({ status }: { status: string | null }) {
  const tone =
    status === "FAILED" ? { bg: "#fee2e2", color: "#dc2626" }
    : status === "WARNING" ? { bg: "#fef3c7", color: "#b45309" }
    : status === "SUCCESS" ? { bg: "#dcfce7", color: "#15803d" }
    : status === "RUNNING" ? { bg: "#dbeafe", color: "#1d4ed8" }
    : { bg: "var(--color-surface)", color: "var(--color-text-muted)" };

  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
      style={{ background: tone.bg, color: tone.color }}
    >
      {status || "unknown"}
    </span>
  );
}

export function DatasetDetailDrawer({ dataset, open, onClose, onOpenTrace }: DatasetDetailDrawerProps) {
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
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Dataset details</h2>
            {dataset && (
              <p className="mt-0.5 text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>{dataset.dataset_id}</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded" style={{ color: "var(--color-text-muted)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {dataset && (
            <div className="space-y-4">
              <section className="rounded-xl px-4 py-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
                      {dataset.object_name}
                    </p>
                    {dataset.namespace && (
                      <p className="mt-1 text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
                        {dataset.namespace}
                      </p>
                    )}
                  </div>
                  <Database className="h-5 w-5 shrink-0" style={{ color: "var(--color-brand)" }} />
                </div>
              </section>

              <section className="rounded-xl px-4 py-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                  Context
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Layer</p>
                    <p className="mt-1 text-sm capitalize" style={{ color: "var(--color-text)" }}>{dataset.layer}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Platform</p>
                    <p className="mt-1 text-sm" style={{ color: "var(--color-text)" }}>{dataset.platform || "Unknown"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Linked entity</p>
                    <p className="mt-1 text-sm font-mono" style={{ color: "var(--color-text)" }}>{dataset.entity_id || "No linked entity"}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-xl px-4 py-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                  Operational status
                </p>
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Latest run</p>
                    <p className="mt-1 text-[11px]" style={{ color: "var(--color-text-muted)" }}>{formatTime(dataset.latest_run_at)}</p>
                  </div>
                  <StatusTone status={dataset.latest_run_status} />
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
          {dataset?.entity_id && onOpenTrace && (
            <button
              type="button"
              onClick={() => onOpenTrace(dataset.entity_id!)}
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
