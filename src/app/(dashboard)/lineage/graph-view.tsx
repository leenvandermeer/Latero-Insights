"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  type ReactFlowInstance,
  MarkerType,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { RotateCcw, Search, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import type { LineageEntity, LineageAttribute } from "@/lib/adapters/types";
import { EntityNode } from "./entity-node";
import { EntityDetailPanel } from "./entity-detail-panel";
import {
  LINEAGE_LAYER_ORDER,
  areAdjacentLineageLayers,
  lineageEntityKey,
  lineageLayerIndex,
  resolveLineageRef,
} from "./lineage-utils";

// ── Types ────────────────────────────────────────────────────────────────────

export type HealthStatus = "healthy" | "warning" | "error" | "unknown";

interface GraphNodeData {
  label: string;
  nodeId: string;
  fullFqn: string;
  type: string;
  ref: string;
  attributes: string[];
  hopCount: number;
  health: HealthStatus;
  layer: string;
  latest_status: string;
  end_to_end_status: string;
  latest_success_at: string | null;
  upstream_entity_fqns: string[];
  downstream_entity_fqns: string[];
  lineage_group_id: string | null;
}

type VirtualFileRef = {
  ref: string;
  refs: string[];
  targetKey: string;
  targetEntity: LineageEntity;
  targetIndex: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const POSITIONS_KEY = "insights:lineage:entity-positions-v4";
const X_SPACING = 440;
const Y_SPACING = 160;
const FILE_LANE_OFFSET = 220;
const FILE_STACK_SPACING = 82;

const LAYER_ORDER: string[] = [...LINEAGE_LAYER_ORDER];

const STATUS_EDGE_COLOR: Record<string, string> = {
  SUCCESS: "#10B981",
  IN_PROGRESS: "#3B82F6",
  WARNING: "#F59E0B",
  PARTIAL: "#F59E0B",
  FAILED:  "#EF4444",
  UNKNOWN: "var(--color-border)",
};

const FILE_REF_PATTERN = /\.(csv|json|jsonl|parquet|avro|xlsx?)($|[?#])/i;

const nodeTypes: NodeTypes = { entity: EntityNode };

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusToHealth(status: string): HealthStatus {
  switch (status.toUpperCase()) {
    case "SUCCESS": return "healthy";
    case "IN_PROGRESS": return "warning";
    case "PARTIAL": return "warning";
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

function mergeUnique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

function pickPreferredStatus(...statuses: Array<string | null | undefined>) {
  const rank: Record<string, number> = { FAILED: 4, WARNING: 3, PARTIAL: 2, SUCCESS: 1, UNKNOWN: 0 };
  return statuses
    .filter((status): status is string => Boolean(status))
    .sort((a, b) => (rank[b.toUpperCase()] ?? -1) - (rank[a.toUpperCase()] ?? -1))[0] ?? "UNKNOWN";
}

function normalizeLineageEntities(entities: LineageEntity[]) {
  const merged = new Map<string, LineageEntity>();

  for (const entity of entities) {
    const key = lineageEntityKey(entity);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...entity,
        upstream_entity_fqns: mergeUnique(entity.upstream_entity_fqns),
        downstream_entity_fqns: mergeUnique(entity.downstream_entity_fqns),
      });
      continue;
    }

    merged.set(key, {
      ...existing,
      layer: existing.layer || entity.layer,
      latest_status: pickPreferredStatus(existing.latest_status, entity.latest_status),
      end_to_end_status: pickPreferredStatus(existing.end_to_end_status, entity.end_to_end_status),
      latest_success_at: [existing.latest_success_at, entity.latest_success_at]
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => b.localeCompare(a))[0] ?? null,
      upstream_entity_fqns: mergeUnique([...existing.upstream_entity_fqns, ...entity.upstream_entity_fqns]),
      downstream_entity_fqns: mergeUnique([...existing.downstream_entity_fqns, ...entity.downstream_entity_fqns]),
      lineage_group_id: existing.lineage_group_id ?? entity.lineage_group_id,
      last_completed_layer: existing.last_completed_layer ?? entity.last_completed_layer,
    });
  }

  return [...merged.values()];
}

function layerIndex(entity: LineageEntity) {
  const idx = lineageLayerIndex(entity);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

function adjacentLayer(entity: LineageEntity, direction: "upstream" | "downstream") {
  const idx = lineageLayerIndex(entity);
  if (idx === -1) return undefined;
  return LINEAGE_LAYER_ORDER[idx + (direction === "downstream" ? 1 : -1)];
}

function neighborBySameFqn(entity: LineageEntity, entities: LineageEntity[], direction: "upstream" | "downstream") {
  const currentIdx = layerIndex(entity);
  const candidates = entities
    .filter((candidate) => candidate.entity_fqn === entity.entity_fqn && candidate.layer.toLowerCase() !== entity.layer.toLowerCase())
    .sort((a, b) => layerIndex(a) - layerIndex(b));

  if (direction === "downstream") {
    return candidates.find((candidate) => layerIndex(candidate) === currentIdx + 1) ?? null;
  }

  return candidates.reverse().find((candidate) => layerIndex(candidate) === currentIdx - 1) ?? null;
}

const LAYER_NAME_SET = new Set(LAYER_ORDER);

function datasetKey(entity: LineageEntity): string {
  if (entity.lineage_group_id) return entity.lineage_group_id;
  const parts = entity.entity_fqn.split(".").filter(Boolean);
  // Live FQN format: "catalog.schema.table" — schema is the stable group key (e.g. "cbs_arbeid")
  const second = parts.at(-2);
  if (second && !LAYER_NAME_SET.has(second.toLowerCase())) return second;
  // Demo FQN format: "catalog.layer.table" — at(-2) IS a layer name; strip layer suffix from table name
  const last = parts.at(-1) ?? entity.entity_fqn;
  return last.replace(/_(raw|bronze|silver|gold)$/i, "") || last;
}

function fileName(ref: string) {
  const clean = ref.split(/[?#]/)[0];
  const parts = clean.split("/").filter(Boolean);
  return parts.at(-1) ?? ref;
}

function sourceGroupKey(ref: string) {
  return ref
    .replace(/\/run_id=[^/]+/i, "")
    .replace(/([?&]run_id=)[^&]+/i, "$1*");
}

function sourceDisplayName(ref: string, count: number) {
  const name = fileName(ref);
  return count > 1 ? `${name} (${count} runs)` : name;
}

function fileLayer(ref: string) {
  const lower = ref.toLowerCase();
  const match = lower.match(/\/(landing|raw|bronze|silver|gold)(?:\/|$)|\.(landing|raw|bronze|silver|gold)\./);
  return match?.[1] ?? match?.[2] ?? "file";
}

function isFileRef(ref: string) {
  return FILE_REF_PATTERN.test(ref.split("/").pop() ?? ref);
}

function chainSortKey(entity: LineageEntity) {
  return `${datasetKey(entity)}::${layerIndex(entity)}::${entity.entity_fqn}`;
}

function resolveRefForDirection(ref: string, entity: LineageEntity, entities: LineageEntity[], direction: "upstream" | "downstream") {
  if (ref === entity.entity_fqn) {
    return neighborBySameFqn(entity, entities, direction);
  }

  const resolved = resolveLineageRef(ref, entities, { expectedLayer: adjacentLayer(entity, direction) });
  if (!resolved) return null;

  const matches = entities.filter((candidate) => candidate.entity_fqn === resolved.entity_fqn);
  if (matches.length <= 1) return resolved;

  const currentIdx = layerIndex(entity);
  const sorted = matches.sort((a, b) => layerIndex(a) - layerIndex(b));
  if (direction === "downstream") {
    return sorted.find((candidate) => layerIndex(candidate) === currentIdx + 1) ?? resolved;
  }

  return sorted.reverse().find((candidate) => layerIndex(candidate) === currentIdx - 1) ?? resolved;
}

function pushLayerEdge(edges: Edge[], edgeSet: Set<string>, sourceEntity: LineageEntity, targetEntity: LineageEntity) {
  if (!areAdjacentLineageLayers(sourceEntity, targetEntity)) return;

  const source = lineageEntityKey(sourceEntity);
  const target = lineageEntityKey(targetEntity);
  if (source === target) return;

  const id = `${source}->${target}`;
  if (edgeSet.has(id)) return;

  edgeSet.add(id);
  const color = STATUS_EDGE_COLOR[sourceEntity.latest_status] ?? STATUS_EDGE_COLOR.UNKNOWN;
  edges.push({
    id,
    source,
    target,
    type: "smoothstep",
    animated: sourceEntity.latest_status === "SUCCESS",
    markerEnd: { type: MarkerType.ArrowClosed, color },
    style: { stroke: color, strokeWidth: 2 },
  });
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
  const rowByDataset = new Map<string, number>();
  const sortedDatasets = [...new Set(entities.map(datasetKey))].sort();
  sortedDatasets.forEach((dataset, index) => rowByDataset.set(dataset, index));
  const virtualFileCountByTarget = new Map<string, number>();

  // Build nodes
  const nodes: Node[] = [];
  const virtualFiles: VirtualFileRef[] = [];
  for (const col of cols) {
    const layerEntities = [...(byLayer.get(col) ?? [])].sort((a, b) => chainSortKey(a).localeCompare(chainSortKey(b)));
    const x = cols.indexOf(col) * X_SPACING;
    layerEntities.forEach((e, i) => {
      const parts = e.entity_fqn.split(".");
      const nodeId = lineageEntityKey(e);
      const row = rowByDataset.get(datasetKey(e)) ?? i;
      const data: GraphNodeData = {
        label: parts[parts.length - 1] ?? e.entity_fqn,
        nodeId,
        fullFqn: e.entity_fqn,
        type: "table",
        ref: e.entity_fqn,
        attributes: [],
        hopCount: e.upstream_entity_fqns.length + e.downstream_entity_fqns.length,
        health: statusToHealth(e.latest_status),
        layer: e.layer,
        latest_status: e.latest_status,
        end_to_end_status: e.end_to_end_status,
        latest_success_at: e.latest_success_at,
        upstream_entity_fqns: e.upstream_entity_fqns,
        downstream_entity_fqns: e.downstream_entity_fqns,
        lineage_group_id: e.lineage_group_id,
      };
      nodes.push({
        id: nodeId,
        type: "entity",
        position: { x, y: row * Y_SPACING },
        data: data as unknown as Record<string, unknown>,
      });

      if (e.layer.toLowerCase() === "bronze") {
        const groupedRefs = new Map<string, string[]>();
        e.upstream_entity_fqns.filter(isFileRef).forEach((ref) => {
          const key = sourceGroupKey(ref);
          groupedRefs.set(key, [...(groupedRefs.get(key) ?? []), ref]);
        });

        for (const [ref, refs] of groupedRefs.entries()) {
          const targetIndex = virtualFileCountByTarget.get(nodeId) ?? 0;
          virtualFileCountByTarget.set(nodeId, targetIndex + 1);
          virtualFiles.push({ ref, refs, targetKey: nodeId, targetEntity: e, targetIndex });
        }
      }
    });
  }

  for (const file of virtualFiles) {
    const targetNode = nodes.find((node) => node.id === file.targetKey);
    if (!targetNode) continue;

    const id = `file::${file.targetKey}::${file.ref}`;
    const layer = fileLayer(file.ref);
    const data: GraphNodeData = {
      label: sourceDisplayName(file.ref, file.refs.length),
      nodeId: id,
      fullFqn: file.refs.join("\n"),
      type: "file",
      ref: file.ref,
      attributes: [],
      hopCount: file.refs.length,
      health: statusToHealth(file.targetEntity.latest_status),
      layer,
      latest_status: file.targetEntity.latest_status,
      end_to_end_status: file.targetEntity.end_to_end_status,
      latest_success_at: file.targetEntity.latest_success_at,
      upstream_entity_fqns: [],
      downstream_entity_fqns: [file.targetEntity.entity_fqn],
      lineage_group_id: file.targetEntity.lineage_group_id,
    };

    nodes.push({
      id,
      type: "entity",
      position: {
        x: targetNode.position.x - FILE_LANE_OFFSET,
        y: targetNode.position.y + (file.targetIndex + 1) * FILE_STACK_SPACING,
      },
      data: data as unknown as Record<string, unknown>,
      draggable: true,
    });
  }

  const savedIds = new Set(Object.keys(saved));
  const overlap = nodes.reduce((count, node) => count + (savedIds.has(node.id) ? 1 : 0), 0);
  const overlapRatio = nodes.length > 0 ? overlap / nodes.length : 0;

  // Only restore persisted positions when they mostly match the current graph.
  // This prevents stale coordinates from old data/model versions from skewing alignment.
  if (overlapRatio >= 0.8) {
    for (const node of nodes) {
      if (saved[node.id]) {
        node.position = saved[node.id];
      }
    }
  }

  // Build edges — prefer downstream refs, fall back to upstream refs.
  // Databricks refs may use a physical table name such as workspace.bronze.foo_raw
  // while current entities expose the product FQN, so resolve through shared heuristics.
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();

  for (const e of entities) {
    const sameFqnDownstream = neighborBySameFqn(e, entities, "downstream");
    if (sameFqnDownstream) {
      pushLayerEdge(edges, edgeSet, e, sameFqnDownstream);
    }

    // Edges from downstream refs (source = e, target = ds)
    for (const ds of e.downstream_entity_fqns) {
      const resolved = resolveRefForDirection(ds, e, entities, "downstream");
      if (resolved) pushLayerEdge(edges, edgeSet, e, resolved);
    }

    // Edges from upstream refs (source = up, target = e)
    for (const up of e.upstream_entity_fqns) {
      const resolved = resolveRefForDirection(up, e, entities, "upstream");
      if (resolved) pushLayerEdge(edges, edgeSet, resolved, e);
    }
  }

  for (const file of virtualFiles) {
    const source = `file::${file.targetKey}::${file.ref}`;
    const target = file.targetKey;
    const id = `${source}->${target}`;
    if (edgeSet.has(id)) continue;
    edgeSet.add(id);
    const color = STATUS_EDGE_COLOR[file.targetEntity.latest_status] ?? STATUS_EDGE_COLOR.UNKNOWN;
    edges.push({
      id,
      source,
      target,
      type: "smoothstep",
      animated: file.targetEntity.latest_status === "SUCCESS",
      markerEnd: { type: MarkerType.ArrowClosed, color },
      style: { stroke: color, strokeWidth: 2, strokeDasharray: "4 4" },
      label: `${fileLayer(file.ref)} file`,
      labelStyle: { fill: "var(--color-text-muted)", fontSize: 10, fontWeight: 600 },
      labelBgStyle: { fill: "var(--color-card)", fillOpacity: 0.9 },
    });
  }

  return { nodes, edges };
}

// ── Main component ─────────────────────────────────────────────────────────────

interface GraphViewProps {
  entities: LineageEntity[];
  attributes: LineageAttribute[];
  refreshedAt?: string;
  onOpenColumns?: (query?: string) => void;
}

export function GraphView({ entities, attributes, refreshedAt, onOpenColumns }: GraphViewProps) {
  const [search, setSearch] = useState("");
  const [layerFilter, setLayerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);

  const normalizedEntities = useMemo(() => normalizeLineageEntities(entities), [entities]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraph(normalizedEntities),
    [normalizedEntities]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    const { nodes: n, edges: e } = buildGraph(normalizedEntities);
    setNodes(n);
    setEdges(e);
  }, [normalizedEntities, setNodes, setEdges]);

  useEffect(() => {
    if (!flow) return;
    window.requestAnimationFrame(() => {
      flow.fitView({ padding: 0.18, duration: 250 });
    });
  }, [flow, initialNodes.length, initialEdges.length]);

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, __: Node, allNodes: Node[]) => savePositions(allNodes),
    []
  );

  const handleResetLayout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(POSITIONS_KEY);
    }
    const { nodes: n, edges: e } = buildGraph(normalizedEntities);
    setNodes(n);
    setEdges(e);
    setSearch("");
    setLayerFilter("all");
    setStatusFilter("all");
    setSelectedNodeId(null);
    window.requestAnimationFrame(() => {
      flow?.fitView({ padding: 0.18, duration: 300 });
    });
  }, [flow, normalizedEntities, setNodes, setEdges]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const data = node.data as unknown as GraphNodeData;
    setSelectedNodeId((prev) => (prev === data.nodeId ? null : data.nodeId));
  }, []);

  // Derive layer options from entities
  const layerOptions = useMemo(() => {
    const present = new Set(normalizedEntities.map((e) => e.layer.toLowerCase()));
    return ["all", ...LAYER_ORDER.filter((l) => present.has(l)), ...[...present].filter((l) => !LAYER_ORDER.includes(l))];
  }, [normalizedEntities]);

  // Apply filters as opacity on nodes
  const filteredNodes = useMemo(() => {
    const q = search.toLowerCase().trim();
    return nodes.map((n) => {
      const d = n.data as unknown as GraphNodeData;
      const matchSearch = !q || d.label.toLowerCase().includes(q) || d.fullFqn.toLowerCase().includes(q);
      const matchLayer = layerFilter === "all" || d.layer.toLowerCase() === layerFilter;
      const matchStatus = statusFilter === "all" || d.latest_status.toLowerCase() === statusFilter;
      const visible = matchSearch && matchLayer && matchStatus;
      return { ...n, style: { ...(n.style ?? {}), opacity: visible ? 1 : 0.15 } };
    });
  }, [nodes, search, layerFilter, statusFilter]);

  const selectedEntity = useMemo(
    () => {
      const matchedEntity = normalizedEntities.find((e) => lineageEntityKey(e) === selectedNodeId);
      if (matchedEntity) return matchedEntity;

      const selectedNode = nodes.find((node) => node.id === selectedNodeId);
      if (!selectedNode) return null;

      const data = selectedNode.data as unknown as GraphNodeData;
      return {
        entity_fqn: data.fullFqn,
        layer: data.layer,
        latest_status: data.latest_status,
        end_to_end_status: data.end_to_end_status,
        latest_success_at: data.latest_success_at,
        upstream_entity_fqns: data.upstream_entity_fqns,
        downstream_entity_fqns: data.downstream_entity_fqns,
        lineage_group_id: data.lineage_group_id,
        last_completed_layer: null,
      } satisfies LineageEntity;
    },
    [nodes, normalizedEntities, selectedNodeId]
  );

  // Navigate-to: select the adjacent layer node for refs shown in the detail panel.
  const handleNavigateTo = useCallback((fqn: string, direction: "upstream" | "downstream") => {
    const entity = selectedEntity
      ? resolveRefForDirection(fqn, selectedEntity, normalizedEntities, direction)
      : resolveLineageRef(fqn, normalizedEntities);
    setSelectedNodeId(entity ? lineageEntityKey(entity) : null);
  }, [normalizedEntities, selectedEntity]);

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
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="partial">Partial</option>
              <option value="in_progress">In progress</option>
              <option value="failed">Failed</option>
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
          {normalizedEntities.length} entit{normalizedEntities.length === 1 ? "y" : "ies"}
          {refreshedAt && (
            <span> · updated {(() => { try { return new Date(refreshedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); } catch { return refreshedAt; } })()}</span>
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
          onInit={setFlow}
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
              const status = d?.latest_status?.toUpperCase() ?? "UNKNOWN";
              if (status === "SUCCESS") return "#10B981";
              if (status === "WARNING" || status === "PARTIAL") return "#F59E0B";
              if (status === "IN_PROGRESS") return "#3B82F6";
              if (status === "FAILED") return "#EF4444";
              return "var(--color-border)";
            }}
            style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
          />
          {normalizedEntities.length === 0 && (
            <Panel position="top-center">
              <div
                className="rounded-lg px-4 py-3 text-sm text-center"
                style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
              >
                No lineage entities found. Check the connection or refresh the cache.
              </div>
            </Panel>
          )}
        </ReactFlow>

        {/* Detail panel */}
        {selectedEntity && (
          <EntityDetailPanel
            entity={selectedEntity}
            attributes={attributes}
            onClose={() => setSelectedNodeId(null)}
            onNavigateTo={handleNavigateTo}
            onOpenColumns={onOpenColumns}
          />
        )}
      </div>
    </div>
  );
}
