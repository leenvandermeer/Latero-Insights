"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Database, CheckCircle, AlertTriangle, XCircle, Minus, Columns, ChevronDown, RotateCcw } from "lucide-react";
import { SearchableSelect } from "./lineage-canvas";
import type { LineageHop } from "@/lib/adapters/types";
import { NodeDetailPanel } from "./node-detail-panel";

// ── Types ──────────────────────────────────────────────────────────────
type HealthStatus = "healthy" | "warning" | "error" | "unknown";

interface ChainNode {
  layer: string;
  entity: string;
  ref: string;
  type: string;
  health: HealthStatus;
  attributes: string[];
  hopCount: number;
}

interface ChainEdge {
  step: string;
  fromLayer: string;
  toLayer: string;
  health: HealthStatus;
  hopCount: number;
}

// ── Constants ─────────────────────────────────────────────────────────
const NODE_W = 260;
const H_GAP = 100;

const STEP_ORDER = [
  "landing_to_raw",
  "raw_to_bronze",
  "bronze_to_silver",
  "silver_to_gold",
];

const STEP_LABEL: Record<string, string> = {
  landing_to_raw:   "Landing → Raw",
  raw_to_bronze:    "Raw → Bronze",
  bronze_to_silver: "Bronze → Silver",
  silver_to_gold:   "Silver → Gold",
};

const STEP_LAYERS: Record<string, [string, string]> = {
  landing_to_raw:   ["Landing", "Raw"],
  raw_to_bronze:    ["Raw",     "Bronze"],
  bronze_to_silver: ["Bronze",  "Silver"],
  silver_to_gold:   ["Silver",  "Gold"],
};

const LAYER_ORDER = ["Landing", "Raw", "Bronze", "Silver", "Gold"];

const HEALTH_COLOR: Record<HealthStatus, string> = {
  healthy: "#10B981",
  warning: "#F59E0B",
  error:   "#EF4444",
  unknown: "var(--color-border)",
};

const HEALTH_BG: Record<HealthStatus, string> = {
  healthy: "rgba(16,185,129,0.08)",
  warning: "rgba(245,158,11,0.08)",
  error:   "rgba(239,68,68,0.08)",
  unknown: "transparent",
};

// ── Position persistence ───────────────────────────────────────────────
const CHAIN_POSITIONS_KEY = "insights:lineage:chain-positions";

function loadChainPositions(dataset: string): Record<string, { x: number; y: number }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CHAIN_POSITIONS_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, Record<string, { x: number; y: number }>>) : {};
    return all[dataset] ?? {};
  } catch {
    return {};
  }
}

function saveChainPositions(dataset: string, nodes: Node[]) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(CHAIN_POSITIONS_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, Record<string, { x: number; y: number }>>) : {};
    const positions: Record<string, { x: number; y: number }> = {};
    for (const n of nodes) positions[n.id] = n.position;
    all[dataset] = positions;
    localStorage.setItem(CHAIN_POSITIONS_KEY, JSON.stringify(all));
  } catch {
    // storage unavailable
  }
}

function clearChainPositions(dataset: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(CHAIN_POSITIONS_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, Record<string, { x: number; y: number }>>) : {};
    delete all[dataset];
    localStorage.setItem(CHAIN_POSITIONS_KEY, JSON.stringify(all));
  } catch {
    // storage unavailable
  }
}

function defaultPosition(index: number): { x: number; y: number } {
  return { x: index * (NODE_W + H_GAP), y: 0 };
}

// ── Main component ─────────────────────────────────────────────────────
interface ChainViewProps {
  hops: LineageHop[];
  datasetHealth: Map<string, HealthStatus>;
}

