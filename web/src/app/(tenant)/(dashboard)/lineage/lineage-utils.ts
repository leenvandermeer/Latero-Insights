import type { LineageEntity } from "@/lib/adapters/types";

export const LINEAGE_LAYER_ORDER = ["landing", "raw", "bronze", "silver", "gold"] as const;
export type HealthStatus = "healthy" | "warning" | "error" | "unknown";

function lastSegment(value: string): string {
  return value.split(".").filter(Boolean).at(-1) ?? value;
}

function stripKnownSuffixes(value: string): string {
  return value.replace(/_(raw|bronze|silver|gold)$/i, "");
}

function stripFileExtension(value: string): string {
  return value.replace(/\.[^.]+$/, "");
}

export function lineageLayerIndex(layerOrEntity: string | LineageEntity): number {
  const layer = typeof layerOrEntity === "string" ? layerOrEntity : layerOrEntity.layer;
  return (LINEAGE_LAYER_ORDER as readonly string[]).indexOf(layer.toLowerCase());
}

export function lineageDatasetKey(entity: LineageEntity): string {
  if (entity.dataset_id && entity.dataset_id.trim()) return entity.dataset_id.trim();
  const parts = entity.entity_fqn.split(".").filter(Boolean);
  const second = parts.at(-2);
  if (second && !(LINEAGE_LAYER_ORDER as readonly string[]).includes(second.toLowerCase())) return second;
  const last = parts.at(-1) ?? entity.entity_fqn;
  return stripKnownSuffixes(last) || last;
}

export function lineageDatasetLabel(entity: LineageEntity): string {
  const layer = entity.layer.toLowerCase();
  if (layer === "silver" || layer === "gold") {
    const last = entity.entity_fqn.split(".").filter(Boolean).at(-1) ?? entity.entity_fqn;
    const stripped = stripKnownSuffixes(last);
    return stripped || last;
  }
  return lineageDatasetKey(entity);
}

export function lineageRefLabel(ref: string): string {
  const trimmed = ref.trim();
  if (!trimmed) return ref;

  if (trimmed.includes("/")) {
    const fileName = trimmed.split(/[?#]/)[0].split("/").filter(Boolean).at(-1) ?? trimmed;
    return fileName;
  }

  const last = trimmed.split(".").filter(Boolean).at(-1) ?? trimmed;
  const normalized = stripKnownSuffixes(stripFileExtension(last));
  return normalized || last;
}

export function areAdjacentLineageLayers(source: LineageEntity, target: LineageEntity): boolean {
  const sourceIdx = lineageLayerIndex(source);
  const targetIdx = lineageLayerIndex(target);
  if (sourceIdx === -1 || targetIdx === -1) return true;
  return targetIdx >= sourceIdx;
}

export function lineageEntityKey(entity: LineageEntity): string {
  return `${entity.layer.toLowerCase()}::${entity.entity_fqn}`;
}
