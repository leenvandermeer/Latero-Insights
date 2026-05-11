"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type ReactFlowInstance,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Columns3,
  Download,
  GitBranch,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
} from "lucide-react";
import type { LineageAttribute, LineageEntity } from "@/lib/adapters/types";
import { EntityNode } from "./entity-node";
import { AdjustableTraceEdge } from "./adjustable-trace-edge";
import { EntityDetailPanel } from "./entity-detail-panel";
import { LINEAGE_LAYER_ORDER, lineageLayerIndex, lineageNodeKey, lineageNodeLabel } from "./lineage-utils";

type TraceDirection = "upstream" | "downstream" | "both";
type TraceDisplayMode = "graph" | "list";

interface TraceRequest {
  anchorKey?: string | null;
  direction?: TraceDirection;
  depth?: number;
}

interface TraceViewProps {
  entities: LineageEntity[];
  attributes: LineageAttribute[];
  initialFocus?: string;
  request?: TraceRequest | null;
  onOpenColumns?: (query?: string) => void;
}

type HealthStatus = "healthy" | "warning" | "error" | "unknown";

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
  nodeKind?: "dataset" | "entity";
  sourceDatasetsCount?: number;
  traceRole?: "anchor" | "upstream" | "downstream" | "both" | "neutral";
  hopDistance?: number;
}

const BASE_X_SPACING = 560;
const MAX_X_SPACING = 1200;
const Y_SPACING = 148;
const DEFAULT_DEPTH = 2;
const TRACE_NODE_ESTIMATED_WIDTH = 300;
const TRACE_CANVAS_GUTTER = 16;
const LAYER_ACCENT: Record<string, string> = {
  landing: "#4E7496",
  raw: "#2F5D50",
  bronze: "#B45309",
  silver: "#B8C0CC",
  gold: "#D97706",
};
const STATUS_EDGE_COLOR: Record<string, string> = {
  SUCCESS: "#10B981",
  IN_PROGRESS: "#3B82F6",
  WARNING: "#F59E0B",
  PARTIAL: "#F59E0B",
  FAILED: "#EF4444",
  UNKNOWN: "var(--color-border)",
};

const nodeTypes = {
  entity: EntityNode,
};

const edgeTypes = {
  adjustableTrace: AdjustableTraceEdge,
};

type TraceFlowInstance = ReactFlowInstance<Node, Edge<Record<string, unknown>>>;

function statusToHealth(status: string): HealthStatus {
  switch (status.toUpperCase()) {
    case "SUCCESS": return "healthy";
    case "IN_PROGRESS":
    case "WARNING":
    case "PARTIAL": return "warning";
    case "FAILED": return "error";
    default: return "unknown";
  }
}

function pickPreferredStatus(...statuses: Array<string | null | undefined>) {
  const rank: Record<string, number> = { FAILED: 4, WARNING: 3, PARTIAL: 2, IN_PROGRESS: 2, SUCCESS: 1, UNKNOWN: 0 };
  return statuses
    .filter((status): status is string => Boolean(status))
    .sort((a, b) => (rank[b.toUpperCase()] ?? -1) - (rank[a.toUpperCase()] ?? -1))[0] ?? "UNKNOWN";
}

function mergeUnique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

function normalizeLineageEntities(entities: LineageEntity[]) {
  const merged = new Map<string, LineageEntity>();

  for (const entity of entities) {
    const key = lineageNodeKey(entity);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...entity,
        upstream_keys: mergeUnique(entity.upstream_keys),
        downstream_keys: mergeUnique(entity.downstream_keys),
      });
      continue;
    }

    merged.set(key, {
      ...existing,
      dataset_id: existing.dataset_id ?? entity.dataset_id,
      latest_status: pickPreferredStatus(existing.latest_status, entity.latest_status),
      end_to_end_status: pickPreferredStatus(existing.end_to_end_status, entity.end_to_end_status),
      latest_success_at: [existing.latest_success_at, entity.latest_success_at]
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => b.localeCompare(a))[0] ?? null,
      upstream_keys: mergeUnique([...existing.upstream_keys, ...entity.upstream_keys]),
      downstream_keys: mergeUnique([...existing.downstream_keys, ...entity.downstream_keys]),
      source_datasets: mergeUnique([...(existing.source_datasets ?? []), ...(entity.source_datasets ?? [])]),
    });
  }

  return [...merged.values()];
}