export function ChainView({ hops, datasetHealth }: ChainViewProps) {
  const datasets = useMemo(() => {
    const ids = new Set(hops.map(h => h.dataset_id));
    return Array.from(ids).sort();
  }, [hops]);

  const [selectedDataset, setSelectedDataset] = useState<string>(() => datasets[0] ?? "");
  const [selectedChainNode, setSelectedChainNode] = useState<ChainNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeHealth, setActiveHealth] = useState<Set<HealthStatus>>(
    () => new Set(["healthy", "warning", "error", "unknown"])
  );

  const effectiveDataset = datasets.includes(selectedDataset) ? selectedDataset : (datasets[0] ?? "");

  // Build chain nodes + edges from hops
  const { chainNodes, chainEdges } = useMemo(() => {
    const datasetHops = hops.filter(h => h.dataset_id === effectiveDataset);
    const layerMap = new Map<string, { entity: string; ref: string; type: string; attrs: Set<string>; hopCount: number }>();

    for (const hop of datasetHops) {
      const layers = STEP_LAYERS[hop.step];
      if (!layers) continue;
      const [srcLayer, tgtLayer] = layers;

      const srcEntry = layerMap.get(srcLayer) ?? { entity: hop.source_entity, ref: hop.source_ref, type: hop.source_type, attrs: new Set<string>(), hopCount: 0 };
      srcEntry.hopCount++;
      if (hop.source_attribute) srcEntry.attrs.add(hop.source_attribute);
      layerMap.set(srcLayer, srcEntry);

      const tgtEntry = layerMap.get(tgtLayer) ?? { entity: hop.target_entity, ref: hop.target_ref, type: hop.target_type, attrs: new Set<string>(), hopCount: 0 };
      if (hop.target_attribute) tgtEntry.attrs.add(hop.target_attribute);
      layerMap.set(tgtLayer, tgtEntry);
    }

    const chainNodes: ChainNode[] = LAYER_ORDER
      .filter(l => layerMap.has(l))
      .map(layer => {
        const entry = layerMap.get(layer)!;
        return {
          layer,
          entity: entry.entity,
          ref: entry.ref,
          type: entry.type,
          health: datasetHealth.get(effectiveDataset) ?? "unknown",
          attributes: Array.from(entry.attrs).sort(),
          hopCount: entry.hopCount,
        };
      });

    const chainEdges: ChainEdge[] = STEP_ORDER
      .filter(step => datasetHops.some(h => h.step === step))
      .map(step => {
        const [fromLayer, toLayer] = STEP_LAYERS[step];
        return {
          step,
          fromLayer,
          toLayer,
          health: datasetHealth.get(effectiveDataset) ?? "unknown",
          hopCount: datasetHops.filter(h => h.step === step).length,
        };
      });

    return { chainNodes, chainEdges };
  }, [hops, effectiveDataset, datasetHealth]);

  // Build initial RF nodes (with saved positions)
  const buildInitialNodes = useCallback((nodes: ChainNode[], dataset: string): Node[] => {
    const saved = loadChainPositions(dataset);
    return nodes.map((cn, i) => ({
      id: cn.layer,
      type: "chainNode",
      position: saved[cn.layer] ?? defaultPosition(i),
      data: cn as unknown as Record<string, unknown>,
      draggable: true,
      width: NODE_W,
    }));
  }, []);

  const buildEdges = useCallback((edges: ChainEdge[]): Edge[] =>
    edges.map(ce => ({
      id: `${ce.fromLayer}-${ce.toLayer}`,
      source: ce.fromLayer,
      target: ce.toLayer,
      label: STEP_LABEL[ce.step],
      labelStyle: { fontSize: 10, fill: "var(--color-text-muted)", fontFamily: "inherit" },
      labelBgStyle: { fill: "var(--color-card)", fillOpacity: 0.95 },
      labelBgPadding: [4, 6] as [number, number],
      labelBgBorderRadius: 4,
      style: {
        stroke: HEALTH_COLOR[ce.health],
        strokeWidth: 2,
        strokeDasharray: ce.health === "error" ? "6 3" : undefined,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: HEALTH_COLOR[ce.health],
        width: 16,
        height: 16,
      },
      animated: ce.health !== "error",
    })),
  []);

  const [nodes, setNodes, onNodesChange] = useNodesState(buildInitialNodes(chainNodes, effectiveDataset));
  const [edges, setEdges, onEdgesChange] = useEdgesState(buildEdges(chainEdges));

  // Reinitialize when dataset or chain data changes
  useEffect(() => {
    setNodes(buildInitialNodes(chainNodes, effectiveDataset));
    setEdges(buildEdges(chainEdges));
    setSelectedChainNode(null);
    setSearchQuery("");
    setActiveHealth(new Set(["healthy", "warning", "error", "unknown"]));
  }, [effectiveDataset, chainNodes, chainEdges, buildInitialNodes, buildEdges, setNodes, setEdges]);

  // Persist positions on drag end
  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, __: Node, allNodes: Node[]) => {
      saveChainPositions(effectiveDataset, allNodes);
    },
    [effectiveDataset]
  );

  // Reset layout for this dataset
  const handleResetLayout = useCallback(() => {
    clearChainPositions(effectiveDataset);
    const reset = chainNodes.map((cn, i) => ({
      id: cn.layer,
      type: "chainNode",
      position: defaultPosition(i),
      data: cn as unknown as Record<string, unknown>,
      draggable: true,
      width: NODE_W,
    }));
    setNodes(reset);
  }, [effectiveDataset, chainNodes, setNodes]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const cn = node.data as unknown as ChainNode;
      setSelectedChainNode((prev) => (prev?.layer === cn.layer ? null : cn));
    },
    []
  );

  // Derived: apply search and health filters as opacity on RF nodes
  const filteredNodes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return nodes.map((n) => {
      const cn = n.data as unknown as ChainNode;
      const matchesSearch = !q || cn.entity.toLowerCase().includes(q) || cn.layer.toLowerCase().includes(q);
      const matchesHealth = activeHealth.has(cn.health);
      const opacity = matchesSearch && matchesHealth ? 1 : 0.2;
      return { ...n, style: { ...(n.style ?? {}), opacity } };
    });
  }, [nodes, searchQuery, activeHealth]);

  const toggleHealth = useCallback((h: HealthStatus) => {
    setActiveHealth((prev) => {
      const next = new Set(prev);
      if (next.has(h)) {
        next.delete(h);
      } else {
        next.add(h);
      }
      return next;
    });
  }, []);

  const nodeTypes = useMemo(() => ({ chainNode: ChainNodeComponent }), []);

  return (
    <div className="flex flex-col h-full relative">
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-4 py-2 shrink-0 flex-wrap"
        style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}
      >
        {/* Entity search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entities…"
            className="text-xs rounded-lg pl-7 pr-3 py-1.5 w-44 outline-none"
            style={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
          <svg
            className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
            style={{ color: "var(--color-text-muted)" }}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </div>

        {/* Dataset selector */}
        <SearchableSelect
          value={effectiveDataset}
          options={datasets}
          placeholder="Search dataset…"
          onChange={setSelectedDataset}
          style={{
            background: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            color: "var(--color-text)",
          }}
          minWidth={180}
        />

        {/* Health toggles */}
        <div className="flex items-center gap-1">
          {(["healthy", "warning", "error"] as const).map((h) => {
            const active = activeHealth.has(h);
            return (
              <button
                key={h}
                onClick={() => toggleHealth(h)}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity"
                style={{
                  border: `1px solid ${HEALTH_COLOR[h]}`,
                  color: active ? "#fff" : HEALTH_COLOR[h],
                  background: active ? HEALTH_COLOR[h] : "transparent",
                  opacity: active ? 1 : 0.55,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? "#fff" : HEALTH_COLOR[h] }} />
                {h.charAt(0).toUpperCase() + h.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Reset layout button */}
        <button
          onClick={handleResetLayout}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
          style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)", background: "transparent" }}
          title="Reset node positions to default"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset layout
        </button>

        {/* Stats */}
        <span className="ml-auto text-xs" style={{ color: "var(--color-text-muted)" }}>
          {nodes.length} layers · {edges.length} steps
        </span>
      </div>

      {/* Empty state */}
      {chainNodes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>No pipeline chain found</p>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {datasets.length === 0
                ? "No lineage data available. Try loading the Current Structure first."
                : `No chain data for dataset "${effectiveDataset}".`}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ReactFlow
            nodes={filteredNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={handleNodeDragStop}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="var(--color-border)" gap={24} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={n => HEALTH_COLOR[(n.data as unknown as ChainNode).health]}
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
              }}
            />
          </ReactFlow>
        </div>
      )}
      {selectedChainNode && (
        <NodeDetailPanel
          node={{
            label: selectedChainNode.entity,
            type: selectedChainNode.type || "table",
            ref: selectedChainNode.ref,
            attributes: selectedChainNode.attributes,
            hopCount: selectedChainNode.hopCount,
            health: selectedChainNode.health,
          }}
          onClose={() => setSelectedChainNode(null)}
        />
      )}
    </div>
  );
}

