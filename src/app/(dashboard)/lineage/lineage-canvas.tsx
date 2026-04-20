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
import { EntityNode } from "./entity-node";
import { NodeDetailPanel } from "./node-detail-panel";
import { ChevronDown, Search, RotateCcw } from "lucide-react";
import type { LineageHop } from "@/lib/adapters/types";

// ── Searchable combobox — shared by all lineage filter controls ────────────
export interface SearchableSelectProps {
  value: string;
  options: string[];
  /** If provided, an "All …" entry is prepended and value "all" maps to this label. */
  allLabel?: string;
  placeholder: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
  /** Minimum trigger button width (default 160) */
  minWidth?: number;
}

export function SearchableSelect({ value, options, allLabel, placeholder, onChange, style, minWidth = 160 }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayLabel = value === "all"
    ? (allLabel ?? "All")
    : value.length > 20 ? value.slice(0, 18) + "…" : value;

  const isPlaceholder = value === "all" || !value;

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Element)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const allOption = allLabel ? [{ id: "all", label: allLabel }] : [];
  const optionItems = [...allOption, ...filtered.map((o) => ({ id: o, label: o }))];

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 text-sm"
        style={{ ...style, minWidth, justifyContent: "space-between" }}
      >
        <span style={{ color: isPlaceholder ? "var(--color-text-muted)" : "var(--color-text)" }}>
          {displayLabel}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-muted)", transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 100,
            minWidth: 240,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(27,59,107,0.12)",
            overflow: "hidden",
          }}
        >
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-transparent text-sm outline-none flex-1"
              style={{ color: "var(--color-text)", caretColor: "var(--color-accent)" }}
            />
          </div>

          {/* Options list */}
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {optionItems.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { onChange(id); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm"
                style={{
                  background: value === id ? "rgba(200,137,42,0.1)" : "transparent",
                  color: value === id ? "var(--color-accent)" : "var(--color-text)",
                  fontFamily: id !== "all" ? "monospace" : undefined,
                  fontSize: id !== "all" ? "0.75rem" : undefined,
                }}
                onMouseEnter={(e) => { if (value !== id) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = value === id ? "rgba(200,137,42,0.1)" : "transparent"; }}
              >
                {label}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>No results</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const POSITIONS_KEY = "insights:lineage:positions";

/**
 * Returns all entity IDs reachable downstream from `startId` via BFS through `hops`.
 * Does not include startId itself.
 */
function getTransitiveDownstream(startId: string, hops: LineageHop[]): string[] {
  const visited = new Set<string>();
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const hop of hops) {
      if (hop.source_entity === current && !visited.has(hop.target_entity)) {
        visited.add(hop.target_entity);
        queue.push(hop.target_entity);
      }
    }
  }
  return [...visited];
}

/**
 * Returns all entity IDs that are upstream of `startId` via BFS through `hops`.
 */
function getTransitiveUpstream(startId: string, hops: LineageHop[]): string[] {
  const visited = new Set<string>();
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const hop of hops) {
      if (hop.target_entity === current && !visited.has(hop.source_entity)) {
        visited.add(hop.source_entity);
        queue.push(hop.source_entity);
      }
    }
  }
  return [...visited];
}

const nodeTypes: NodeTypes = {
  entity: EntityNode,
};

const LAYER_STEPS = [
  { value: "all", label: "All layers" },
  { value: "landing_to_raw", label: "Landing → Raw" },
  { value: "raw_to_bronze", label: "Raw → Bronze" },
  { value: "bronze_to_silver", label: "Bronze → Silver" },
  { value: "silver_to_gold", label: "Silver → Gold" },
] as const;

interface EntityData {
  label: string;
  type: string;
  ref: string;
  attributes: string[];
  hopCount: number;
  health: HealthStatus;
}