function resolveInitialAnchor(initialFocus: string | undefined, entities: LineageEntity[]) {
  if (!initialFocus) return null;
  const lower = initialFocus.toLowerCase();
  const byKey = entities.find((entity) => lineageNodeKey(entity).toLowerCase() === lower);
  if (byKey) return lineageNodeKey(byKey);
  const byName = entities.find((entity) => entity.name.toLowerCase().includes(lower));
  return byName ? lineageNodeKey(byName) : null;
}

function buildTraceScope(
  entities: LineageEntity[],
  anchorKey: string | null,
  direction: TraceDirection,
  depth: number,
  includedLayers: Set<string>,
) {
  const entityIndex = new Map(entities.map((entity) => [lineageNodeKey(entity), entity]));
  const anchor = anchorKey ? entityIndex.get(anchorKey) : null;

  if (!anchor) {
    return {
      anchor: null,
      nodes: [] as LineageEntity[],
      edges: [] as Array<{ source: string; target: string }>,
      distances: new Map<string, number>(),
      directions: new Map<string, -1 | 0 | 1>(),
    };
  }

  const visited = new Set<string>([anchorKey!]);
  const distances = new Map<string, number>([[anchorKey!, 0]]);
  const directions = new Map<string, -1 | 0 | 1>([[anchorKey!, 0]]);
  const queue: Array<{ key: string; distance: number; dir: -1 | 0 | 1 }> = [{ key: anchorKey!, distance: 0, dir: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const entity = entityIndex.get(current.key);
    if (!entity) continue;
    if (current.distance >= depth) continue;

    const expansions: Array<{ next: string; dir: -1 | 0 | 1 }> = [];
    if (direction === "upstream" || direction === "both") {
      for (const up of entity.upstream_keys) expansions.push({ next: up, dir: -1 });
    }
    if (direction === "downstream" || direction === "both") {
      for (const down of entity.downstream_keys) expansions.push({ next: down, dir: 1 });
    }

    for (const expansion of expansions) {
      if (!entityIndex.has(expansion.next) || visited.has(expansion.next)) continue;
      visited.add(expansion.next);
      distances.set(expansion.next, current.distance + 1);
      directions.set(expansion.next, expansion.dir);
      queue.push({ key: expansion.next, distance: current.distance + 1, dir: expansion.dir });
    }
  }

  const scoped = [...visited]
    .map((key) => entityIndex.get(key)!)
    .filter((entity) => includedLayers.has(entity.layer.toLowerCase()));
  const scopedKeys = new Set(scoped.map((entity) => lineageNodeKey(entity)));

  const edges: Array<{ source: string; target: string }> = [];
  const edgeSet = new Set<string>();
  for (const entity of scoped) {
    const sourceKey = lineageNodeKey(entity);
    for (const downstream of entity.downstream_keys) {
      if (!scopedKeys.has(downstream)) continue;
      const id = `${sourceKey}->${downstream}`;
      if (edgeSet.has(id)) continue;
      edgeSet.add(id);
      edges.push({ source: sourceKey, target: downstream });
    }
  }

  return { anchor, nodes: scoped, edges, distances, directions };
}

function buildTraceGraph(
  entities: LineageEntity[],
  scopedEdges: Array<{ source: string; target: string }>,
  distances: Map<string, number>,
  directions: Map<string, -1 | 0 | 1>,
  anchorKey: string | null,
  viewportWidth: number,
) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const entityByKey = new Map(entities.map((entity) => [lineageNodeKey(entity), entity]));
  const columnByKey = new Map<string, number>();
  const columns = new Map<number, string[]>();

  for (const entity of entities) {
    const key = lineageNodeKey(entity);
    const distance = distances.get(key) ?? 0;
    const direction = directions.get(key) ?? 0;
    const col = direction === 0 ? 0 : direction === -1 ? -distance : distance;
    columnByKey.set(key, col);
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col)!.push(key);
  }

  const sortedColumns = [...columns.keys()].sort((a, b) => a - b);
  const columnCount = Math.max(1, sortedColumns.length);
  const usableWidth = Math.max(viewportWidth - TRACE_CANVAS_GUTTER * 2 - TRACE_NODE_ESTIMATED_WIDTH, BASE_X_SPACING);
  const dynamicXSpacing = Math.min(
    MAX_X_SPACING,
    Math.max(BASE_X_SPACING, columnCount > 1 ? usableWidth / (columnCount - 1) : 0),
  );
  const columnPositions = new Map<number, number>(
    sortedColumns.map((col, index) => [
      col,
      (index - (columnCount - 1) / 2) * dynamicXSpacing,
    ]),
  );

  for (const col of sortedColumns) {
    const keys = columns.get(col)!;
    keys.sort((a, b) => {
      const entityA = entityByKey.get(a)!;
      const entityB = entityByKey.get(b)!;
      return (
        lineageLayerIndex(entityA) - lineageLayerIndex(entityB) ||
        lineageNodeLabel(entityA).localeCompare(lineageNodeLabel(entityB))
      );
    });
  }

  const edgesByNode = new Map<string, string[]>();
  for (const { source, target } of scopedEdges) {
    if (!edgesByNode.has(source)) edgesByNode.set(source, []);
    if (!edgesByNode.has(target)) edgesByNode.set(target, []);
    edgesByNode.get(source)!.push(target);
    edgesByNode.get(target)!.push(source);
  }

  const getNeighborTowardAnchor = (col: number) => {
    if (col < 0) return col + 1;
    if (col > 0) return col - 1;
    return 0;
  };

  const orderMapForColumn = (keys: string[]) =>
    new Map(keys.map((key, index) => [key, index]));

  for (const col of sortedColumns) {
    if (col === 0) continue;
    const keys = columns.get(col)!;
    const neighborCol = getNeighborTowardAnchor(col);
    const neighborKeys = columns.get(neighborCol) ?? [];
    const neighborOrder = orderMapForColumn(neighborKeys);

    keys.sort((a, b) => {
      const scoreFor = (key: string) => {
        const neighbors = (edgesByNode.get(key) ?? []).filter(
          (neighbor) => columnByKey.get(neighbor) === neighborCol,
        );
        if (neighbors.length === 0) {
          const entity = entityByKey.get(key)!;
          return lineageLayerIndex(entity) * 1000;
        }
        const total = neighbors.reduce(
          (sum, neighbor) => sum + (neighborOrder.get(neighbor) ?? 0),
          0,
        );
        return total / neighbors.length;
      };

      const scoreA = scoreFor(a);
      const scoreB = scoreFor(b);
      if (scoreA !== scoreB) return scoreA - scoreB;
      const entityA = entityByKey.get(a)!;
      const entityB = entityByKey.get(b)!;
      return (
        lineageLayerIndex(entityA) - lineageLayerIndex(entityB) ||
        lineageNodeLabel(entityA).localeCompare(lineageNodeLabel(entityB))
      );
    });
  }

  for (const col of sortedColumns) {
    const keys = columns.get(col)!;
    const count = keys.length;
    for (let index = 0; index < count; index += 1) {
      const key = keys[index]!;
      const entity = entityByKey.get(key)!;
      const distance = distances.get(key) ?? 0;
      const direction = directions.get(key) ?? 0;
      const x = columnPositions.get(col) ?? 0;
      const y = (index - (count - 1) / 2) * Y_SPACING;

      const data: GraphNodeData = {
        label: lineageNodeLabel(entity),
        nodeId: key,
        fullFqn: entity.name,
        type: "table",
        ref: entity.name,
        attributes: [],
        hopCount: entity.upstream_keys.length + entity.downstream_keys.length,
        health: statusToHealth(entity.latest_status),
        layer: entity.layer,
        latest_status: entity.latest_status,
        end_to_end_status: entity.end_to_end_status,
        latest_success_at: entity.latest_success_at,
        upstream_entity_fqns: entity.upstream_keys,
        downstream_entity_fqns: entity.downstream_keys,
        lineage_group_id: entity.lineage_group_id,
        nodeKind: entity.node_kind ?? (["silver", "gold"].includes(entity.layer.toLowerCase()) ? "entity" : "dataset"),
        sourceDatasetsCount: entity.source_datasets?.length ?? 0,
        traceRole:
          key === anchorKey ? "anchor"
          : direction === -1 ? "upstream"
          : direction === 1 ? "downstream"
          : "neutral",
        hopDistance: distance,
      };

      nodes.push({
        id: key,
        type: "entity",
        position: { x, y },
        draggable: true,
        data: data as unknown as Record<string, unknown>,
      });
    }
  }

  for (const edge of scopedEdges) {
    const sourceEntity = entities.find((entity) => lineageNodeKey(entity) === edge.source);
    const color = STATUS_EDGE_COLOR[sourceEntity?.latest_status ?? "UNKNOWN"] ?? STATUS_EDGE_COLOR.UNKNOWN;
    edges.push({
      id: `${edge.source}->${edge.target}`,
      source: edge.source,
      target: edge.target,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, color },
      style: { stroke: color, strokeWidth: 2 },
      animated: sourceEntity?.latest_status === "SUCCESS",
    });
  }

  return { nodes, edges };
}

