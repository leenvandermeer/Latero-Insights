"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Clock, ChevronDown, ChevronUp, Search } from "lucide-react";
import type { LineageEntity } from "@/lib/adapters/types";

// ── Types & constants ─────────────────────────────────────────────────────────

const LAYER_ORDER = ["landing", "raw", "bronze", "silver", "gold"];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: React.ComponentType<{ className?: string }> }> = {
  SUCCESS: { label: "Success", color: "#10B981", bg: "rgba(16,185,129,0.1)",  Icon: CheckCircle2 },
  WARNING: { label: "Warning", color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  Icon: AlertTriangle },
  PARTIAL: { label: "Partial", color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  Icon: AlertTriangle },
  FAILED:  { label: "Failed",  color: "#EF4444", bg: "rgba(239,68,68,0.1)",   Icon: XCircle },
  UNKNOWN: { label: "Unknown", color: "var(--color-text-muted)", bg: "rgba(128,128,128,0.08)", Icon: Clock },
};

function StatusBadge({ status, size = "sm" }: { status: string; size?: "xs" | "sm" }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.UNKNOWN;
  const { Icon } = cfg;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${size === "xs" ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-xs"}`}
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }}
    >
      <Icon className={size === "xs" ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} />
      {cfg.label}
    </span>
  );
}

// ── Layer progress bar ────────────────────────────────────────────────────────

interface LayerProgressProps {
  presentLayers: string[];
  lastCompletedLayer: string | null;
}