function buildGraph(hops: LineageHop[], datasetHealth?: Map<string, HealthStatus>) {
  const nodeMap = new Map<string, EntityData>();
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();

  for (const hop of hops) {
    // Source node
    const srcId = hop.source_entity;
    if (!nodeMap.has(srcId)) {
      nodeMap.set(srcId, {
        label: srcId,
        type: hop.source_type,
        ref: hop.source_ref,
        attributes: [],
        hopCount: 0,
        health: datasetHealth?.get(hop.dataset_id) ?? "unknown",
      });
    }
    const srcNode = nodeMap.get(srcId)!;
    srcNode.hopCount++;
    if (hop.source_attribute && !srcNode.attributes.includes(hop.source_attribute)) {
      srcNode.attributes.push(hop.source_attribute);
    }

    // Target node
    const tgtId = hop.target_entity;
    if (!nodeMap.has(tgtId)) {
      nodeMap.set(tgtId, {
        label: tgtId,
        type: hop.target_type,
        ref: hop.target_ref,
        attributes: [],
        hopCount: 0,
        health: datasetHealth?.get(hop.dataset_id) ?? "unknown",
      });
    }
    const tgtNode = nodeMap.get(tgtId)!;
    tgtNode.hopCount++;
    if (hop.target_attribute && !tgtNode.attributes.includes(hop.target_attribute)) {
      tgtNode.attributes.push(hop.target_attribute);
    }

    // Edge
    const edgeId = `${srcId}->${tgtId}`;
    if (!edgeSet.has(edgeId)) {
      edgeSet.add(edgeId);
      edges.push({
        id: edgeId,
        source: srcId,
        target: tgtId,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "var(--color-primary)", strokeWidth: 2 },
      });
    }
  }

  // Auto-layout: arrange nodes in layers (sources on left, targets on right)
  const sourceIds = new Set(hops.map((h) => h.source_entity));
  const targetIds = new Set(hops.map((h) => h.target_entity));
  const pureTargets = [...targetIds].filter((id) => !sourceIds.has(id));
  const pureSources = [...sourceIds].filter((id) => !targetIds.has(id));
  const middle = [...nodeMap.keys()].filter(
    (id) => !pureSources.includes(id) && !pureTargets.includes(id)
  );

  const layers = [pureSources, middle, pureTargets].filter((l) => l.length > 0);

  const nodes: Node[] = [];
  const xSpacing = 320;
  const ySpacing = 120;

  layers.forEach((layer, layerIdx) => {
    layer.forEach((id, nodeIdx) => {
      const data = nodeMap.get(id)!;
      nodes.push({
        id,
        type: "entity",
        position: {
          x: layerIdx * xSpacing,
          y: nodeIdx * ySpacing,
        },
        data: data as unknown as Record<string, unknown>,
      });
    });
  });

  // Apply saved positions (override auto-layout)
  const savedPositions = loadPositions();
  for (const node of nodes) {
    if (savedPositions[node.id]) {
      node.position = savedPositions[node.id];
    }
  }

  return { nodes, edges };
}

function loadPositions(): Record<string, { x: number; y: number }> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(POSITIONS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function savePositions(nodes: Node[]) {
  const positions: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    positions[node.id] = node.position;
  }
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
}

export type HealthStatus = "healthy" | "warning" | "error" | "unknown";

interface LineageCanvasProps {
  hops: LineageHop[];
  datasetHealth?: Map<string, HealthStatus>;
}