function formatDirection(direction: TraceDirection) {
  if (direction === "both") return "both directions";
  return direction;
}

function formatDepthLabel(depth: number) {
  if (!Number.isFinite(depth)) return "all depths";
  return `${depth} hop${depth === 1 ? "" : "s"}`;
}

function formatDirectionLabel(direction: -1 | 0 | 1) {
  if (direction === -1) return "Upstream";
  if (direction === 1) return "Downstream";
  return "Starting point";
}

function statusBadgeTone(status: string) {
  switch (status.toUpperCase()) {
    case "SUCCESS": return { color: "#10B981", bg: "rgba(16,185,129,0.12)" };
    case "WARNING":
    case "PARTIAL": return { color: "#F59E0B", bg: "rgba(245,158,11,0.12)" };
    case "IN_PROGRESS": return { color: "#3B82F6", bg: "rgba(59,130,246,0.12)" };
    case "FAILED": return { color: "#EF4444", bg: "rgba(239,68,68,0.12)" };
    default: return { color: "var(--color-text-muted)", bg: "rgba(128,128,128,0.1)" };
  }
}

export function TraceView({ entities, attributes, initialFocus, request, onOpenColumns }: TraceViewProps) {
  const normalizedEntities = useMemo(() => normalizeLineageEntities(entities), [entities]);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const flowInstanceRef = useRef<TraceFlowInstance | null>(null);
  const fitFrameRef = useRef<number | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(1280);
  const entityOptions = useMemo(
    () => normalizedEntities
      .map((entity) => ({ key: lineageNodeKey(entity), label: lineageNodeLabel(entity), layer: entity.layer.toLowerCase() }))
      .sort((a, b) => lineageLayerIndex(a.layer) - lineageLayerIndex(b.layer) || a.label.localeCompare(b.label)),
    [normalizedEntities]
  );

  const [anchorKey, setAnchorKey] = useState<string | null>(null);
  const [direction, setDirection] = useState<TraceDirection>("both");
  const [depth, setDepth] = useState<number>(DEFAULT_DEPTH);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<TraceDisplayMode>("graph");
  const [includedLayers, setIncludedLayers] = useState<string[]>([...LINEAGE_LAYER_ORDER]);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [edgeOffsets, setEdgeOffsets] = useState<Record<string, number>>({});

  useEffect(() => {
    const stored = window.localStorage.getItem("lineage-trace-controls-collapsed");
    if (stored === "true") {
      setControlsCollapsed(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "lineage-trace-controls-collapsed",
      String(controlsCollapsed),
    );
  }, [controlsCollapsed]);

  useEffect(() => {
    if (anchorKey) return;
    const resolved = resolveInitialAnchor(initialFocus, normalizedEntities) ?? entityOptions[0]?.key ?? null;
    setAnchorKey(resolved);
  }, [anchorKey, entityOptions, initialFocus, normalizedEntities]);

  useEffect(() => {
    if (!request) return;
    if (request.anchorKey) {
      setAnchorKey(request.anchorKey);
      setSelectedNodeId(null);
    }
    if (request.direction) setDirection(request.direction);
    if (request.depth) setDepth(request.depth);
  }, [request]);

  const includedLayerSet = useMemo(() => new Set(includedLayers), [includedLayers]);
  const trace = useMemo(
    () => buildTraceScope(normalizedEntities, anchorKey, direction, depth, includedLayerSet),
    [anchorKey, depth, direction, includedLayerSet, normalizedEntities]
  );

  const graph = useMemo(
    () => buildTraceGraph(trace.nodes, trace.edges, trace.distances, trace.directions, anchorKey, canvasWidth),
    [anchorKey, canvasWidth, trace]
  );
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(graph.nodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(graph.edges);

  useEffect(() => {
    setFlowNodes(graph.nodes);
  }, [graph.nodes, setFlowNodes]);

  useEffect(() => {
    setFlowEdges(graph.edges);
  }, [graph.edges, setFlowEdges]);

  useEffect(() => {
    setEdgeOffsets((current) => {
      const activeIds = new Set(graph.edges.map((edge) => edge.id));
      const next = Object.fromEntries(
        Object.entries(current).filter(([edgeId]) => activeIds.has(edgeId)),
      );
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [graph.edges]);

  const scheduleFitView = useCallback((duration = 220) => {
    if (displayMode !== "graph" || trace.nodes.length === 0) return;
    if (fitFrameRef.current != null) {
      cancelAnimationFrame(fitFrameRef.current);
    }
    fitFrameRef.current = requestAnimationFrame(() => {
      flowInstanceRef.current?.fitView({
        padding: 0.02,
        duration,
        maxZoom: 3,
      });
    });
  }, [displayMode, trace.nodes.length]);

  useEffect(() => {
    scheduleFitView(0);
  }, [scheduleFitView, graph.nodes, graph.edges]);

  useEffect(() => {
    if (displayMode !== "graph" || trace.nodes.length === 0) return;
    const timeout = window.setTimeout(() => {
      scheduleFitView(260);
    }, 240);
    return () => window.clearTimeout(timeout);
  }, [controlsCollapsed, displayMode, scheduleFitView, trace.nodes.length]);

  useEffect(() => {
    const node = canvasRef.current;
    if (!node || displayMode !== "graph") return;

    setCanvasWidth(node.clientWidth || 1280);

    const observer = new ResizeObserver(() => {
      const nextWidth = node.clientWidth || 1280;
      setCanvasWidth((current) => (Math.abs(current - nextWidth) > 2 ? nextWidth : current));
      scheduleFitView();
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [displayMode, scheduleFitView]);

  useEffect(() => {
    return () => {
      if (fitFrameRef.current != null) {
        cancelAnimationFrame(fitFrameRef.current);
      }
    };
  }, []);

  const selectedEntity = useMemo(
    () => trace.nodes.find((entity) => lineageNodeKey(entity) === selectedNodeId) ?? null,
    [selectedNodeId, trace.nodes]
  );

  const searchedList = useMemo(() => {
    return trace.nodes
      .map((entity) => ({
        entity,
        key: lineageNodeKey(entity),
        distance: trace.distances.get(lineageNodeKey(entity)) ?? 0,
        dir: trace.directions.get(lineageNodeKey(entity)) ?? 0,
      }))
      .sort((a, b) => a.distance - b.distance || lineageLayerIndex(a.entity) - lineageLayerIndex(b.entity) || a.entity.name.localeCompare(b.entity.name));
  }, [trace]);

  const anchorEntity = useMemo(
    () => trace.anchor ?? null,
    [trace.anchor]
  );

  const traceStats = useMemo(() => {
    let failed = 0;
    let warning = 0;
    for (const entity of trace.nodes) {
      const status = entity.latest_status.toUpperCase();
      if (status === "FAILED") failed += 1;
      if (status === "WARNING" || status === "PARTIAL" || status === "IN_PROGRESS") warning += 1;
    }
    return { failed, warning };
  }, [trace.nodes]);

  const handleEdgeOffsetChange = useCallback((edgeId: string, offsetY: number) => {
    setFlowEdges((current) =>
      current.map((edge) =>
        edge.id === edgeId
          ? {
              ...edge,
              selected: true,
              data: {
                ...(edge.data ?? {}),
                offsetY,
              },
            }
          : edge
      )
    );
    setEdgeOffsets((current) => {
      if (offsetY === 0) {
        const { [edgeId]: _removed, ...rest } = current;
        return rest;
      }
      return {
        ...current,
        [edgeId]: offsetY,
      };
    });
  }, [setFlowEdges]);

  const displayEdges = useMemo(() => {
    return flowEdges.map((edge) => {
      const isConnected = edge.source === selectedNodeId || edge.target === selectedNodeId;
      const hasNodeSelection = Boolean(selectedNodeId);
      return {
        ...edge,
        type: "adjustableTrace",
        data: {
          ...(edge.data ?? {}),
          offsetY: edgeOffsets[edge.id] ?? 0,
          onOffsetChange: handleEdgeOffsetChange,
        },
        style: {
          ...edge.style,
          opacity: hasNodeSelection ? (isConnected ? 1 : 0.18) : 1,
          strokeWidth: hasNodeSelection && isConnected ? 3 : (edge.style?.strokeWidth ?? 2),
        },
      };
    });
  }, [edgeOffsets, flowEdges, handleEdgeOffsetChange, selectedNodeId]);

  const handleExportImage = useCallback(async () => {
    if (!canvasRef.current || displayMode !== "graph") return;
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(canvasRef.current, {
      cacheBust: true,
      backgroundColor: "#f8f3ea",
      pixelRatio: 2,
      filter: (node) => {
        if (!(node instanceof HTMLElement)) return true;
        return !node.classList.contains("react-flow__controls") && !node.classList.contains("trace-edge-handle");
      },
    });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `lineage-trace-${anchorKey ?? "export"}.png`;
    link.click();
  }, [anchorKey, displayMode]);

  const scopeSummary = anchorKey
    ? `Tracing ${formatDirection(direction)} from ${anchorKey}, ${formatDepthLabel(depth)}, ${includedLayers.length} layer${includedLayers.length === 1 ? "" : "s"}`
    : "Choose a starting entity to begin tracing.";

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden">
      <aside
        className={`shrink-0 overflow-auto border-r transition-[width] duration-200 ${
          controlsCollapsed ? "w-[64px]" : "w-[280px]"
        }`}
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        {controlsCollapsed ? (
          <div className="flex h-full flex-col items-center gap-3 px-2 py-3">
            <button
              type="button"
              onClick={() => setControlsCollapsed(false)}
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              title="Expand trace controls"
              aria-label="Expand trace controls"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
            <div
              className="w-full rounded-2xl px-2 py-3 text-center"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <p className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>{trace.nodes.length}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Nodes</p>
            </div>
            <div
              className="w-full rounded-2xl px-2 py-3 text-center"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <p className="text-[11px] font-semibold uppercase" style={{ color: "var(--color-text)" }}>{direction}</p>
              <p className="mt-1 text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                {Number.isFinite(depth) ? `${depth} hop${depth === 1 ? "" : "s"}` : "All"}
              </p>
            </div>
            <div
              className="w-full rounded-2xl px-2 py-3 text-center"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              title={anchorEntity ? lineageNodeLabel(anchorEntity) : "No starting point selected"}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Starting point</p>
              <p className="mt-1 line-clamp-3 text-[11px] font-semibold" style={{ color: "var(--color-text)" }}>
                {anchorEntity ? lineageNodeLabel(anchorEntity) : "None"}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-4 py-4">
            {anchorEntity && (
              <div
                className="rounded-xl px-4 py-3"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Current focus</p>
                  <button
                    type="button"
                    onClick={() => setControlsCollapsed(true)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
                    title="Collapse trace controls"
                    aria-label="Collapse trace controls"
                  >
                    <PanelLeftClose className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>{lineageNodeLabel(anchorEntity)}</p>
                <p className="mt-1 truncate text-[11px]" style={{ color: "var(--color-text-muted)" }}>{anchorKey}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>{trace.nodes.length}</p>
                    <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>entities</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>{anchorEntity.upstream_keys.length}</p>
                    <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>upstream</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>{anchorEntity.downstream_keys.length}</p>
                    <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>downstream</p>
                  </div>
                </div>
              </div>
            )}

            {!anchorEntity && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setControlsCollapsed(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
                  title="Collapse trace controls"
                  aria-label="Collapse trace controls"
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Start from</p>
              <select
                value={anchorKey ?? ""}
                onChange={(event) => {
                  const next = event.target.value || null;
                  setAnchorKey(next);
                  setSelectedNodeId(null);
                }}
                className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                {entityOptions.map((option) => (
                  <option key={option.key} value={option.key}>{option.label} ({option.layer})</option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Direction</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {([
                  { id: "upstream", label: "Upstream", Icon: ArrowUpFromLine },
                  { id: "downstream", label: "Downstream", Icon: ArrowDownToLine },
                  { id: "both", label: "Both", Icon: GitBranch },
                ] as const).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDirection(id)}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                    style={{
                      background: direction === id ? "var(--color-accent)" : "var(--color-surface)",
                      color: direction === id ? "#fff" : "var(--color-text-muted)",
                      border: `1px solid ${direction === id ? "var(--color-accent)" : "var(--color-border)"}`,
                    }}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Depth</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {[1, 2, 3, Number.POSITIVE_INFINITY].map((value) => (
                  <button
                    key={Number.isFinite(value) ? value : "all"}
                    type="button"
                    onClick={() => setDepth(value)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                    style={{
                      background: depth === value ? "var(--color-brand)" : "var(--color-surface)",
                      color: depth === value ? "#fff" : "var(--color-text-muted)",
                      border: `1px solid ${depth === value ? "var(--color-brand)" : "var(--color-border)"}`,
                    }}
                  >
                    {Number.isFinite(value) ? `${value} hop${value === 1 ? "" : "s"}` : "All"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Layers</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {LINEAGE_LAYER_ORDER.map((layer) => {
                  const active = includedLayerSet.has(layer);
                  return (
                    <button
                      key={layer}
                      type="button"
                      onClick={() => setIncludedLayers((current) =>
                        current.includes(layer)
                          ? current.filter((item) => item !== layer)
                          : [...current, layer]
                      )}
                      className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase"
                      style={{
                        background: active ? (LAYER_ACCENT[layer] ?? "var(--color-brand)") : "var(--color-surface)",
                        color: active ? "#fff" : "var(--color-text-muted)",
                        border: `1px solid ${active ? (LAYER_ACCENT[layer] ?? "var(--color-brand)") : "var(--color-border)"}`,
                      }}
                    >
                      {layer}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-1">
                <button
                  type="button"
                  onClick={() => setIncludedLayers([...LINEAGE_LAYER_ORDER])}
                  className="rounded-lg px-2 py-1 text-[10px] font-semibold uppercase"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
                >
                  All layers
                </button>
                <button
                  type="button"
                  onClick={() => setIncludedLayers(["bronze", "silver", "gold"])}
                  className="rounded-lg px-2 py-1 text-[10px] font-semibold uppercase"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
                >
                  Core flow
                </button>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>View</p>
              <div className="mt-1 flex gap-1">
                {([
                  { id: "graph", label: "Graph", Icon: Network },
                  { id: "list", label: "List", Icon: Columns3 },
                ] as const).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDisplayMode(id)}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                    style={{
                      background: displayMode === id ? "var(--color-accent)" : "var(--color-surface)",
                      color: displayMode === id ? "#fff" : "var(--color-text-muted)",
                      border: `1px solid ${displayMode === id ? "var(--color-accent)" : "var(--color-border)"}`,
                    }}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setDirection("both");
                setDepth(DEFAULT_DEPTH);
                setIncludedLayers([...LINEAGE_LAYER_ORDER]);
                setDisplayMode("graph");
                setSelectedNodeId(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset trace
            </button>
          </div>
        )}
      </aside>

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className="flex flex-wrap items-center gap-3 border-b px-4 py-2"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
        >
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{scopeSummary}</span>
          {displayMode === "graph" && trace.nodes.length > 0 && (
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Drag nodes to arrange the view before export.
            </span>
          )}
          <span className="ml-auto text-xs" style={{ color: "var(--color-text-muted)" }}>{trace.nodes.length} entities</span>
          {(traceStats.failed + traceStats.warning) > 0 && (
            <span className="text-xs" style={{ color: traceStats.failed > 0 ? "#EF4444" : "#F59E0B" }}>
              {traceStats.failed + traceStats.warning} open risk
            </span>
          )}
          <button
            type="button"
            onClick={handleExportImage}
            disabled={displayMode !== "graph" || trace.nodes.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
            style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
          >
            <Download className="h-3.5 w-3.5" />
            Export image
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div ref={canvasRef} className="relative min-h-0 flex-1">
            {trace.nodes.length === 0 ? (
              <div className="flex h-full items-center justify-center bg-[var(--color-bg)] p-6">
                <div
                  className="max-w-md rounded-2xl px-6 py-5 text-center"
                  style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
                >
                  <p className="text-base font-semibold" style={{ color: "var(--color-text)" }}>No entities match this trace scope</p>
                  <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Try restoring more layers or changing direction and depth. The starting entity may fall outside the currently visible layer set.
                  </p>
                </div>
              </div>
            ) : displayMode === "graph" ? (
              <ReactFlow
                nodes={flowNodes}
                edges={displayEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitViewOptions={{ padding: 0.02, maxZoom: 3 }}
                onInit={(instance) => {
                  flowInstanceRef.current = instance as unknown as TraceFlowInstance;
                  scheduleFitView(0);
                  window.setTimeout(() => {
                    scheduleFitView(0);
                  }, 80);
                }}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_, node) => setSelectedNodeId((current) => current === node.id ? null : node.id)}
                onPaneClick={() => setSelectedNodeId(null)}
                nodesDraggable
                fitView
                minZoom={0.45}
                maxZoom={3}
                className="bg-[var(--color-bg)]"
              >
                <Background color="var(--color-border)" gap={24} size={1} />
                <Controls />
              </ReactFlow>
            ) : (
              <div className="h-full overflow-auto bg-[var(--color-bg)] p-4">
                <div className="space-y-2">
                  {searchedList.map(({ entity, key, distance, dir }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedNodeId((current) => current === key ? null : key)}
                      className="grid w-full gap-3 rounded-lg px-4 py-3 text-left md:grid-cols-[minmax(0,1fr)_120px_100px]"
                      style={{
                        background: selectedNodeId === key ? "var(--color-card)" : "var(--color-surface)",
                        border: `1px solid ${selectedNodeId === key ? "var(--color-brand)" : "var(--color-border)"}`,
                      }}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold" style={{ color: "var(--color-text)" }}>{lineageNodeLabel(entity)}</p>
                        <p className="truncate text-xs" style={{ color: "var(--color-text-muted)" }}>{entity.name}</p>
                      </div>
                      <div className="space-y-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                        <p>{formatDirectionLabel(dir)} · {distance} hop{distance === 1 ? "" : "s"}</p>
                        <span
                          className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: statusBadgeTone(entity.latest_status).bg, color: statusBadgeTone(entity.latest_status).color }}
                        >
                          {entity.latest_status}
                        </span>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-muted)" }}>{entity.layer}</p>
                        <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                          {entity.upstream_keys.length} up · {entity.downstream_keys.length} down
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {selectedEntity && (
            <EntityDetailPanel
              entity={selectedEntity}
              attributes={attributes}
              onClose={() => setSelectedNodeId(null)}
              onNavigateTo={(entityFqn) => {
                const matched = normalizedEntities.find((entity) => lineageNodeKey(entity) === entityFqn || entity.name === entityFqn);
                if (!matched) return;
                const nextKey = lineageNodeKey(matched);
                setAnchorKey(nextKey);
                setSelectedNodeId(nextKey);
              }}
              onSetAnchor={(nextKey) => {
                setAnchorKey(nextKey);
                setSelectedNodeId(nextKey);
              }}
              onTraceFromEntity={(nextKey, nextDirection) => {
                setAnchorKey(nextKey);
                setSelectedNodeId(nextKey);
                setDirection(nextDirection);
              }}
              onOpenColumns={(query) => onOpenColumns?.(query)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