function LayerProgress({ presentLayers, lastCompletedLayer }: LayerProgressProps) {
  const orderedPresent = LAYER_ORDER.filter((l) => presentLayers.includes(l));
  const completedIdx = lastCompletedLayer
    ? orderedPresent.indexOf(lastCompletedLayer.toLowerCase())
    : -1;

  return (
    <div className="flex items-center gap-1 mt-2">
      {orderedPresent.map((layer, i) => {
        const done = i <= completedIdx;
        return (
          <div key={layer} className="flex items-center gap-1">
            <div
              className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{
                background: done ? "rgba(16,185,129,0.15)" : "rgba(128,128,128,0.1)",
                color: done ? "#10B981" : "var(--color-text-muted)",
                border: `1px solid ${done ? "#10B98150" : "var(--color-border)"}`,
              }}
            >
              {layer}
            </div>
            {i < orderedPresent.length - 1 && (
              <div
                className="h-px w-4 shrink-0"
                style={{ background: done ? "#10B98160" : "var(--color-border)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Chain card ─────────────────────────────────────────────────────────────────

interface ChainGroup {
  groupId: string;
  entities: LineageEntity[];
  endToEndStatus: string;
  lastCompletedLayer: string | null;
  presentLayers: string[];
}

function ChainCard({ chain }: { chain: ChainGroup }) {
  const [expanded, setExpanded] = useState(false);

  const byLayer = useMemo(() => {
    const map = new Map<string, LineageEntity[]>();
    for (const e of chain.entities) {
      const l = e.layer.toLowerCase();
      if (!map.has(l)) map.set(l, []);
      map.get(l)!.push(e);
    }
    return map;
  }, [chain.entities]);

  const orderedLayers = LAYER_ORDER.filter((l) => byLayer.has(l));

  const displayName = chain.groupId === "ungrouped"
    ? "Ungrouped entities"
    : chain.groupId.length > 48
      ? chain.groupId.slice(0, 48) + "…"
      : chain.groupId;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--color-border)", background: "var(--color-card)" }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex items-start justify-between gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>{displayName}</p>
          <LayerProgress presentLayers={chain.presentLayers} lastCompletedLayer={chain.lastCompletedLayer} />
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <StatusBadge status={chain.endToEndStatus} />
          <span style={{ color: "var(--color-text-muted)" }}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </div>
      </button>

      {/* Expanded layer detail */}
      {expanded && (
        <div
          className="px-4 pb-4 space-y-3"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <div className="pt-3 space-y-3">
            {orderedLayers.map((layer) => {
              const layerEntities = byLayer.get(layer) ?? [];
              return (
                <div key={layer}>
                  <p
                    className="text-[9px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {layer.charAt(0).toUpperCase() + layer.slice(1)}
                  </p>
                  <div className="space-y-1.5">
                    {layerEntities.map((e) => {
                      const parts = e.entity_fqn.split(".");
                      const short = parts[parts.length - 1] ?? e.entity_fqn;
                      return (
                        <div
                          key={e.entity_fqn}
                          className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: "var(--color-text)" }} title={e.entity_fqn}>
                              {short}
                            </p>
                            {e.latest_success_at && (
                              <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                                {(() => { try { return new Date(e.latest_success_at!).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return e.latest_success_at; } })()}
                              </p>
                            )}
                          </div>
                          <StatusBadge status={e.latest_status} size="xs" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface ChainsViewProps {
  entities: LineageEntity[];
}

export function ChainsView({ entities }: ChainsViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const chains = useMemo<ChainGroup[]>(() => {
    const grouped = new Map<string, LineageEntity[]>();
    for (const e of entities) {
      const key = e.lineage_group_id ?? "ungrouped";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(e);
    }

    return [...grouped.entries()].map(([groupId, groupEntities]) => {
      // Derive end_to_end_status: worst status in the group
      const statuses = groupEntities.map((e) => e.end_to_end_status);
      const worstStatus = statuses.includes("FAILED") ? "FAILED"
        : statuses.includes("PARTIAL") ? "PARTIAL"
        : statuses.includes("WARNING") ? "WARNING"
        : statuses.every((s) => s === "SUCCESS") ? "SUCCESS"
        : "UNKNOWN";

      const layers = [...new Set(groupEntities.map((e) => e.layer.toLowerCase()))];
      const lastCompleted = groupEntities.find((e) => e.last_completed_layer)?.last_completed_layer ?? null;

      return {
        groupId,
        entities: groupEntities,
        endToEndStatus: worstStatus,
        lastCompletedLayer: lastCompleted,
        presentLayers: layers,
      };
    }).sort((a, b) => {
      // Sort: FAILED first, then PARTIAL/WARNING, then SUCCESS, then UNKNOWN
      const order = { FAILED: 0, PARTIAL: 1, WARNING: 2, SUCCESS: 3, UNKNOWN: 4 };
      return (order[a.endToEndStatus as keyof typeof order] ?? 4) - (order[b.endToEndStatus as keyof typeof order] ?? 4);
    });
  }, [entities]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return chains.filter((c) => {
      const matchSearch = !q || c.groupId.toLowerCase().includes(q)
        || c.entities.some((e) => e.entity_fqn.toLowerCase().includes(q));
      const matchStatus = statusFilter === "all" || c.endToEndStatus === statusFilter.toUpperCase();
      return matchSearch && matchStatus;
    });
  }, [chains, search, statusFilter]);

  const summary = useMemo(() => ({
    total: chains.length,
    failed: chains.filter((c) => c.endToEndStatus === "FAILED").length,
    partial: chains.filter((c) => c.endToEndStatus === "PARTIAL" || c.endToEndStatus === "WARNING").length,
    success: chains.filter((c) => c.endToEndStatus === "SUCCESS").length,
  }), [chains]);

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      <div
        className="flex items-center gap-4 px-4 py-2.5 shrink-0 flex-wrap"
        style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}
      >
        <div className="flex items-center gap-3 text-xs">
          <span style={{ color: "var(--color-text-muted)" }}>{summary.total} chains</span>
          {summary.failed > 0 && <span style={{ color: "#EF4444", fontWeight: 600 }}>✗ {summary.failed} failed</span>}
          {summary.partial > 0 && <span style={{ color: "#F59E0B", fontWeight: 600 }}>⚠ {summary.partial} partial</span>}
          {summary.success > 0 && <span style={{ color: "#10B981", fontWeight: 600 }}>✓ {summary.success} success</span>}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chains…"
              className="text-xs rounded-lg pl-7 pr-3 py-1.5 w-44 outline-none"
              style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            />
          </div>
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-lg px-2.5 py-1.5 outline-none"
            style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          >
            <option value="all">All statuses</option>
            <option value="failed">Failed</option>
            <option value="partial">Partial</option>
            <option value="success">Success</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
      </div>

      {/* Chain list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {chains.length === 0 ? "Geen chains gevonden." : "Geen resultaten voor dit filter."}
            </p>
          </div>
        ) : (
          filtered.map((chain) => <ChainCard key={chain.groupId} chain={chain} />)
        )}
      </div>
    </div>
  );
}
