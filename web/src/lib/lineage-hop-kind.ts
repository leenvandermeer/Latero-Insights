import type { LineageHop } from "@/lib/adapters/types";

export function normalizeHopKind(hopKind: string | null | undefined): string {
  return (hopKind ?? "").trim().toLowerCase();
}

export function isDataFlowHop(hop: Pick<LineageHop, "hop_kind">): boolean {
  const kind = normalizeHopKind(hop.hop_kind);
  return kind === "" || kind === "data_flow";
}

export function isContextHop(hop: Pick<LineageHop, "hop_kind">): boolean {
  return normalizeHopKind(hop.hop_kind) === "context";
}

export function filterDataFlowHops<T extends Pick<LineageHop, "hop_kind">>(hops: T[]): T[] {
  return hops.filter(isDataFlowHop);
}
