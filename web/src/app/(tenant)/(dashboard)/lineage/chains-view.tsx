"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Clock, ChevronDown, ChevronUp, Search, ArrowRight } from "lucide-react";
import type { LineageEntity } from "@/lib/adapters/types";
import { lineageNodeName, lineageNodeLabel, lineageNodeKey, lineageKeyLabel } from "./lineage-utils";

// ── Types & constants ─────────────────────────────────────────────────────────

const LAYER_ORDER = ["landing", "raw", "bronze", "silver", "gold"];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: React.ComponentType<{ className?: string }> }> = {
  SUCCESS: { label: "Success", color: "#10B981", bg: "rgba(16,185,129,0.1)",  Icon: CheckCircle2 },
  WARNING: { label: "Warning", color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  Icon: AlertTriangle },
  PARTIAL: { label: "Partial", color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  Icon: AlertTriangle },
  IN_PROGRESS: { label: "In progress", color: "#3B82F6", bg: "rgba(59,130,246,0.12)", Icon: Clock },
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

function statusRank(status: string) {
  return { FAILED: 5, PARTIAL: 4, WARNING: 4, IN_PROGRESS: 3, UNKNOWN: 2, SUCCESS: 1 }[status.toUpperCase()] ?? 2;
}

function readableChainName(entities: LineageEntity[], fallback: string) {
  const terminal = entities
    .filter((entity) => entity.downstream_keys.length === 0)
    .sort((a, b) => statusRank(b.end_to_end_status) - statusRank(a.end_to_end_status))[0];
  const preferred = terminal ?? [...entities].sort((a, b) => {
    const aLayer = LAYER_ORDER.indexOf(a.layer.toLowerCase());
    const bLayer = LAYER_ORDER.indexOf(b.layer.toLowerCase());
    return bLayer - aLayer || a.name.localeCompare(b.name);
  })[0];

  return preferred ? lineageNodeLabel(preferred) : fallback;
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
  displayName: string;
  entities: LineageEntity[];
  endToEndStatus: string;
  lastCompletedLayer: string | null;
  presentLayers: string[];
}

function datasetKeyFromEntity(entity: LineageEntity): string {
  return lineageNodeName(entity);
}

function deriveChainLabel(entities: LineageEntity[], fallback: string): string {
  const counts = new Map<string, number>();
  for (const entity of entities) {
    const key = datasetKeyFromEntity(entity);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const winner = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];

  return winner ?? fallback;
}

function buildConnectedChains(entities: LineageEntity[]): Array<{ groupId: string; entities: LineageEntity[] }> {
  const byKey = new Map(entities.map((entity) => [lineageNodeKey(entity), entity]));
  const keysByFqn = new Map<string, string[]>();
  const adjacency = new Map<string, Set<string>>();

  for (const entity of entities) {
    const key = lineageNodeKey(entity);
    adjacency.set(key, new Set());
    const fqnKeys = keysByFqn.get(entity.name) ?? [];
    fqnKeys.push(key);
    keysByFqn.set(entity.name, fqnKeys);
  }

  function connect(a: string, b: string) {
    if (a === b) return;
    adjacency.get(a)?.add(b);
    adjacency.get(b)?.add(a);
  }

  for (const fqnKeys of keysByFqn.values()) {
    for (let i = 1; i < fqnKeys.length; i++) connect(fqnKeys[i - 1], fqnKeys[i]);
  }

  // LADR-058: Sluit source-only entities uit van chain-merging.
  // Source systems (bijv. "latero") hebben geen upstream maar wel veel downstreams.
  // Ze verbinden anders alle data-product chains tot één giant component.
  const sourceOnlyKeys = new Set(
    entities
      .filter((e) => e.upstream_keys.length === 0 && e.downstream_keys.length > 1)
      .map((e) => lineageNodeKey(e))
  );

  for (const entity of entities) {
    const key = lineageNodeKey(entity);
    for (const ref of [...entity.upstream_keys, ...entity.downstream_keys]) {
      if (sourceOnlyKeys.has(key)) continue;
      // LADR-058: refs zijn exacte layer::fqn keys — directe key lookup via byKey index.
      const resolved = byKey.get(ref);
      if (!resolved) continue;
      const resolvedKey = lineageNodeKey(resolved);
      if (sourceOnlyKeys.has(resolvedKey)) continue;
      connect(key, resolvedKey);
    }
  }

  const visited = new Set<string>();
  const chains: Array<{ groupId: string; entities: LineageEntity[] }> = [];

  for (const start of byKey.keys()) {
    if (visited.has(start)) continue;
    const queue = [start];
    const component: LineageEntity[] = [];
    visited.add(start);

    for (let i = 0; i < queue.length; i++) {
      const key = queue[i];
      const entity = byKey.get(key);
      if (entity) component.push(entity);
      for (const next of adjacency.get(key) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }

    chains.push({ groupId: deriveChainLabel(component, `chain-${chains.length + 1}`), entities: component });
  }

  return chains;
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

  const displayName = chain.displayName === "ungrouped"
    ? "Ungrouped entities"
    : chain.displayName.length > 48
      ? chain.displayName.slice(0, 48) + "..."
      : chain.displayName;

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
                      const latestSuccess = e.latest_success_at
                        ? (() => {
                            try {
                              return new Date(e.latest_success_at).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              });
                            } catch {
                              return e.latest_success_at;
                            }
                          })()
                        : "No successful run";
                      return (
                        <div
                          key={e.name}
                          className="rounded-lg px-3 py-2"
                          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate" style={{ color: "var(--color-text)" }}>
                                {lineageNodeLabel(e)}
                              </p>
                            </div>
                            <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
                              <StatusBadge status={e.latest_status} size="xs" />
                              {e.end_to_end_status !== e.latest_status && (
                                <StatusBadge status={e.end_to_end_status} size="xs" />
                              )}
                            </div>
                          </div>

                          <div className="mt-2 grid gap-2 text-[10px] sm:grid-cols-3" style={{ color: "var(--color-text-muted)" }}>
                            <div>
                              <span className="font-semibold" style={{ color: "var(--color-text)" }}>Last success</span>
                              <p>{latestSuccess}</p>
                            </div>
                            <div>
                              <span className="font-semibold" style={{ color: "var(--color-text)" }}>Upstream</span>
                              <p>{e.upstream_keys.length} source{e.upstream_keys.length === 1 ? "" : "s"}</p>
                            </div>
                            <div>
                              <span className="font-semibold" style={{ color: "var(--color-text)" }}>Downstream</span>
                              <p>{e.downstream_keys.length} target{e.downstream_keys.length === 1 ? "" : "s"}</p>
                            </div>
                          </div>

                          {(e.upstream_keys.length > 0 || e.downstream_keys.length > 0) && (
                            <div className="mt-2 grid gap-2 md:grid-cols-2">
                              {e.upstream_keys.length > 0 && (
                                <div>
                                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Incoming from</p>
                                  <div className="space-y-1">
                                    {e.upstream_keys.map((fqn) => (
                                      <p key={fqn} className="truncate text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }} title={fqn}>
                                        {lineageKeyLabel(fqn)}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {e.downstream_keys.length > 0 && (
                                <div>
                                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Flows to</p>
                                  <div className="space-y-1">
                                    {e.downstream_keys.map((fqn) => (
                                      <p key={fqn} className="flex min-w-0 items-center gap-1 truncate text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }} title={fqn}>
                                        <ArrowRight className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{lineageKeyLabel(fqn)}</span>
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
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
    return buildConnectedChains(entities).map(({ groupId, entities: groupEntities }) => {
      // Use terminal entities (those with no downstream refs pointing to another entity in this chain)
      // to determine end-to-end status. Non-terminal entities may show e2e=IN_PROGRESS even after
      // downstream entities succeeded, which would poison the whole chain's displayed status.
      // downstream_entity_fqns zijn in layer::fqn formaat — vergelijk met lineageEntityKey
      const chainKeys = new Set(groupEntities.map((ge) => lineageNodeKey(ge)));
      const terminalEntities = groupEntities.filter((e) =>
        !e.downstream_keys.some((fqn) => chainKeys.has(fqn))
      );
      const statusSource = terminalEntities.length > 0 ? terminalEntities : groupEntities;
      const statuses = statusSource.map((e) => e.latest_status);
      const worstStatus = statuses.includes("FAILED") ? "FAILED"
        : statuses.includes("PARTIAL") ? "PARTIAL"
        : statuses.includes("WARNING") ? "WARNING"
        : statuses.includes("IN_PROGRESS") ? "IN_PROGRESS"
        : statuses.every((s) => s === "SUCCESS") ? "SUCCESS"
        : "UNKNOWN";

      const layers = [...new Set(groupEntities.map((e) => e.layer.toLowerCase()))];
      const lastCompleted = groupEntities.find((e) => e.last_completed_layer)?.last_completed_layer ?? null;

      return {
        groupId,
        displayName: readableChainName(groupEntities, groupId),
        entities: groupEntities,
        endToEndStatus: worstStatus,
        lastCompletedLayer: lastCompleted,
        presentLayers: layers,
      };
    }).sort((a, b) => {
      // Sort: FAILED first, then PARTIAL/WARNING, then SUCCESS, then UNKNOWN
      const order = { FAILED: 0, PARTIAL: 1, WARNING: 2, IN_PROGRESS: 3, SUCCESS: 4, UNKNOWN: 5 };
      return (order[a.endToEndStatus as keyof typeof order] ?? 4) - (order[b.endToEndStatus as keyof typeof order] ?? 4);
    });
  }, [entities]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return chains.filter((c) => {
      const matchSearch = !q || c.groupId.toLowerCase().includes(q)
        || c.entities.some((e) => e.name.toLowerCase().includes(q));
      const matchStatus = statusFilter === "all" || c.endToEndStatus === statusFilter.toUpperCase();
      return matchSearch && matchStatus;
    });
  }, [chains, search, statusFilter]);

  const summary = useMemo(() => ({
    total: chains.length,
    failed: chains.filter((c) => c.endToEndStatus === "FAILED").length,
    partial: chains.filter((c) => c.endToEndStatus === "PARTIAL" || c.endToEndStatus === "WARNING").length,
    inProgress: chains.filter((c) => c.endToEndStatus === "IN_PROGRESS").length,
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
          {summary.inProgress > 0 && <span style={{ color: "#3B82F6", fontWeight: 600 }}>● {summary.inProgress} in progress</span>}
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
            <option value="in_progress">In progress</option>
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
              {chains.length === 0 ? "No chains found." : "No results for this filter."}
            </p>
          </div>
        ) : (
          filtered.map((chain) => <ChainCard key={chain.groupId} chain={chain} />)
        )}
      </div>
    </div>
  );
}
