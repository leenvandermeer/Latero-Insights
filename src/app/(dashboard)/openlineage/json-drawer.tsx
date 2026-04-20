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
          name: "latero-meta-data-controle-framework",
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
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="relative w-full max-w-lg flex flex-col overflow-hidden"
        style={{
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-drawer, -4px 0 24px rgba(27,59,107,0.12))",
          animation: "slideInRight 0.2s ease-out",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <h3 className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
            OpenLineage Event — {event.run_id.slice(0, 8)}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="rounded-md p-1.5 transition-colors"
              style={{ color: "var(--color-text-muted)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
              title="Copy JSON"
            >
              {copied ? (
                <Check className="h-4 w-4" style={{ color: "var(--color-success)" }} />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 transition-colors"
              style={{ color: "var(--color-text-muted)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words" style={{ color: "var(--color-text)" }}>
            {json}
          </pre>
        </div>
      </div>
    </div>
  );
}
