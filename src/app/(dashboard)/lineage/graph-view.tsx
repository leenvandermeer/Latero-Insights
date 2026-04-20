"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  MarkerType,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { RotateCcw, Search, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import type { LineageEntity, LineageAttribute } from "@/lib/adapters/types";
import { EntityNode } from "./entity-node";
import { EntityDetailPanel } from "./entity-detail-panel";

// ── Types ────────────────────────────────────────────────────────────────────

export type HealthStatus = "healthy" | "warning" | "error" | "unknown";

interface GraphNodeData {
  label: string;
  fullFqn: string;
  type: string;
  ref: string;
  attributes: string[];
  hopCount: number;
  health: HealthStatus;
  layer: string;
  end_to_end_status: string;
  latest_success_at: string | null;
  upstream_entity_fqns: string[];
  downstream_entity_fqns: string[];
  lineage_group_id: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const POSITIONS_KEY = "insights:lineage:entity-positions-v2";
const X_SPACING = 440;
const Y_SPACING = 160;

const LAYER_ORDER = ["landing", "raw", "bronze", "silver", "gold"];

const STATUS_EDGE_COLOR: Record<string, string> = {
  SUCCESS: "#10B981",
  WARNING: "#F59E0B",
  FAILED:  "#EF4444",
  UNKNOWN: "var(--color-border)",
};

const nodeTypes: NodeTypes = { entity: EntityNode };

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusToHealth(status: string): HealthStatus {
  switch (status.toUpperCase()) {
    case "SUCCESS": return "healthy";
    case "WARNING": return "warning";
    case "FAILED":  return "error";
    default:        return "unknown";
  }
}

function loadPositions(): Record<string, { x: number; y: number }> {
  if (typeof window === "undefined") return {};
  try {
    const s = localStorage.getItem(POSITIONS_KEY);
    return s ? JSON.parse(s) : {};
  } catch { return {}; }
}

function savePositions(nodes: Node[]) {
  if (typeof window === "undefined") return;
  const pos: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) pos[n.id] = n.position;
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(pos));
}

// ── Graph builder ─────────────────────────────────────────────────────────────

function buildGraph(entities: LineageEntity[]) {
  // Group by normalized layer
  const byLayer = new Map<string, LineageEntity[]>();
  for (const e of entities) {
    const l = e.layer.toLowerCase();
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(e);
  }

  // Ordered columns: known layers first, unknowns appended
  const cols = LAYER_ORDER.filter((l) => byLayer.has(l));
  for (const l of byLayer.keys()) {
    if (!cols.includes(l)) cols.push(l);
  }

  const saved = loadPositions();

  // Build nodes
  const nodes: Node[] = [];
  for (const col of cols) {
    const layerEntities = byLayer.get(col) ?? [];
    const x = cols.indexOf(col) * X_SPACING;
    const totalH = (layerEntities.length - 1) * Y_SPACING;
    layerEntities.forEach((e, i) => {
      const parts = e.entity_fqn.split(".");
      const data: GraphNodeData = {
        label: parts[parts.length - 1] ?? e.entity_fqn,
        fullFqn: e.entity_fqn,
        type: "table",
        ref: e.entity_fqn,
        attributes: [],
        hopCount: e.upstream_entity_fqns.length + e.downstream_entity_fqns.length,
        health: statusToHealth(e.latest_status),
        layer: e.layer,
        end_to_end_status: e.end_to_end_status,
        latest_success_at: e.latest_success_at,
        upstream_entity_fqns: e.upstream_entity_fqns,
        downstream_entity_fqns: e.downstream_entity_fqns,
        lineage_group_id: e.lineage_group_id,
      };
      nodes.push({
        id: e.entity_fqn,
        type: "entity",
        position: saved[e.entity_fqn] ?? { x, y: i * Y_SPACING - totalH / 2 },
        data: data as unknown as Record<string, unknown>,
      });
    });
  }

  // Build edges from downstream relationships
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();
  for (const e of entities) {
    for (const ds of e.downstream_entity_fqns) {
      const id = `${e.entity_fqn}->${ds}`;
      if (!edgeSet.has(id)) {
        edgeSet.add(id);
        const color = STATUS_EDGE_COLOR[e.latest_status] ?? STATUS_EDGE_COLOR.UNKNOWN;
        edges.push({
          id,
          source: e.entity_fqn,
          target: ds,
          type: "smoothstep",
          animated: e.latest_status === "SUCCESS",
          markerEnd: { type: MarkerType.ArrowClosed, color },
          style: { stroke: color, strokeWidth: 2 },
        });
      }
    }
  }

  return { nodes, edges };
}

// ── Main component ─────────────────────────────────────────────────────────────

interface GraphViewProps {
  entities: LineageEntity[];
  attributes: LineageAttribute[];
  refreshedAt?: string;
}

