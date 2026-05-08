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
import { RotateCcw, Search, GitBranch, ArrowUpFromLine, ArrowDownToLine } from "lucide-react";
import type { LineageEntity, LineageAttribute } from "@/lib/adapters/types";
import { EntityNode } from "./entity-node";
import { EntityDetailPanel } from "./entity-detail-panel";
import {
  LINEAGE_LAYER_ORDER,
  areAdjacentLineageLayers,
  lineageNodeLabel,
  lineageNodeKey,
  lineageLayerIndex,
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
  // LADR-064
  nodeKind?: "dataset" | "entity";
  sourceDatasetsCount?: number;
}

type VirtualFileRef = {
  ref: string;
  refs: string[];
  targetKey: string;
  targetEntity: LineageEntity;
  targetIndex: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const POSITIONS_KEY = "insights:lineage:entity-positions-v5";
const X_SPACING = 400;
const Y_SPACING = 118;
const FILE_LANE_OFFSET = 190;
const FILE_STACK_SPACING = 68;
const DEFAULT_FIT_VIEW_OPTIONS = { padding: 0.08, minZoom: 0.58, maxZoom: 1.05 };

const LAYER_ORDER: string[] = [...LINEAGE_LAYER_ORDER];

const STATUS_EDGE_COLOR: Record<string, string> = {
  SUCCESS: "#10B981",
  IN_PROGRESS: "#3B82F6",
  WARNING: "#F59E0B",
  PARTIAL: "#F59E0B",
  FAILED:  "#EF4444",
  UNKNOWN: "var(--color-border)",
};

const LAYER_ACCENT: Record<string, string> = {
  landing: "#6B7280",
  raw:     "#6B7280",
  bronze:  "#B45309",
  silver:  "#0891B2",
  gold:    "#D97706",
  file:    "#6B7280",
};

const FILE_REF_PATTERN = /\.(csv|json|jsonl|parquet|avro|xlsx?)($|[?#])/i;

function LayerHeaderNode({ data }: { data: { label: string; accent: string } }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-widest pointer-events-none select-none"
      style={{
        borderLeft: `3px solid ${data.accent}`,
        color: data.accent,
        background: "var(--color-surface)",
        border: `1px solid var(--color-border)`,
        borderLeftColor: data.accent,
        minWidth: 120,
        opacity: 0.85,
      }}
    >
      {data.label}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  entity: EntityNode,
  layerHeader: LayerHeaderNode as unknown as NodeTypes["layerHeader"],
};

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
      layer: existing.layer || entity.layer,
      latest_status: pickPreferredStatus(existing.latest_status, entity.latest_status),
      end_to_end_status: pickPreferredStatus(existing.end_to_end_status, entity.end_to_end_status),
      latest_success_at: [existing.latest_success_at, entity.latest_success_at]
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => b.localeCompare(a))[0] ?? null,
      upstream_keys: mergeUnique([...existing.upstream_keys, ...entity.upstream_keys]),
      downstream_keys: mergeUnique([...existing.downstream_keys, ...entity.downstream_keys]),
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
    .filter((candidate) => candidate.name === entity.name && candidate.layer.toLowerCase() !== entity.layer.toLowerCase())
    .sort((a, b) => layerIndex(a) - layerIndex(b));

  if (direction === "downstream") {
    return candidates.find((candidate) => layerIndex(candidate) === currentIdx + 1) ?? null;
  }

  return candidates.reverse().find((candidate) => layerIndex(candidate) === currentIdx - 1) ?? null;
}

const LAYER_NAME_SET = new Set(LAYER_ORDER);

function datasetKey(entity: LineageEntity): string {
  if (entity.dataset_id && entity.dataset_id.trim()) return entity.dataset_id.trim();
  const parts = entity.name.split(".").filter(Boolean);
  // Live FQN format: "catalog.schema.table" — schema is the stable group key (e.g. "cbs_arbeid")
  const second = parts.at(-2);
  if (second && !LAYER_NAME_SET.has(second.toLowerCase())) return second;
  // Demo FQN format: "catalog.layer.table" — at(-2) IS a layer name; strip layer suffix from table name
  const last = parts.at(-1) ?? entity.name;
  return last
    .replace(/^(raw|bronze|silver|gold)_/i, "")
    .replace(/_(raw|bronze|silver|gold)$/i, "") || last;
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

function rowKey(entity: LineageEntity): string {
  const layer = entity.layer.toLowerCase();
  if (layer === "silver" || layer === "gold") return lineageNodeKey(entity);
  return datasetKey(entity);
}

function chainSortKey(entity: LineageEntity) {
  return `${datasetKey(entity)}::${layerIndex(entity)}::${entity.name}`;
}

function sameDataset(entity: LineageEntity, other: LineageEntity) {
  return datasetKey(entity) === datasetKey(other);
}

function resolveAttributeEntity(
  attribute: LineageAttribute,
  entityIndex: Map<string, LineageEntity>
): { source: LineageEntity | null; target: LineageEntity | null } {
  // LADR-058: gebruik de layer-scoped dataset_id als exacte graph node key.
  // Fuzzy FQN-resolving is verwijderd — als source_dataset_id ontbreekt (legacy/cache)
  // val terug op layer+fqn exact match.
  const src =
    (attribute.source_dataset_id ? entityIndex.get(attribute.source_dataset_id) : null) ??
    (attribute.source_layer
      ? entityIndex.get(`${attribute.source_layer.toLowerCase()}::${attribute.source_name}`)
      : null) ??
    null;
  const tgt =
    (attribute.target_dataset_id ? entityIndex.get(attribute.target_dataset_id) : null) ??
    (attribute.target_layer
      ? entityIndex.get(`${attribute.target_layer.toLowerCase()}::${attribute.target_name}`)
      : null) ??
    null;
  return { source: src, target: tgt };
}

function pushLayerEdge(edges: Edge[], edgeSet: Set<string>, sourceEntity: LineageEntity, targetEntity: LineageEntity) {
  if (!areAdjacentLineageLayers(sourceEntity, targetEntity)) return;

  const source = lineageNodeKey(sourceEntity);
  const target = lineageNodeKey(targetEntity);
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

function buildGraph(entities: LineageEntity[], attributes: LineageAttribute[] = []) {
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
  // Silver/gold sort key groups them near their dataset so they visually align with their bronze parent.
  const rowSortKey = (e: LineageEntity) => {
    const base = datasetKey(e);
    const layer = e.layer.toLowerCase();
    return (layer === "silver" || layer === "gold")
      ? `${base}::${String(layerIndex(e)).padStart(2, "0")}::${e.name}`
      : base;
  };
  const seenRowKeys = new Map<string, string>(); // rowKey → sortKey (first seen wins)
  for (const e of entities) {
    const rk = rowKey(e);
    if (!seenRowKeys.has(rk)) seenRowKeys.set(rk, rowSortKey(e));
  }
  [...seenRowKeys.entries()]
    .sort(([, a], [, b]) => a.localeCompare(b))
    .forEach(([rk], index) => rowByDataset.set(rk, index));
  const virtualFileCountByTarget = new Map<string, number>();

  // Build nodes
  const nodes: Node[] = [];
  const virtualFiles: VirtualFileRef[] = [];

  // Add layer header nodes (rendered above the graph, follow zoom/pan)
  for (const col of cols) {
    const x = cols.indexOf(col) * X_SPACING;
    const accent = LAYER_ACCENT[col] ?? "var(--color-border)";
    nodes.push({
      id: `__layer_header__${col}`,
      type: "layerHeader",
      position: { x: x - 16, y: -52 },
      data: { label: col.charAt(0).toUpperCase() + col.slice(1), accent },
      selectable: false,
      draggable: false,
      connectable: false,
    });
  }

  for (const col of cols) {
    const layerEntities = [...(byLayer.get(col) ?? [])].sort((a, b) => chainSortKey(a).localeCompare(chainSortKey(b)));
    const x = cols.indexOf(col) * X_SPACING;
    layerEntities.forEach((e, i) => {
      const nodeId = lineageNodeKey(e);
      const row = rowByDataset.get(rowKey(e)) ?? i;
      const data: GraphNodeData = {
        label: lineageNodeLabel(e),
        nodeId,
        fullFqn: e.name,
        type: "table",
        ref: e.name,
        attributes: [],
        hopCount: e.upstream_keys.length + e.downstream_keys.length,
        health: statusToHealth(e.latest_status),
        layer: e.layer,
        latest_status: e.latest_status,
        end_to_end_status: e.end_to_end_status,
        latest_success_at: e.latest_success_at,
        upstream_entity_fqns: e.upstream_keys,
        downstream_entity_fqns: e.downstream_keys,
        lineage_group_id: e.lineage_group_id,
        // LADR-064: dataset vs entity visueel onderscheid
        nodeKind: e.node_kind ?? (["silver", "gold"].includes(e.layer.toLowerCase()) ? "entity" : "dataset"),
        sourceDatasetsCount: e.source_datasets?.length ?? 0,
      };
      nodes.push({
        id: nodeId,
        type: "entity",
        position: { x, y: row * Y_SPACING },
        data: data as unknown as Record<string, unknown>,
      });

      if (e.layer.toLowerCase() === "bronze") {
        const hasRawEntity = entities.some(
          (candidate) => candidate.layer.toLowerCase() === "raw" && datasetKey(candidate) === datasetKey(e)
        );
        if (!hasRawEntity) {
          const groupedRefs = new Map<string, string[]>();
          e.upstream_keys.filter(isFileRef).forEach((ref) => {
            const key = sourceGroupKey(ref);
            groupedRefs.set(key, [...(groupedRefs.get(key) ?? []), ref]);
          });

          for (const [ref, refs] of groupedRefs.entries()) {
            const targetIndex = virtualFileCountByTarget.get(nodeId) ?? 0;
            virtualFileCountByTarget.set(nodeId, targetIndex + 1);
            virtualFiles.push({ ref, refs, targetKey: nodeId, targetEntity: e, targetIndex });
          }
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
      downstream_entity_fqns: [file.targetEntity.name],
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

  // Build edges — prefer current attribute lineage, fall back to entity refs.
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();
  const attributeEdgeEntityIds = new Set<string>();

  // LADR-058: bouw een key-index voor O(1) entity lookup.
  const entityIndex = new Map(entities.map((e) => [lineageNodeKey(e), e]));

  for (const attribute of attributes) {
    if (!attribute.is_current) continue;
    const { source: sourceEntity, target: targetEntity } = resolveAttributeEntity(attribute, entityIndex);
    if (!sourceEntity || !targetEntity) continue;
    if (!areAdjacentLineageLayers(sourceEntity, targetEntity)) continue;

    pushLayerEdge(edges, edgeSet, sourceEntity, targetEntity);
    attributeEdgeEntityIds.add(lineageNodeKey(sourceEntity));
    attributeEdgeEntityIds.add(lineageNodeKey(targetEntity));
  }

  for (const e of entities) {
    const sameFqnDownstream = neighborBySameFqn(e, entities.filter((candidate) => sameDataset(e, candidate)), "downstream");
    if (sameFqnDownstream) {
      const coveredByAttributes = attributeEdgeEntityIds.has(lineageNodeKey(e)) && attributeEdgeEntityIds.has(lineageNodeKey(sameFqnDownstream));
      if (!coveredByAttributes) {
        pushLayerEdge(edges, edgeSet, e, sameFqnDownstream);
      }
    }

    // LADR-058: downstream_entity_fqns zijn exacte layer::fqn keys — directe key lookup.
    for (const ds of e.downstream_keys) {
      const resolved = entityIndex.get(ds);
      if (!resolved) continue;
      if (attributeEdgeEntityIds.has(lineageNodeKey(e)) && attributeEdgeEntityIds.has(ds)) continue;
      pushLayerEdge(edges, edgeSet, e, resolved);
    }

    // LADR-058: upstream_entity_fqns zijn exacte layer::fqn keys — directe key lookup.
    for (const up of e.upstream_keys) {
      const resolved = entityIndex.get(up);
      if (!resolved) continue;
      if (attributeEdgeEntityIds.has(up) && attributeEdgeEntityIds.has(lineageNodeKey(e))) continue;
      pushLayerEdge(edges, edgeSet, resolved, e);
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

// ── Chain extraction ──────────────────────────────────────────────────────────

/** Bidirectional BFS seeded from a specific layer::name entity key. */
function extractFromEntityKey(entityKey: string, allEntities: LineageEntity[]): LineageEntity[] {
  const seed = allEntities.find((e) => lineageNodeKey(e) === entityKey);
  if (!seed) return allEntities;

  const fqnIndex = new Map(allEntities.map((e) => [e.name, e]));
  const keyIndex = new Map(allEntities.map((e) => [lineageNodeKey(e), e]));
  const result = new Map<string, LineageEntity>();
  result.set(entityKey, seed);

  let changed = true;
  while (changed) {
    changed = false;
    for (const e of allEntities) {
      const key = lineageNodeKey(e);
      if (result.has(key)) continue;
      const reachableUp = e.upstream_keys.some((ref) => {
        const up = keyIndex.get(ref) ?? fqnIndex.get(ref);
        return up && result.has(lineageNodeKey(up));
      });
      if (reachableUp) { result.set(key, e); changed = true; continue; }
      const reachableDown = [...result.values()].some((re) =>
        re.downstream_keys.includes(key) || re.downstream_keys.includes(e.name)
      );
      if (reachableDown) { result.set(key, e); changed = true; }
    }
  }
  return [...result.values()];
}


// ── Viewpoint trace helpers ───────────────────────────────────────────────────

/** BFS upstream: alle ancestor-keys van anchorKey via upstream_entity_fqns. */
function computeUpstreamKeys(anchorKey: string, entityIndex: Map<string, LineageEntity>): Set<string> {
  const result = new Set<string>([anchorKey]);
  const queue: string[] = [anchorKey];
  while (queue.length > 0) {
    const key = queue.shift()!;
    const entity = entityIndex.get(key);
    if (!entity) continue;
    for (const up of entity.upstream_keys) {
      if (!result.has(up)) { result.add(up); queue.push(up); }
    }
  }
  return result;
}

/** BFS downstream: alle descendant-keys van anchorKey via downstream_entity_fqns. */
function computeDownstreamKeys(anchorKey: string, entityIndex: Map<string, LineageEntity>): Set<string> {
  const result = new Set<string>([anchorKey]);
  const queue: string[] = [anchorKey];
  while (queue.length > 0) {
    const key = queue.shift()!;
    const entity = entityIndex.get(key);
    if (!entity) continue;
    for (const ds of entity.downstream_keys) {
      if (!result.has(ds)) { result.add(ds); queue.push(ds); }
    }
  }
  return result;
}

/** BFS upstream with hop distance. Returns Map<key, hopsFromAnchor>. */
function computeUpstreamDistances(anchorKey: string, entityIndex: Map<string, LineageEntity>): Map<string, number> {
  const dist = new Map<string, number>([[anchorKey, 0]]);
  const queue: [string, number][] = [[anchorKey, 0]];
  while (queue.length > 0) {
    const [key, d] = queue.shift()!;
    const entity = entityIndex.get(key);
    if (!entity) continue;
    for (const up of entity.upstream_keys) {
      if (!dist.has(up)) { dist.set(up, d + 1); queue.push([up, d + 1]); }
    }
  }
  return dist;
}

/** BFS downstream with hop distance. Returns Map<key, hopsFromAnchor>. */
function computeDownstreamDistances(anchorKey: string, entityIndex: Map<string, LineageEntity>): Map<string, number> {
  const dist = new Map<string, number>([[anchorKey, 0]]);
  const queue: [string, number][] = [[anchorKey, 0]];
  while (queue.length > 0) {
    const [key, d] = queue.shift()!;
    const entity = entityIndex.get(key);
    if (!entity) continue;
    for (const ds of entity.downstream_keys) {
      if (!dist.has(ds)) { dist.set(ds, d + 1); queue.push([ds, d + 1]); }
    }
  }
  return dist;
}

// ── Main component ─────────────────────────────────────────────────────────────

interface GraphViewProps {
  entities: LineageEntity[];
  attributes: LineageAttribute[];
  refreshedAt?: string;
  initialFocus?: string;
  onOpenColumns?: (query?: string) => void;
}

export function GraphView({ entities, attributes, refreshedAt, initialFocus, onOpenColumns }: GraphViewProps) {
  const [search, setSearch] = useState("");
  const [layerFilter, setLayerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [entityFocus, setEntityFocus] = useState<string | null>(null); // layer::name key
  const [focusLayerFilter, setFocusLayerFilter] = useState("all"); // filters entity picker list
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"all" | "upstream" | "downstream">("all");
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);

  const normalizedEntities = useMemo(() => normalizeLineageEntities(entities), [entities]);

  // Resolve initialFocus (entity_fqn from URL) to an entity key once entities are loaded
  useEffect(() => {
    if (!initialFocus || normalizedEntities.length === 0 || entityFocus) return;
    const fqnLower = initialFocus.toLowerCase();
    const match = normalizedEntities.find(
      (e) => e.name.toLowerCase().includes(fqnLower) || lineageNodeKey(e).toLowerCase() === fqnLower
    );
    if (match) setEntityFocus(lineageNodeKey(match));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFocus, normalizedEntities]);

  const entityOptions = useMemo(() => {
    const seen = new Set<string>();
    return normalizedEntities
      .filter((e) => {
        const key = lineageNodeKey(e);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((e) => ({ key: lineageNodeKey(e), label: lineageNodeLabel(e), layer: e.layer.toLowerCase() }))
      .sort((a, b) => {
        const li = LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer);
        return li !== 0 ? li : a.label.localeCompare(b.label);
      });
  }, [normalizedEntities]);

  const focusedEntities = useMemo(
    () => entityFocus ? extractFromEntityKey(entityFocus, normalizedEntities) : normalizedEntities,
    [entityFocus, normalizedEntities]
  );

  // When user traces upstream/downstream from a selected node, expand to the full entity set
  // so cross-chain upstream sources (e.g. multiple silver inputs into one gold entity) become visible.
  const graphEntities = useMemo(() => {
    if ((viewMode === "all" && !selectedNodeId) || !selectedNodeId) return focusedEntities;
    if (viewMode === "all") return focusedEntities;
    const entityIndex = new Map(normalizedEntities.map((e) => [lineageNodeKey(e), e]));
    const keys = viewMode === "upstream"
      ? computeUpstreamKeys(selectedNodeId, entityIndex)
      : computeDownstreamKeys(selectedNodeId, entityIndex);
    const traced = normalizedEntities.filter((e) => keys.has(lineageNodeKey(e)));
    return traced.length > 0 ? traced : focusedEntities;
  }, [viewMode, selectedNodeId, normalizedEntities, focusedEntities]);

  // Stable callback — no deps so reference never changes
  const handleFocusFromNode = useCallback((nodeId: string, direction: "upstream" | "downstream") => {
    setSelectedNodeId(nodeId);
    setViewMode(direction);
  }, []);

  function injectNavCallbacks(rawNodes: Node[]): Node[] {
    return rawNodes.map((n) => {
      if (n.type !== "entity") return n;
      const d = n.data as unknown as GraphNodeData;
      return {
        ...n,
        data: {
          ...n.data,
          upstreamCount: d.upstream_entity_fqns.length,
          downstreamCount: d.downstream_entity_fqns.length,
          onFocusUpstream: () => handleFocusFromNode(n.id, "upstream"),
          onFocusDownstream: () => handleFocusFromNode(n.id, "downstream"),
        },
      };
    });
  }

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => {
      const { nodes: n, edges: e } = buildGraph(graphEntities, attributes);
      return { nodes: injectNavCallbacks(n), edges: e };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graphEntities, attributes]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    const { nodes: n, edges: e } = buildGraph(graphEntities, attributes);
    setNodes(injectNavCallbacks(n));
    setEdges(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attributes, graphEntities, setNodes, setEdges]);

  useEffect(() => {
    if (!flow) return;
    window.requestAnimationFrame(() => {
      flow.fitView({ ...DEFAULT_FIT_VIEW_OPTIONS, duration: 250 });
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
    const { nodes: n, edges: e } = buildGraph(focusedEntities, attributes);
    setNodes(injectNavCallbacks(n));
    setEdges(e);
    setSearch("");
    setLayerFilter("all");
    setStatusFilter("all");
    setEntityFocus(null);
    setFocusLayerFilter("all");
    setSelectedNodeId(null);
    setViewMode("all");
    window.requestAnimationFrame(() => {
      flow?.fitView({ ...DEFAULT_FIT_VIEW_OPTIONS, duration: 300 });
    });
  }, [attributes, flow, focusedEntities, setNodes, setEdges]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const data = node.data as unknown as GraphNodeData;
    const newId = data.nodeId;
    setSelectedNodeId((prev) => {
      if (prev === newId) { setViewMode("all"); return null; }
      setViewMode("all");
      return newId;
    });
  }, []);

  // Derive layer options from focused entities
  const layerOptions = useMemo(() => {
    const present = new Set(focusedEntities.map((e) => e.layer.toLowerCase()));
    return ["all", ...LAYER_ORDER.filter((l) => present.has(l)), ...[...present].filter((l) => !LAYER_ORDER.includes(l))];
  }, [focusedEntities]);

  // Apply filters as opacity on nodes (skip layer header nodes — they have no GraphNodeData)
  const filteredNodes = useMemo(() => {
    const q = search.toLowerCase().trim();
    return nodes.map((n) => {
      if (n.type === "layerHeader") return n;
      const d = n.data as unknown as GraphNodeData;
      const matchSearch = !q || d.label.toLowerCase().includes(q) || d.fullFqn.toLowerCase().includes(q);
      const matchLayer = layerFilter === "all" || d.layer.toLowerCase() === layerFilter;
      const matchStatus = statusFilter === "all" || d.latest_status.toLowerCase() === statusFilter;
      const visible = matchSearch && matchLayer && matchStatus;
      return { ...n, style: { ...(n.style ?? {}), opacity: visible ? 1 : 0.15 } };
    });
  }, [nodes, search, layerFilter, statusFilter]);

  // Neighbor highlight: direct 1-hop connections of selected node
  const neighborNodeIds = useMemo(() => {
    if (!selectedNodeId) return null;
    const ids = new Set<string>([selectedNodeId]);
    edges.forEach((e) => {
      if (e.source === selectedNodeId) ids.add(e.target);
      if (e.target === selectedNodeId) ids.add(e.source);
    });
    return ids;
  }, [selectedNodeId, edges]);

  // Viewpoint trace: full upstream or downstream path from selected node
  const viewpointNodeIds = useMemo(() => {
    if (viewMode === "all" || !selectedNodeId) return null;
    const entityIndex = new Map(graphEntities.map((e) => [lineageNodeKey(e), e]));
    if (viewMode === "upstream") return computeUpstreamKeys(selectedNodeId, entityIndex);
    return computeDownstreamKeys(selectedNodeId, entityIndex);
  }, [viewMode, selectedNodeId, graphEntities]);

  // Active highlight set: viewpoint takes precedence over neighbor
  const highlightedNodeIds = viewpointNodeIds ?? neighborNodeIds;

  // Trace role + hop distance per node (for rich node-level rendering)
  const traceData = useMemo(() => {
    if (!selectedNodeId) return null;
    const entityIndex = new Map(graphEntities.map((e) => [lineageNodeKey(e), e]));
    const upDist = computeUpstreamDistances(selectedNodeId, entityIndex);
    const downDist = computeDownstreamDistances(selectedNodeId, entityIndex);
    const map = new Map<string, { role: "anchor" | "upstream" | "downstream" | "both" | "neutral"; hopDistance: number }>();
    const allKeys = new Set([...upDist.keys(), ...downDist.keys()]);
    for (const key of allKeys) {
      const isUp = upDist.has(key) && key !== selectedNodeId;
      const isDown = downDist.has(key) && key !== selectedNodeId;
      if (key === selectedNodeId) {
        map.set(key, { role: "anchor", hopDistance: 0 });
      } else if (isUp && isDown) {
        map.set(key, { role: "both", hopDistance: Math.min(upDist.get(key)!, downDist.get(key)!) });
      } else if (isUp) {
        map.set(key, { role: "upstream", hopDistance: upDist.get(key)! });
      } else if (isDown) {
        map.set(key, { role: "downstream", hopDistance: downDist.get(key)! });
      }
    }
    return map;
  }, [selectedNodeId, graphEntities]);

  // Merge filter opacity + trace role data into display nodes
  const displayNodes = useMemo(() => {
    return filteredNodes.map((n) => {
      if (n.type === "layerHeader") return n;
      const trace = traceData?.get(n.id);
      const inFocus = highlightedNodeIds ? highlightedNodeIds.has(n.id) : true;
      const base = (n.style?.opacity as number) ?? 1;
      const opacity = highlightedNodeIds ? (inFocus ? base : Math.min(base, 0.12)) : base;
      return {
        ...n,
        style: { ...n.style, opacity },
        data: {
          ...n.data,
          traceRole: trace?.role ?? (traceData ? "neutral" : undefined),
          hopDistance: trace?.hopDistance,
        },
      };
    });
  }, [filteredNodes, highlightedNodeIds, traceData]);

  // Edge highlight: dim edges not connected to highlighted nodes
  const displayEdges = useMemo(() => {
    if (!highlightedNodeIds) return edges;
    return edges.map((e) => {
      const connected = highlightedNodeIds.has(e.source) && highlightedNodeIds.has(e.target);
      const isDirectConnection = e.source === selectedNodeId || e.target === selectedNodeId;
      return {
        ...e,
        style: {
          ...e.style,
          opacity: connected ? 1 : 0.07,
          strokeWidth: isDirectConnection ? 3 : (e.style?.strokeWidth ?? 2),
        },
      };
    });
  }, [edges, highlightedNodeIds, selectedNodeId]);

  const selectedEntity = useMemo(
    () => {
      const matchedEntity = graphEntities.find((e) => lineageNodeKey(e) === selectedNodeId);
      if (matchedEntity) return matchedEntity;

      const selectedNode = nodes.find((node) => node.id === selectedNodeId && node.type !== "layerHeader");
      if (!selectedNode) return null;

      const data = selectedNode.data as unknown as GraphNodeData;
      return {
        name: data.fullFqn,
        layer: data.layer,
        latest_status: data.latest_status,
        end_to_end_status: data.end_to_end_status,
        latest_success_at: data.latest_success_at,
        upstream_keys: data.upstream_entity_fqns,
        downstream_keys: data.downstream_entity_fqns,
        lineage_group_id: data.lineage_group_id,
        last_completed_layer: null,
        dataset_id: null,
      } satisfies LineageEntity;
    },
    [nodes, focusedEntities, selectedNodeId]
  );

  // Navigate-to: selecteer de node waarvan de ref de layer::fqn key is.
  // upstream_entity_fqns/downstream_entity_fqns zijn na LADR-058 exacte layer::fqn keys.
  const handleNavigateTo = useCallback((fqn: string, direction: "upstream" | "downstream") => {
    const byKey = normalizedEntities.find((e) => lineageNodeKey(e) === fqn);
    if (byKey) { setSelectedNodeId(lineageNodeKey(byKey)); setViewMode(direction); return; }
    const byFqn = normalizedEntities.find((e) => e.name === fqn);
    if (byFqn) { setSelectedNodeId(lineageNodeKey(byFqn)); setViewMode(direction); return; }
    setSelectedNodeId(null);
  }, [normalizedEntities]);

  const mapSummary = selectedNodeId
    ? viewMode === "all"
      ? "Selected node with direct neighborhood emphasis."
      : `Showing ${viewMode} path from the selected node across the wider estate.`
    : entityFocus
      ? "Scoped to one entity-centered slice of the estate."
      : "Broad topology view across the active installation.";

  return (
    <div className="flex flex-col h-full">
      <div
        className="grid gap-3 px-4 py-3 shrink-0 md:grid-cols-[minmax(0,1fr)_220px]"
        style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>
            Map
          </p>
          <p className="mt-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            Estate topology and relationship orientation
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            {mapSummary}
          </p>
        </div>
        <div
          className="rounded-xl px-3 py-2"
          style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            Current scope
          </p>
          <p className="mt-1 text-lg font-semibold" style={{ color: "var(--color-text)" }}>
            {graphEntities.length}{(entityFocus || (selectedNodeId && viewMode !== "all")) ? ` / ${normalizedEntities.length}` : ""}
          </p>
          <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            entities visible{refreshedAt ? ` · refreshed ${(() => { try { return new Date(refreshedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); } catch { return refreshedAt; } })()}` : ""}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-4 py-2 shrink-0 flex-wrap"
        style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-card)" }}
      >
        {/* Entity focus — layer filter + entity selector */}
        <div className="flex items-center gap-1">
          {(["all", ...LAYER_ORDER] as string[]).map((l) => {
            const accent = LAYER_ACCENT[l] ?? "var(--color-text-muted)";
            const active = focusLayerFilter === l;
            const count = l === "all" ? entityOptions.length : entityOptions.filter((e) => e.layer === l).length;
            if (l !== "all" && count === 0) return null;
            return (
              <button
                key={l}
                onClick={() => setFocusLayerFilter(l)}
                className="text-[10px] font-bold uppercase tracking-wide rounded px-2 py-1 transition-colors"
                style={{
                  background: active ? (LAYER_ACCENT[l] ?? "var(--color-brand)") : "transparent",
                  color: active ? "#fff" : "var(--color-text-muted)",
                  border: `1px solid ${active ? (LAYER_ACCENT[l] ?? "var(--color-brand)") : "var(--color-border)"}`,
                }}
              >
                {l === "all" ? "All" : l}
              </button>
            );
          })}
        </div>

        <select
          value={entityFocus ?? ""}
          onChange={(e) => { setEntityFocus(e.target.value || null); setSelectedNodeId(null); setViewMode("all"); }}
          className="text-xs rounded-lg px-2.5 py-1.5 outline-none max-w-[200px] cursor-pointer"
          style={{
            background: "var(--color-surface)",
            border: `1.5px solid ${entityFocus ? "var(--color-primary, var(--color-brand))" : "var(--color-border)"}`,
            color: entityFocus ? "var(--color-primary, var(--color-brand))" : "var(--color-text)",
            fontWeight: entityFocus ? 600 : undefined,
          }}
        >
          <option value="">Full estate</option>
          {entityOptions
            .filter((opt) => focusLayerFilter === "all" || opt.layer === focusLayerFilter)
            .map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label} ({opt.layer})
              </option>
            ))}
        </select>

        {/* Divider */}
        <span style={{ width: 1, height: 20, background: "var(--color-border)", flexShrink: 0 }} />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search map…"
            className="text-xs rounded-lg pl-7 pr-3 py-1.5 w-36 outline-none"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          />
        </div>

        {/* Layer filter pills */}
        <div className="flex items-center gap-1">
          {layerOptions.map((l) => {
            const accent = LAYER_ACCENT[l] ?? "var(--color-text-muted)";
            const active = layerFilter === l;
            return (
              <button
                key={l}
                onClick={() => setLayerFilter(l)}
                className="text-[10px] font-bold uppercase tracking-wide rounded px-2 py-1 transition-colors"
                style={{
                  background: active ? accent : "transparent",
                  color: active ? "#fff" : "var(--color-text-muted)",
                  border: `1px solid ${active ? accent : "var(--color-border)"}`,
                }}
              >
                {l === "all" ? "All" : l}
              </button>
            );
          })}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs rounded-lg px-2.5 py-1.5 outline-none cursor-pointer"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
        >
          <option value="all">All statuses</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="partial">Partial</option>
          <option value="in_progress">In progress</option>
          <option value="failed">Failed</option>
          <option value="unknown">Unknown</option>
        </select>

        {/* Reset layout */}
        <button
          onClick={handleResetLayout}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
          title="Reset map positions and scope"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset map
        </button>

        {/* Viewpoint toggle — only shown when a node is selected */}
        {selectedNodeId && (
          <>
            <span style={{ width: 1, height: 20, background: "var(--color-border)", flexShrink: 0 }} />
            <div className="flex items-center gap-1">
              {[
                { mode: "all" as const, label: "Context", Icon: GitBranch },
                { mode: "upstream" as const, label: "Upstream", Icon: ArrowUpFromLine },
                { mode: "downstream" as const, label: "Downstream", Icon: ArrowDownToLine },
              ].map(({ mode, label, Icon }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors"
                  style={{
                    background: viewMode === mode ? "var(--color-accent)" : "var(--color-surface)",
                    color: viewMode === mode ? "#fff" : "var(--color-text-muted)",
                    border: `1px solid ${viewMode === mode ? "var(--color-accent)" : "var(--color-border)"}`,
                  }}
                  title={`Show ${label} path`}
                  >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Canvas + detail panel */}
      <div className="flex-1 min-h-0 relative">
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onNodeClick={handleNodeClick}
          onInit={setFlow}
          fitView
          fitViewOptions={DEFAULT_FIT_VIEW_OPTIONS}
          minZoom={0.58}
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
            onSetAnchor={(entityKey) => {
              setEntityFocus(entityKey);
              setSelectedNodeId(entityKey);
              setViewMode("all");
            }}
            onOpenColumns={onOpenColumns}
          />
        )}
      </div>
    </div>
  );
}