export function LineageCanvas({ hops, datasetHealth }: LineageCanvasProps) {
  const [search, setSearch] = useState("");
  const [selectedNode, setSelectedNode] = useState<EntityData | null>(null);
  const [datasetFilter, setDatasetFilter] = useState<string>("all");
  const [stepFilter, setStepFilter] = useState<string>("all");
  const [runIdFilter, setRunIdFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [healthFilter, setHealthFilter] = useState<Set<string>>(new Set());

  const datasets = useMemo(() => {
    const unique = [...new Set(hops.map((h) => h.dataset_id))].sort();
    return ["all", ...unique];
  }, [hops]);

  const availableDates = useMemo(() => {
    let base = hops;
    if (datasetFilter !== "all") base = base.filter((h) => h.dataset_id === datasetFilter);
    if (stepFilter !== "all") base = base.filter((h) => h.step === stepFilter);
    return [...new Set(base.map((h) => h.event_date))].sort((a, b) => b.localeCompare(a));
  }, [hops, datasetFilter, stepFilter]);

  const runIds = useMemo(() => {
    let base = hops;
    if (datasetFilter !== "all") base = base.filter((h) => h.dataset_id === datasetFilter);
    if (stepFilter !== "all") base = base.filter((h) => h.step === stepFilter);
    if (dateFilter !== "all") base = base.filter((h) => h.event_date === dateFilter);
    return [...new Set(base.map((h) => h.run_id))].sort((a, b) => b.localeCompare(a));
  }, [hops, datasetFilter, stepFilter, dateFilter]);

  const filteredHops = useMemo(() => {
    let result = hops;
    if (datasetFilter !== "all") {
      result = result.filter((h) => h.dataset_id === datasetFilter);
    }
    if (stepFilter !== "all") {
      result = result.filter((h) => h.step === stepFilter);
    }
    if (dateFilter !== "all") {
      result = result.filter((h) => h.event_date === dateFilter);
    }
    if (runIdFilter !== "all") {
      result = result.filter((h) => h.run_id === runIdFilter);
    }
    return result;
  }, [hops, datasetFilter, stepFilter, runIdFilter, dateFilter]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraph(filteredHops, datasetHealth),
    [filteredHops, datasetHealth]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Highlight matching nodes
  const filteredNodes = useMemo(() => {
    if (!search.trim()) return nodes;
    const q = search.toLowerCase();
    return nodes.map((node) => ({
      ...node,
      style: {
        ...node.style,
        opacity: node.id.toLowerCase().includes(q) ? 1 : 0.25,
      },
    }));
  }, [nodes, search]);

  const onNodeDragStop = useCallback(() => {
    // Use setTimeout to let React Flow update the nodes state first
    setTimeout(() => {
      setNodes((currentNodes) => {
        savePositions(currentNodes);
        return currentNodes;
      });
    }, 0);
  }, [setNodes]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node.data as unknown as EntityData);
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleResetLayout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(POSITIONS_KEY);
    }
    const { nodes: freshNodes, edges: freshEdges } = buildGraph(filteredHops, datasetHealth);
    setNodes(freshNodes);
    setEdges(freshEdges);
  }, [filteredHops, datasetHealth, setNodes, setEdges]);

  // Downstream impact: transitive chain via BFS
  const transitiveDownstream = useMemo(() => {
    if (!selectedNode) return [];
    return getTransitiveDownstream(selectedNode.label, hops);
  }, [selectedNode, hops]);

  const transitiveUpstream = useMemo(() => {
    if (!selectedNode) return [];
    return getTransitiveUpstream(selectedNode.label, hops);
  }, [selectedNode, hops]);

  // Last seen: most recent hop timestamp for this entity
  const lastSeen = useMemo(() => {
    if (!selectedNode) return undefined;
    const matching = hops
      .filter(h => h.source_entity === selectedNode.label || h.target_entity === selectedNode.label)
      .map(h => h.timestamp_utc)
      .sort((a, b) => b.localeCompare(a));
    return matching[0];
  }, [selectedNode, hops]);

  // Column-level flows for selected node
  const columnFlows = useMemo(() => {
    if (!selectedNode) return [];
    return hops
      .filter(h => h.source_entity === selectedNode.label && h.source_attribute && h.target_attribute)
      .map(h => ({
        sourceAttr: h.source_attribute!,
        targetAttr: h.target_attribute!,
        targetEntity: h.target_entity !== selectedNode.label ? h.target_entity : "",
      }));
  }, [selectedNode, hops]);

  // Entities that are at risk: downstream of any entity with "error" health
  const atRiskEntities = useMemo(() => {
    if (!datasetHealth) return new Set<string>();
    const errorEntities = hops
      .filter(h => datasetHealth.get(h.dataset_id) === "error")
      .map(h => h.source_entity);
    const atRisk = new Set<string>();
    for (const entity of errorEntities) {
      for (const downstream of getTransitiveDownstream(entity, hops)) {
        atRisk.add(downstream);
      }
    }
    return atRisk;
  }, [hops, datasetHealth]);

  // Apply at-risk and chain styling to nodes; optionally filter by health
  const displayNodes = useMemo(() => {
    return filteredNodes.filter(node => {
      if (healthFilter.size === 0) return true;
      const nodeHealth = (node.data as unknown as EntityData).health ?? "unknown";
      return healthFilter.has(nodeHealth);
    }).map(node => {
      const isAtRisk = atRiskEntities.has(node.id);
      const isSelected = selectedNode?.label === node.id;
      const isInChain = selectedNode
        ? transitiveDownstream.includes(node.id) || transitiveUpstream.includes(node.id)
        : false;
      return {
        ...node,
        style: {
          ...node.style,
          outline: isSelected ? "2px solid var(--color-accent)" : isInChain ? "2px solid rgba(200,137,42,0.4)" : undefined,
          outlineOffset: "2px",
          borderRadius: "8px",
        },
        data: {
          ...node.data,
          atRisk: isAtRisk && !isSelected,
        },
      };
    });
  }, [filteredNodes, selectedNode, atRiskEntities, transitiveDownstream, transitiveUpstream]);

  if (filteredHops.length === 0 && hops.length > 0) {
    return (
      <div className="flex items-center justify-center h-full rounded-xl border border-border bg-card text-muted-foreground">
        No lineage data matches the selected filters
      </div>
    );
  }

  if (hops.length === 0) {
    return (
      <div className="flex items-center justify-center h-full rounded-xl border border-border bg-card text-muted-foreground">
        No lineage data available for this date range
      </div>
    );
  }

  const panelStyle: React.CSSProperties = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    boxShadow: "var(--shadow-sm)",
    color: "var(--color-text)",
  };

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: "var(--color-bg)" }}>
      <ReactFlow
        nodes={displayNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background color="var(--color-border)" gap={20} size={1} />
        <Controls
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            boxShadow: "var(--shadow-sm)",
          }}
        />
        <MiniMap
          nodeColor="var(--color-brand, #1B3B6B)"
          maskColor="rgba(27,59,107,0.06)"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
          }}
          zoomable
          pannable
        />

        {/* Toolbar — search + filters */}
        <Panel position="top-left">
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="flex items-center gap-2 px-3 py-2"
              style={panelStyle}
            >
              <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
              <input
                type="text"
                placeholder="Search entities…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm outline-none w-36 lg:w-48"
                style={{ color: "var(--color-text)", caretColor: "var(--color-accent)" }}
              />
            </div>
            <SearchableSelect
              value={datasetFilter}
              options={datasets.filter(d => d !== "all")}
              allLabel="All datasets"
              placeholder="Search dataset…"
              onChange={setDatasetFilter}
              style={panelStyle}
            />
            <select
              value={stepFilter}
              onChange={(e) => setStepFilter(e.target.value)}
              className="px-3 py-2 text-sm outline-none cursor-pointer"
              style={{ ...panelStyle, paddingRight: 28 }}
            >
              {LAYER_STEPS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <SearchableSelect
              value={dateFilter}
              options={availableDates}
              allLabel="All dates"
              placeholder="Search date…"
              onChange={(v) => { setDateFilter(v); setRunIdFilter("all"); }}
              style={panelStyle}
            />
            <SearchableSelect
              value={runIdFilter}
              options={runIds}
              allLabel="All runs"
              placeholder="Search run ID…"
              onChange={setRunIdFilter}
              style={panelStyle}
            />
            {/* Health pill toggles */}
            <div className="flex items-center gap-1 px-2 py-1.5" style={panelStyle}>
              {(["healthy", "warning", "error"] as const).map((h) => {
                const color = h === "healthy" ? "#10B981" : h === "warning" ? "#F59E0B" : "#EF4444";
                const active = healthFilter.has(h);
                return (
                  <button
                    key={h}
                    onClick={() => setHealthFilter((prev) => {
                      const next = new Set(prev);
                      if (next.has(h)) next.delete(h); else next.add(h);
                      return next;
                    })}
                    className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-all"
                    style={{
                      background: active ? color : "transparent",
                      color: active ? "#fff" : "var(--color-text-muted)",
                      border: `1px solid ${active ? color : "var(--color-border)"}`,
                    }}
                    title={`Filter by ${h}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: active ? "#fff" : color }} />
                    {h.charAt(0).toUpperCase() + h.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
        </Panel>

        {/* Health legend */}
        <Panel position="bottom-left">
          <div className="flex items-center gap-3 px-3 py-2 text-xs" style={panelStyle}>
            {(["healthy", "warning", "error", "unknown"] as const).map((h) => (
              <div key={h} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{
                  background: h === "healthy" ? "#10B981" : h === "warning" ? "#F59E0B" : h === "error" ? "#EF4444" : "var(--color-border)"
                }} />
                <span style={{ color: "var(--color-text-muted)" }} className="capitalize">{h}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Stats badge + Reset layout */}
        <Panel position="top-right">
          <div className="flex items-center gap-2">
            <div
              className="px-3 py-2 text-xs"
              style={{ ...panelStyle, color: "var(--color-text-muted)" }}
            >
              <span style={{ color: "var(--color-text)", fontWeight: 500 }}>{nodes.length}</span> entities
              {" · "}
              <span style={{ color: "var(--color-text)", fontWeight: 500 }}>{edges.length}</span> connections
              {(datasetFilter !== "all" || stepFilter !== "all" || runIdFilter !== "all" || dateFilter !== "all" || healthFilter.size > 0) && (
                <span className="ml-2 font-medium" style={{ color: "var(--color-accent)" }}>
                  · filtered
                </span>
              )}
            </div>
            <button
              onClick={handleResetLayout}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
              style={{ ...panelStyle, color: "var(--color-text-muted)" }}
              title="Reset node positions to default"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset layout
            </button>
          </div>
        </Panel>
      </ReactFlow>

      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          impactCount={transitiveDownstream.length}
          upstreamCount={transitiveUpstream.length}
          lastSeen={lastSeen}
          columnFlows={columnFlows}
        />
      )}
    </div>
  );
}
