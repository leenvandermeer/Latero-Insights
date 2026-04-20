"use client";

import { useMemo } from "react";
import { X, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { LineageHop } from "@/lib/adapters/types";

interface RunEvent {
  run_id: string;
  dataset_id: string;
  step: string;
  timestamp: string;
  hops: LineageHop[];
}

interface JsonDrawerProps {
  event: RunEvent;
  onClose: () => void;
}

function toOpenLineageFormat(event: RunEvent) {
  const inputDatasets = [...new Set(event.hops.map((h) => h.source_entity))].map((name) => ({
    namespace: "latero",
    name,
    facets: {
      columnLineage: {
        fields: event.hops
          .filter((h) => h.source_entity === name && h.source_attribute)
          .map((h) => ({
            name: h.source_attribute,
            transformationType: "DIRECT",
          })),
      },
    },
  }));

  const outputDatasets = [...new Set(event.hops.map((h) => h.target_entity))].map((name) => ({
    namespace: "latero",
    name,
    facets: {
      columnLineage: {
        fields: event.hops
          .filter((h) => h.target_entity === name && h.target_attribute)
          .map((h) => ({
            name: h.target_attribute,
            inputFields: [
              {
                namespace: "latero",
                name: h.source_entity,
                field: h.source_attribute ?? "*",
              },
            ],
          })),
      },
    },
  }));

  return {
    eventType: "COMPLETE",
    eventTime: event.timestamp,
    run: {
      runId: event.run_id,
      facets: {
        processing_engine: {
          name: "latero-mdcf",
          version: "1.0",
        },
      },
    },
    job: {
      namespace: "latero",
      name: `${event.dataset_id}.${event.step}`,
    },
    inputs: inputDatasets,
    outputs: outputDatasets,
  };
}

export function JsonDrawer({ event, onClose }: JsonDrawerProps) {
  const [copied, setCopied] = useState(false);

  const json = useMemo(() => {
    const formatted = toOpenLineageFormat(event);
    return JSON.stringify(formatted, null, 2);
  }, [event]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="OpenLineage JSON">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-lg bg-card border-l border-border shadow-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-semibold text-sm">
            OpenLineage Event — {event.run_id.slice(0, 8)}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="rounded-md p-1.5 hover:bg-muted transition-colors"
              title="Copy JSON"
            >
              {copied ? (
                <Check className="h-4 w-4" style={{ color: "var(--color-success)" }} />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words text-foreground">
            {json}
          </pre>
        </div>
      </div>
    </div>
  );
}
