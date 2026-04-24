"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Code, GitBranch, Search } from "lucide-react";
import type { LineageHop } from "@/lib/adapters/types";
import { buildOpenLineageDatasets } from "./openlineage-mapping";
import { isContextHop, isDataFlowHop } from "@/lib/lineage-hop-kind";

interface RunEvent {
  run_id: string;
  job_name: string;
  dataset_id: string;
  step: string;
  layer: string;
  timestamp: string;
  hops: LineageHop[];
}

const LAYER_LABELS: Record<string, string> = {
  landing: "Landing",
  raw: "Raw",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

interface RunEventCardProps {
  event: RunEvent;
  onViewJson: () => void;
}

export function RunEventCard({ event, onViewJson }: RunEventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [hopSearch, setHopSearch] = useState("");
  const [showAllHops, setShowAllHops] = useState(false);

  const inputDatasets = useMemo(() => buildOpenLineageDatasets(event.hops, "source"), [event.hops]);
  const outputDatasets = useMemo(() => buildOpenLineageDatasets(event.hops, "target"), [event.hops]);
  const dataFlowHopCount = useMemo(() => event.hops.filter(isDataFlowHop).length, [event.hops]);
  const contextHopCount = useMemo(() => event.hops.filter(isContextHop).length, [event.hops]);
  const filteredHops = useMemo(() => {
    const q = hopSearch.trim().toLowerCase();
    if (!q) return event.hops;
    return event.hops.filter((hop) =>
      [
        hop.hop_kind,
        hop.source_entity,
        hop.source_ref,
        hop.source_attribute,
        hop.target_entity,
        hop.target_ref,
        hop.target_attribute,
        hop.step,
      ].some((value) => (value ?? "").toLowerCase().includes(q))
    );
  }, [event.hops, hopSearch]);
  const visibleHops = showAllHops ? filteredHops : filteredHops.slice(0, 25);

  return (
    <Card>
      <CardContent className="p-0">
        {/* Header */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setExpanded(!expanded)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpanded(!expanded); }}
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors cursor-pointer"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold truncate" title={event.job_name}>{event.job_name}</span>
              <Badge variant="default">{LAYER_LABELS[event.layer] ?? event.layer}</Badge>
              <Badge variant="muted">{event.step}</Badge>
              <Badge variant="muted">{event.dataset_id}</Badge>
              <Badge variant="muted" title={event.run_id}>Run {event.run_id.slice(0, 8)}</Badge>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {new Date(event.timestamp).toLocaleString()} · {dataFlowHopCount} data flow hop{dataFlowHopCount !== 1 ? "s" : ""}
              {contextHopCount > 0 ? ` · ${contextHopCount} context` : ""}
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewJson();
            }}
            className="rounded-md p-1.5 hover:bg-accent transition-colors"
            title="View JSON"
          >
            <Code className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="border-t border-border px-4 py-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Input Datasets ({inputDatasets.length})
                </p>
                <div className="space-y-1">
                  {inputDatasets.map((ds) => (
                    <div key={ds.key} className="flex items-center gap-2 text-sm">
                      <GitBranch className="h-3 w-3 shrink-0" style={{ color: "var(--color-success)" }} />
                      <span className="font-mono text-xs truncate" title={ds.ref}>{ds.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Output Datasets ({outputDatasets.length})
                </p>
                <div className="space-y-1">
                  {outputDatasets.map((ds) => (
                    <div key={ds.key} className="flex items-center gap-2 text-sm">
                      <GitBranch className="h-3 w-3 shrink-0" style={{ color: "var(--color-primary)" }} />
                      <span className="font-mono text-xs truncate" title={ds.ref}>{ds.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Hop details */}
            <div>
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Lineage Hops ({filteredHops.length})
                </p>
                <div
                  className="flex items-center gap-1.5 rounded-md px-2 py-1"
                  style={{ border: "1px solid var(--color-border)", background: "var(--color-card)" }}
                >
                  <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <input
                    value={hopSearch}
                    onChange={(e) => {
                      setHopSearch(e.target.value);
                      setShowAllHops(false);
                    }}
                    placeholder="Search hops..."
                    className="w-44 bg-transparent text-xs outline-none"
                    style={{ color: "var(--color-text)" }}
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Source</th>
                      <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Attribute</th>
                      <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Target</th>
                      <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Kind</th>
                      <th className="text-left py-1.5 font-medium text-muted-foreground">Attribute</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleHops.map((hop, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="py-1.5 pr-3 font-mono" title={hop.source_ref || hop.source_entity}>{hop.source_ref || hop.source_entity}</td>
                        <td className="py-1.5 pr-3 text-muted-foreground">{hop.source_attribute ?? "—"}</td>
                        <td className="py-1.5 pr-3 font-mono" title={hop.target_ref || hop.target_entity}>{hop.target_ref || hop.target_entity}</td>
                        <td className="py-1.5 pr-3 text-muted-foreground">{isDataFlowHop(hop) ? "data_flow" : (hop.hop_kind ?? "context")}</td>
                        <td className="py-1.5 text-muted-foreground">{hop.target_attribute ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredHops.length > visibleHops.length && (
                <button
                  onClick={() => setShowAllHops(true)}
                  className="mt-2 rounded-md px-2 py-1 text-xs font-medium"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-accent)" }}
                >
                  Show all {filteredHops.length} hops
                </button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
