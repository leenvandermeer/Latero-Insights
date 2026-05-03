"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Database, FileText, Table2 } from "lucide-react";
import type { HealthStatus } from "./lineage-utils";

interface EntityData {
  label: string;
  type: string;
  ref: string;
  attributes: string[];
  hopCount: number;
  health: HealthStatus;
  layer?: string;
}

const HEALTH_COLORS: Record<HealthStatus, { border: string; dot: string; statusBg: string }> = {
  healthy: { border: "#10B981", dot: "#10B981", statusBg: "rgba(16,185,129,0.12)" },
  warning: { border: "#F59E0B", dot: "#F59E0B", statusBg: "rgba(245,158,11,0.12)" },
  error:   { border: "#EF4444", dot: "#EF4444", statusBg: "rgba(239,68,68,0.12)" },
  unknown: { border: "var(--color-border)", dot: "var(--color-text-muted)", statusBg: "transparent" },
};

const LAYER_ACCENT: Record<string, string> = {
  landing: "#6B7280",
  raw:     "#6B7280",
  bronze:  "#B45309",
  silver:  "#0891B2",
  gold:    "#D97706",
  file:    "#6B7280",
};

function EntityNodeComponent({ data }: NodeProps) {
  const { label, type, attributes, health, atRisk, layer } = data as unknown as EntityData & { atRisk?: boolean };
  const Icon = type === "table" ? Table2 : type === "file" ? FileText : Database;
  const colors = HEALTH_COLORS[health ?? "unknown"];
  const layerKey = layer?.toLowerCase() ?? "raw";
  const accentColor = LAYER_ACCENT[layerKey] ?? "var(--color-border)";

  return (
    <div
      className="rounded-lg shadow-sm overflow-hidden min-w-[200px] max-w-[280px]"
      style={{
        background: "var(--color-card)",
        border: "1px solid var(--color-border)",
        outline: health !== "unknown" ? `1.5px solid ${colors.border}` : undefined,
        outlineOffset: "-1px",
      }}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2" style={{ background: accentColor, border: "none" }} />

      {/* Layer stripe */}
      <div style={{ height: 3, background: accentColor }} />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />
        <span className="text-[13px] font-semibold flex-1 leading-snug line-clamp-2" style={{ color: "var(--color-text)" }}>
          {label}
        </span>
        {atRisk && (
          <span
            className="text-[9px] font-bold rounded px-1 py-0.5 shrink-0"
            style={{ background: "rgba(239,68,68,0.15)", color: "#dc2626" }}
            title="Downstream of a failed pipeline"
          >
            AT RISK
          </span>
        )}
        {health !== "unknown" && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: colors.dot }}
            title={health}
          />
        )}
      </div>

      {/* Attributes */}
      {attributes.length > 0 && (
        <div
          className="px-3 py-1.5 space-y-0.5"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          {attributes.slice(0, 5).map((attr) => (
            <div key={attr} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
              <span className="w-1 h-1 rounded-full shrink-0" style={{ background: "var(--color-border)" }} />
              <span className="truncate">{attr}</span>
            </div>
          ))}
          {attributes.length > 5 && (
            <div className="text-[11px] pl-2.5" style={{ color: "var(--color-text-muted)", opacity: 0.6 }}>
              +{attributes.length - 5} more
            </div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!w-2 !h-2" style={{ background: accentColor, border: "none" }} />
    </div>
  );
}

export const EntityNode = memo(EntityNodeComponent);
