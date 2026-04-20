"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Code, GitBranch } from "lucide-react";
import type { LineageHop } from "@/lib/adapters/types";

interface RunEvent {
  run_id: string;
  dataset_id: string;
  step: string;
  timestamp: string;
  hops: LineageHop[];
}

interface RunEventCardProps {
  event: RunEvent;
  onViewJson: () => void;
}

export function RunEventCard({ event, onViewJson }: RunEventCardProps) {
  const [expanded, setExpanded] = useState(false);

  const inputDatasets = new Set(event.hops.map((h) => h.source_entity));
  const outputDatasets = new Set(event.hops.map((h) => h.target_entity));

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
              <span className="font-mono text-sm font-medium truncate">{event.run_id}</span>
              <Badge variant="default">{event.step}</Badge>
              <Badge variant="muted">{event.dataset_id}</Badge>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {new Date(event.timestamp).toLocaleString()} · {event.hops.length} hop{event.hops.length !== 1 ? "s" : ""}
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
                  Input Datasets ({inputDatasets.size})
                </p>
                <div className="space-y-1">
                  {[...inputDatasets].map((ds) => (
                    <div key={ds} className="flex items-center gap-2 text-sm">
                      <GitBranch className="h-3 w-3 shrink-0" style={{ color: "var(--color-success)" }} />
                      <span className="font-mono text-xs truncate">{ds}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Output Datasets ({outputDatasets.size})
                </p>
                <div className="space-y-1">
                  {[...outputDatasets].map((ds) => (
                    <div key={ds} className="flex items-center gap-2 text-sm">
                      <GitBranch className="h-3 w-3 shrink-0" style={{ color: "var(--color-primary)" }} />
                      <span className="font-mono text-xs truncate">{ds}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Hop details */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Lineage Hops
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Source</th>
                      <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Attribute</th>
                      <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Target</th>
                      <th className="text-left py-1.5 font-medium text-muted-foreground">Attribute</th>
                    </tr>
                  </thead>
                  <tbody>
                    {event.hops.map((hop, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="py-1.5 pr-3 font-mono">{hop.source_entity}</td>
                        <td className="py-1.5 pr-3 text-muted-foreground">{hop.source_attribute ?? "—"}</td>
                        <td className="py-1.5 pr-3 font-mono">{hop.target_entity}</td>
                        <td className="py-1.5 text-muted-foreground">{hop.target_attribute ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
