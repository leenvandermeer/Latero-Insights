"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Database, Table2 } from "lucide-react";
import type { HealthStatus } from "./lineage-canvas";

interface EntityData {
  label: string;
  type: string;
  ref: string;
  attributes: string[];
  hopCount: number;
  health: HealthStatus;
  layer?: string;
  end_to_end_status?: string;
}

const HEALTH_COLORS: Record<HealthStatus, { border: string; dot: string; bg: string }> = {
  healthy: { border: "#10B981", dot: "#10B981", bg: "rgba(16,185,129,0.08)" },
  warning: { border: "#F59E0B", dot: "#F59E0B", bg: "rgba(245,158,11,0.08)" },
  error:   { border: "#EF4444", dot: "#EF4444", bg: "rgba(239,68,68,0.08)" },
  unknown: { border: "var(--color-border)", dot: "var(--color-border)", bg: "transparent" },
};

function EntityNodeComponent({ data }: NodeProps) {
  const { label, type, attributes, health, atRisk, layer, end_to_end_status } = data as unknown as EntityData & { atRisk?: boolean };
  const Icon = type === "table" ? Table2 : Database;
  const colors = HEALTH_COLORS[health ?? "unknown"];

  // Show end_to_end badge when it signals a different state than latest_status
  const showE2eBadge = end_to_end_status && end_to_end_status !== "SUCCESS" && end_to_end_status !== "UNKNOWN";

  return (
    <div
      className="rounded-lg shadow-sm min-w-[180px] max-w-[240px]"
      style={{
        background: "var(--color-surface)",
        border: `1.5px solid ${colors.border}`,
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary !w-2 !h-2" />

      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          borderBottom: `1px solid ${colors.border}`,
          background: colors.bg,
          borderRadius: "6px 6px 0 0",
        }}
      >
        <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--color-primary)" }} />
        <span className="text-sm font-medium truncate flex-1" style={{ color: "var(--color-text)" }}>
          {label}
        </span>
        {layer && (
          <span
            className="text-[9px] font-bold uppercase tracking-wide rounded px-1 shrink-0"
            style={{ background: "rgba(128,128,128,0.12)", color: "var(--color-text-muted)" }}
          >
            {layer}
          </span>
        )}
        {health !== "unknown" && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: colors.dot }}
            title={health}
          />
        )}
        {showE2eBadge && (
          <span
            className="text-[9px] font-bold rounded px-1 shrink-0"
            style={{ background: "rgba(239,68,68,0.15)", color: "#dc2626" }}
            title={`End-to-end: ${end_to_end_status}`}
          >
            E2E {end_to_end_status}
          </span>
        )}
        {atRisk && (
          <span
            className="text-[9px] font-bold rounded px-1"
            style={{ background: "rgba(239,68,68,0.15)", color: "#dc2626" }}
            title="Downstream of a failed pipeline"
          >
            AT RISK
          </span>
        )}
      </div>

      {attributes.length > 0 && (
        <div className="px-3 py-1.5 space-y-0.5">
          {attributes.slice(0, 5).map((attr) => (
            <div key={attr} className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
              {attr}
            </div>
          ))}
          {attributes.length > 5 && (
            <div className="text-xs" style={{ color: "var(--color-text-muted)", opacity: 0.6 }}>
              +{attributes.length - 5} more
            </div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-primary !w-2 !h-2" />
    </div>
  );
}

export const EntityNode = memo(EntityNodeComponent);