// ── Chain node ReactFlow component ─────────────────────────────────────
function ChainNodeComponent({ data }: NodeProps) {
  const cn = data as unknown as ChainNode;
  const [expanded, setExpanded] = useState(false);
  const h = cn.health;
  const borderColor = HEALTH_COLOR[h];
  const bg = HEALTH_BG[h];

  const HealthIcon = h === "healthy" ? CheckCircle
    : h === "warning" ? AlertTriangle
    : h === "error" ? XCircle
    : Minus;

  return (
    <div
      style={{
        background: "var(--color-card)",
        border: `2px solid ${borderColor}`,
        borderRadius: 14,
        width: NODE_W,
        boxShadow: `0 2px 12px ${bg}`,
        fontFamily: "inherit",
        position: "relative",
        cursor: "grab",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: borderColor, border: "none", width: 10, height: 10 }} />
      <Handle type="source" position={Position.Right} style={{ background: borderColor, border: "none", width: 10, height: 10 }} />

      {/* Layer badge */}
      <div
        className="absolute -top-3 left-4 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
        style={{ background: borderColor, color: "#fff", letterSpacing: "0.08em" }}
      >
        {cn.layer}
      </div>

      <div className="px-4 pt-5 pb-3 space-y-2">
        {/* Entity name + health */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Database className="h-4 w-4 shrink-0" style={{ color: "var(--color-accent)" }} />
            <span className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
              {cn.entity}
            </span>
          </div>
          <HealthIcon className="h-4 w-4 shrink-0" style={{ color: borderColor }} />
        </div>

        {/* Full ref — truncated with tooltip */}
        <p
          className="text-[10px] font-mono truncate"
          style={{ color: "var(--color-text-muted)" }}
          title={cn.ref}
        >
          {cn.ref}
        </p>

        {/* Attributes toggle */}
        {cn.attributes.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 text-xs w-full text-left mt-1"
            style={{ color: "var(--color-text-muted)", cursor: "pointer" }}
          >
            <Columns className="h-3 w-3" />
            {cn.attributes.length} column{cn.attributes.length !== 1 ? "s" : ""}
            <ChevronDown
              className="h-3 w-3 ml-auto transition-transform"
              style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>
        )}

        {expanded && cn.attributes.length > 0 && (
          <div
            className="rounded-lg px-2 py-2 space-y-0.5 max-h-32 overflow-y-auto"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            {cn.attributes.map(attr => (
              <p key={attr} className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>
                {attr}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
