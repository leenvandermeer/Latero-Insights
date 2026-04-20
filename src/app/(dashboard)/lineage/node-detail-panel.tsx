"use client";

import { X, Table2, Database } from "lucide-react";
import type { HealthStatus } from "./lineage-canvas";

interface EntityData {
  label: string;
  type: string;
  ref: string;
  attributes: string[];
  hopCount: number;
  health?: HealthStatus;
}

const HEALTH_LABEL: Record<string, { label: string; color: string }> = {
  healthy: { label: "Healthy", color: "#10B981" },
  warning: { label: "Warning", color: "#F59E0B" },
  error:   { label: "Error", color: "#EF4444" },
  unknown: { label: "No DQ data", color: "var(--color-text-muted)" },
};

interface NodeDetailPanelProps {
  node: EntityData;
  onClose: () => void;
  impactCount?: number;
  upstreamCount?: number;
  lastSeen?: string;
  columnFlows?: Array<{ sourceAttr: string; targetAttr: string; targetEntity: string }>;
}

export function NodeDetailPanel({ node, onClose, impactCount, upstreamCount, lastSeen, columnFlows }: NodeDetailPanelProps) {
  const Icon = node.type === "table" ? Table2 : Database;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 border-l border-border bg-card shadow-lg overflow-y-auto z-10">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">{node.label}</h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 hover:bg-muted transition-colors"
          aria-label="Close detail panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</dt>
          <dd className="mt-1 text-sm">{node.type}</dd>
        </div>

        <div>
          <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reference</dt>
          <dd className="mt-1 text-sm font-mono text-xs break-all">{node.ref}</dd>
        </div>

        <div>
          <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Connections</dt>
          <dd className="mt-1 text-sm">{node.hopCount} lineage hops</dd>
        </div>

        {impactCount !== undefined && impactCount > 0 && (
          <div>
            <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Downstream Impact</dt>
            <dd className="mt-1 text-sm font-medium" style={{ color: "var(--color-accent)" }}>{impactCount} affected entit{impactCount === 1 ? "y" : "ies"}</dd>
          </div>
        )}

        {upstreamCount !== undefined && upstreamCount > 0 && (
          <div>
            <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Upstream Dependencies</dt>
            <dd className="mt-1 text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>{upstreamCount} source entit{upstreamCount === 1 ? "y" : "ies"}</dd>
          </div>
        )}

        {lastSeen && (
          <div>
            <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Activity</dt>
            <dd className="mt-1 text-sm" style={{ color: "var(--color-text)" }}>
              {(() => {
                try {
                  return new Date(lastSeen).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
                } catch { return lastSeen; }
              })()}
            </dd>
          </div>
        )}

        {node.health && (
          <div>
            <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">DQ Health</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium" style={{ color: HEALTH_LABEL[node.health]?.color }}>
              <span className="w-2 h-2 rounded-full" style={{ background: HEALTH_LABEL[node.health]?.color }} />
              {HEALTH_LABEL[node.health]?.label}
            </dd>
          </div>
        )}

        {node.attributes.length > 0 && (
          <div>
            <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Attributes ({node.attributes.length})
            </dt>
            <dd className="mt-2 space-y-1">
              {node.attributes.map((attr) => (
                <div
                  key={attr}
                  className="rounded-md bg-muted px-2.5 py-1 text-xs font-mono"
                >
                  {attr}
                </div>
              ))}
            </dd>
          </div>
        )}

        {columnFlows && columnFlows.length > 0 && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>
              Column Lineage
            </dt>
            <div className="space-y-1.5">
              {columnFlows.map((flow, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-[10px] rounded-lg px-2 py-1.5"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                >
                  <span className="font-mono font-medium truncate max-w-[80px]" style={{ color: "var(--color-accent)" }}>
                    {flow.sourceAttr}
                  </span>
                  <span style={{ color: "var(--color-text-muted)" }}>→</span>
                  <span className="font-mono truncate max-w-[60px]" style={{ color: "var(--color-text-muted)" }}>
                    {flow.targetEntity !== "" ? `${flow.targetEntity}.` : ""}
                  </span>
                  <span className="font-mono font-medium truncate" style={{ color: "var(--color-text)" }}>
                    {flow.targetAttr}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
