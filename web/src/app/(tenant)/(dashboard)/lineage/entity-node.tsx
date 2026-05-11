"use client";

import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Database, FileText, Table2, ChevronLeft, ChevronRight } from "lucide-react";
import type { HealthStatus } from "./lineage-utils";

interface EntityData {
  label: string;
  type: string;
  ref: string;
  attributes: string[];
  hopCount: number;
  health: HealthStatus;
  layer?: string;
  // LADR-064: dataset vs entity split
  nodeKind?: "dataset" | "entity";
  sourceDatasetsCount?: number;
  // navigation callbacks injected by graph-view
  upstreamCount?: number;
  downstreamCount?: number;
  onFocusUpstream?: () => void;
  onFocusDownstream?: () => void;
  traceRole?: "anchor" | "upstream" | "downstream" | "both" | "neutral";
  hopDistance?: number;
}

const HEALTH_COLORS: Record<HealthStatus, { border: string; dot: string; statusBg: string }> = {
  healthy: { border: "#10B981", dot: "#10B981", statusBg: "rgba(16,185,129,0.12)" },
  warning: { border: "#F59E0B", dot: "#F59E0B", statusBg: "rgba(245,158,11,0.12)" },
  error:   { border: "#EF4444", dot: "#EF4444", statusBg: "rgba(239,68,68,0.12)" },
  unknown: { border: "var(--color-border)", dot: "var(--color-text-muted)", statusBg: "transparent" },
};

const LAYER_ACCENT: Record<string, string> = {
  landing: "#4E7496",
  raw:     "#2F5D50",
  bronze:  "#B45309",
  silver:  "#B8C0CC",
  gold:    "#D97706",
  file:    "#6B7280",
};

function EntityNodeComponent({ data, selected }: NodeProps) {
  const { label, type, attributes, health, atRisk, layer, nodeKind, sourceDatasetsCount,
          upstreamCount, downstreamCount, onFocusUpstream, onFocusDownstream, traceRole, hopDistance } =
    data as unknown as EntityData & { atRisk?: boolean };
  const [hovered, setHovered] = useState(false);
  const showNav = (hovered || selected) && (upstreamCount || downstreamCount);

  const Icon = type === "table" ? Table2 : type === "file" ? FileText : Database;
  const colors = HEALTH_COLORS[health ?? "unknown"];
  const layerKey = layer?.toLowerCase() ?? "raw";
  const accentColor = LAYER_ACCENT[layerKey] ?? "var(--color-border)";
  const isEntity = nodeKind === "entity" || layerKey === "silver" || layerKey === "gold";
  const borderRadius = isEntity ? "12px" : "8px";
  const isAnchor = traceRole === "anchor";
  const traceBorder =
    traceRole === "upstream" ? "#3B82F6"
    : traceRole === "downstream" ? "#D97706"
    : traceRole === "both" ? "var(--color-brand, #1B3B6B)"
    : null;

  return (
    <div
      className="shadow-sm overflow-hidden min-w-[280px] max-w-[420px]"
      style={{
        background: isEntity ? "var(--color-surface)" : "var(--color-card)",
        border: "1px solid var(--color-border)",
        borderRadius,
        outline: selected
          ? "2px solid var(--color-brand, #1B3B6B)"
          : isAnchor
          ? "2px solid var(--color-brand, #1B3B6B)"
          : traceBorder
          ? `1.5px solid ${traceBorder}`
          : health !== "unknown"
          ? `1.5px solid ${colors.border}`
          : undefined,
        outlineOffset: selected ? "2px" : "-1px",
        boxShadow: isAnchor ? "0 0 0 4px rgba(27,59,107,0.12)" : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2" style={{ background: accentColor, border: "none" }} />

      {/* Layer stripe */}
      <div style={{ height: 3, background: accentColor, borderRadius: `${borderRadius} ${borderRadius} 0 0` }} />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />
        <span className="text-[13px] font-semibold flex-1 leading-snug line-clamp-3" style={{ color: "var(--color-text)" }} title={label}>
          {label}
        </span>
        {/* LADR-064: entity badge voor silver/gold nodes */}
        {isEntity && (
          <span
            className="text-[9px] font-bold rounded-full px-1.5 py-0.5 shrink-0"
            style={{ background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44` }}
            title="Business entity (silver/gold)"
          >
            ENTITY
          </span>
        )}
        {isAnchor && (
          <span
            className="text-[9px] font-bold rounded-full px-1.5 py-0.5 shrink-0"
            style={{ background: "rgba(27,59,107,0.12)", color: "var(--color-brand, #1B3B6B)", border: "1px solid rgba(27,59,107,0.2)" }}
            title="Current trace starting point"
          >
            FOCUS
          </span>
        )}
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

      {/* LADR-064: toon source datasets voor entity-nodes (1-to-many) */}
      {isEntity && sourceDatasetsCount !== undefined && sourceDatasetsCount > 0 && (
        <div
          className="px-3 py-1 text-[10px]"
          style={{ borderTop: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
        >
          fed by {sourceDatasetsCount} source{sourceDatasetsCount > 1 ? "s" : ""}
        </div>
      )}

      {typeof hopDistance === "number" && (
        <div
          className="flex items-center justify-between px-3 py-1 text-[10px]"
          style={{ borderTop: "1px solid var(--color-border)", color: "var(--color-text-muted)", background: "rgba(128,128,128,0.04)" }}
        >
          <span>
            {isAnchor ? "starting point" : `${hopDistance} hop${hopDistance === 1 ? "" : "s"} away`}
          </span>
          {traceRole && traceRole !== "neutral" && !isAnchor && (
            <span className="font-semibold uppercase" style={{ color: traceBorder ?? "var(--color-text-muted)" }}>
              {traceRole}
            </span>
          )}
        </div>
      )}

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

      {/* Parent / child navigation — visible on hover or when selected */}
      {showNav && (
        <div
          className="flex items-center justify-between px-2 py-1 gap-1"
          style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-surface)" }}
        >
          {upstreamCount ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onFocusUpstream?.(); }}
              className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors hover:opacity-80"
              style={{ background: `${accentColor}18`, color: accentColor, border: `1px solid ${accentColor}33` }}
              title={`Show ${upstreamCount} upstream parent${upstreamCount > 1 ? "s" : ""}`}
            >
              <ChevronLeft className="h-3 w-3" />
              {upstreamCount}
            </button>
          ) : <span />}

          {downstreamCount ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onFocusDownstream?.(); }}
              className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors hover:opacity-80"
              style={{ background: `${accentColor}18`, color: accentColor, border: `1px solid ${accentColor}33` }}
              title={`Show ${downstreamCount} downstream child${downstreamCount > 1 ? "ren" : ""}`}
            >
              {downstreamCount}
              <ChevronRight className="h-3 w-3" />
            </button>
          ) : <span />}
        </div>
      )}
    </div>
  );
}

export const EntityNode = memo(EntityNodeComponent);