export function GraphView({ entities, attributes, refreshedAt }: GraphViewProps) {
  const [search, setSearch] = useState("");
  const [layerFilter, setLayerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedFqn, setSelectedFqn] = useState<string | null>(null);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraph(entities),
    [entities]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    const { nodes: n, edges: e } = buildGraph(entities);
    setNodes(n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities]);

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, __: Node, allNodes: Node[]) => savePositions(allNodes),
    []
  );

  const handleResetLayout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(POSITIONS_KEY);
    }
    const { nodes: n, edges: e } = buildGraph(entities);
    setNodes(n);
  }, [entities, setNodes]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const data = node.data as unknown as GraphNodeData;
    setSelectedFqn((prev) => (prev === data.fullFqn ? null : data.fullFqn));
  }, []);

  // Derive layer options from entities
  const layerOptions = useMemo(() => {
    const present = new Set(entities.map((e) => e.layer.toLowerCase()));
    return ["all", ...LAYER_ORDER.filter((l) => present.has(l)), ...[...present].filter((l) => !LAYER_ORDER.includes(l))];
  }, [entities]);

  // Apply filters as opacity on nodes
  const filteredNodes = useMemo(() => {
    const q = search.toLowerCase().trim();
    return nodes.map((n) => {
      const d = n.data as unknown as GraphNodeData;
      const matchSearch = !q || d.label.toLowerCase().includes(q) || d.fullFqn.toLowerCase().includes(q);
      const matchLayer = layerFilter === "all" || d.layer.toLowerCase() === layerFilter;
      const matchStatus = statusFilter === "all" || d.health === statusFilter;
      const visible = matchSearch && matchLayer && matchStatus;
      return { ...n, style: { ...(n.style ?? {}), opacity: visible ? 1 : 0.15 } };
    });
  }, [nodes, search, layerFilter, statusFilter]);

  const selectedEntity = useMemo(
    () => entities.find((e) => e.entity_fqn === selectedFqn) ?? null,
    [entities, selectedFqn]
  );

  // Navigate-to: select a node by FQN (from detail panel links)
  const handleNavigateTo = useCallback((fqn: string) => setSelectedFqn(fqn), []);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-4 py-2 shrink-0 flex-wrap"
        style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}
      >
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entities…"
            className="text-xs rounded-lg pl-7 pr-3 py-1.5 w-44 outline-none"
            style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setFiltersOpen((p) => !p)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
          style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)", background: filtersOpen ? "var(--color-surface)" : "transparent" }}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {filtersOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {filtersOpen && (
          <>
            {/* Layer filter */}
            <select
              value={layerFilter}
              onChange={(e) => setLayerFilter(e.target.value)}
              className="text-xs rounded-lg px-2.5 py-1.5 outline-none"
              style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            >
              {layerOptions.map((l) => (
                <option key={l} value={l}>{l === "all" ? "All layers" : l.charAt(0).toUpperCase() + l.slice(1)}</option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded-lg px-2.5 py-1.5 outline-none"
              style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            >
              <option value="all">All statuses</option>
              <option value="healthy">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Failed</option>
              <option value="unknown">Unknown</option>
            </select>
          </>
        )}

        {/* Reset layout */}
        <button
          onClick={handleResetLayout}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
          style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
          title="Reset node positions"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>

        <span className="ml-auto text-xs" style={{ color: "var(--color-text-muted)" }}>
          {entities.length} entit{entities.length === 1 ? "y" : "ies"}
          {refreshedAt && (
            <span> · bijgewerkt {(() => { try { return new Date(refreshedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); } catch { return refreshedAt; } })()}</span>
          )}
        </span>
      </div>

      {/* Canvas + detail panel */}
      <div className="flex-1 min-h-0 relative">
        <ReactFlow
          nodes={filteredNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onNodeClick={handleNodeClick}
          fitView
          minZoom={0.2}
          maxZoom={2}
          className="bg-[var(--color-surface)]"
        >
          <Background color="var(--color-border)" gap={24} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              const d = n.data as unknown as GraphNodeData;
              const h = d?.health ?? "unknown";
              if (h === "healthy") return "#10B981";
              if (h === "warning") return "#F59E0B";
              if (h === "error")   return "#EF4444";
              return "var(--color-border)";
            }}
            style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
          />
          {entities.length === 0 && (
            <Panel position="top-center">
              <div
                className="rounded-lg px-4 py-3 text-sm text-center"
                style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
              >
                Geen lineage-entiteiten gevonden. Controleer de verbinding of ververs de cache.
              </div>
            </Panel>
          )}
        </ReactFlow>

        {/* Detail panel */}
        {selectedEntity && (
          <EntityDetailPanel
            entity={selectedEntity}
            attributes={attributes}
            onClose={() => setSelectedFqn(null)}
            onNavigateTo={handleNavigateTo}
          />
        )}
      </div>
    </div>
  );
}
