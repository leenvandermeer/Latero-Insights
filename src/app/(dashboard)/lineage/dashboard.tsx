"use client";

import { useLineage, useQuality, useDateRange, useCanonicalLineage } from "@/hooks";
import { useMemo, useState } from "react";
import { normalizeStatus } from "@/lib/chart-colors";
import {
  DateRangePicker,
  SourceIndicator,
  ErrorMessage,
  EmptyState,
} from "@/components/ui";
import { isNoDataError } from "@/lib/api";
import { Skeleton } from "@/components/ui/loading-skeleton";
import { LineageCanvas } from "./lineage-canvas";
import { ChainView } from "./chain-view";
import { Download } from "lucide-react";

export function LineageDashboard() {
  const { from, to, setRange } = useDateRange();
  const [lineageMode, setLineageMode] = useState<"history" | "canonical" | "chain">("history");
  const { data: response, isLoading, error, refetch } = useLineage(from, to);
  const { data: canonicalRes, isLoading: canonicalLoading } = useCanonicalLineage();
  const { data: qualityRes } = useQuality(from, to);

  const activeHops = lineageMode === "canonical" ? (canonicalRes?.data ?? []) : (response?.data ?? []);
  const activeLoading = lineageMode === "canonical" ? canonicalLoading : isLoading;

  const hops = activeHops;
  const checks = qualityRes?.data ?? [];

  const handleExport = () => {
    const runEvents: Record<string, { runId: string; job: string; eventTime: string; inputs: string[]; outputs: string[] }> = {};

    for (const hop of hops) {
      if (!runEvents[hop.run_id]) {
        runEvents[hop.run_id] = {
          runId: hop.run_id,
          job: `${hop.dataset_id}.${hop.step}`,
          eventTime: hop.timestamp_utc,
          inputs: [],
          outputs: [],
        };
      }
      const ev = runEvents[hop.run_id];
      if (!ev.inputs.includes(hop.source_ref)) ev.inputs.push(hop.source_ref);
      if (!ev.outputs.includes(hop.target_ref)) ev.outputs.push(hop.target_ref);
    }

    const payload = Object.values(runEvents).map(ev => ({
      eventType: "COMPLETE",
      eventTime: ev.eventTime,
      run: { runId: ev.runId },
      job: { namespace: "latero", name: ev.job },
      inputs: ev.inputs.map(ref => ({ namespace: "latero", name: ref })),
      outputs: ev.outputs.map(ref => ({ namespace: "latero", name: ref })),
      producer: "https://latero.io",
      schemaURL: "https://openlineage.io/spec/1-0-5/OpenLineage.json",
    }));

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lineage-export-${from}-${to}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Per-dataset DQ health: "healthy" | "warning" | "error" | "unknown"
  const datasetHealth = useMemo(() => {
    const map = new Map<string, "healthy" | "warning" | "error" | "unknown">();
    const byDataset = new Map<string, { pass: number; warn: number; fail: number }>();
    for (const c of checks) {
      const s = normalizeStatus(c.check_status);
      const entry = byDataset.get(c.dataset_id) ?? { pass: 0, warn: 0, fail: 0 };
      if (s === "SUCCESS") entry.pass++;
      else if (s === "WARNING") entry.warn++;
      else if (s === "FAILED") entry.fail++;
      byDataset.set(c.dataset_id, entry);
    }
    for (const [dataset, counts] of byDataset) {
      if (counts.fail > 0) map.set(dataset, "error");
      else if (counts.warn > 0) map.set(dataset, "warning");
      else if (counts.pass > 0) map.set(dataset, "healthy");
      else map.set(dataset, "unknown");
    }
    return map;
  }, [checks]);

  if (error) {
    return (
      <div className="space-y-4">
        <LineageHeader from={from} to={to} onRangeChange={setRange} />
        {isNoDataError(error)
          ? <EmptyState from={from} to={to} onRetry={() => refetch()} />
          : <ErrorMessage message={error.message} onRetry={() => refetch()} />
        }
      </div>
    );
  }

  return (
    /* Full-viewport column: header + canvas fill everything from top padding down */
    <div
      className="flex flex-col -mx-6 -mt-6"
      style={{ height: "100dvh", paddingTop: "24px" }}
    >
      {/* Compact inline header — no card chrome, just a slim bar */}
      <div
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest shrink-0"
            style={{ color: "var(--color-accent)", letterSpacing: "0.13em" }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--color-accent)",
                flexShrink: 0,
              }}
            />
            Data Lineage
          </span>
          <span
            className="font-display font-light italic text-xl leading-none"
            style={{ color: "var(--color-text)" }}
          >
            Lineage Explorer
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {response && lineageMode === "history" && (
            <SourceIndicator source={response.source} cachedAt={response.cachedAt} />
          )}
          {canonicalRes && lineageMode === "canonical" && (
            <SourceIndicator source={canonicalRes.source} cachedAt={canonicalRes.cachedAt} />
          )}
          {/* Mode toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
            {(["history", "canonical", "chain"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setLineageMode(mode)}
                className="px-3 py-1.5 text-xs font-medium"
                style={{
                  background: lineageMode === mode ? "var(--color-accent)" : "transparent",
                  color: lineageMode === mode ? "#fff" : "var(--color-text-muted)",
                }}
                title={
                  mode === "canonical" ? "Current structural lineage — deduplicated, no date filter"
                  : mode === "chain" ? "Full pipeline chain view — upstream to downstream per dataset"
                  : "Run history — filtered by date range"
                }
              >
                {mode === "history" ? "Run History" : mode === "canonical" ? "Current Structure" : "Pipeline Chain"}
              </button>
            ))}
          </div>
          <div style={{ opacity: (lineageMode === "canonical" || lineageMode === "chain") ? 0.4 : 1, pointerEvents: (lineageMode === "canonical" || lineageMode === "chain") ? "none" : "auto", transition: "opacity 0.2s" }}>
            <DateRangePicker from={from} to={to} onChange={(f, t) => setRange(f, t)} />
          </div>
          <button
            onClick={handleExport}
            disabled={hops.length === 0}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border disabled:opacity-40"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
            title="Export as OpenLineage JSON"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Canonical mode info banner */}
      {lineageMode === "canonical" && (
        <div
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm shrink-0"
          style={{ background: "rgba(200,137,42,0.08)", border: "1px solid var(--color-accent)", color: "var(--color-accent)", margin: "8px 24px 0" }}
        >
          <span className="text-xs">Showing the current structural lineage — deduplicated edges, most recent hop per source→target flow. Reflects the latest available data; date range has no effect in this mode.</span>
        </div>
      )}

      {/* Chain mode info banner */}
      {lineageMode === "chain" && (
        <div
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm shrink-0"
          style={{ background: "rgba(200,137,42,0.08)", border: "1px solid var(--color-accent)", color: "var(--color-accent)", margin: "8px 24px 0" }}
        >
          <span className="text-xs">Showing the full pipeline chain from landing to gold — select a dataset to trace its complete upstream-to-downstream journey. Uses the latest structural lineage.</span>
        </div>
      )}

      {/* Stats bar */}
      {!activeLoading && hops.length > 0 && (() => {
        const entities = new Set([...hops.map(h => h.source_entity), ...hops.map(h => h.target_entity)]);
        const datasets = new Set(hops.map(h => h.dataset_id));
        const healthCounts: Record<string, number> = { healthy: 0, warning: 0, error: 0, unknown: 0 };
        for (const [, v] of datasetHealth) healthCounts[v] = (healthCounts[v] ?? 0) + 1;

        const atRiskCount = (() => {
          const errorDatasets = new Set(
            [...datasetHealth.entries()]
              .filter(([, v]) => v === "error")
              .map(([k]) => k)
          );
          const errorSources = new Set(
            hops.filter(h => errorDatasets.has(h.dataset_id)).map(h => h.source_entity)
          );
          const atRisk = new Set<string>();
          for (const src of errorSources) {
            hops.filter(h => h.source_entity === src).forEach(h => atRisk.add(h.target_entity));
          }
          return atRisk.size;
        })();
        return (
          <div
            className="flex items-center gap-6 px-6 py-3 shrink-0 flex-wrap"
            style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}
          >
            {[
              { label: "Entities", value: entities.size, color: undefined },
              { label: "Datasets", value: datasets.size, color: undefined },
              { label: "Lineage hops", value: hops.length, color: undefined },
              { label: "Healthy", value: healthCounts.healthy, color: "#16a34a" },
              { label: "Warning", value: healthCounts.warning, color: "#ca8a04" },
              { label: "Error", value: healthCounts.error, color: "#dc2626" },
              { label: "At risk", value: atRiskCount, color: atRiskCount > 0 ? "#dc2626" : undefined },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                {color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />}
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</span>
                <span className="text-xs font-bold" style={{ color: color ?? "var(--color-text)" }}>{value}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Canvas — fills all remaining height */}
      <div className="flex-1 min-h-0">
        {activeLoading ? (
          <Skeleton className="w-full h-full" />
        ) : lineageMode === "chain" ? (
          <ChainView hops={canonicalRes?.data ?? []} datasetHealth={datasetHealth} />
        ) : (
          <LineageCanvas hops={activeHops} datasetHealth={datasetHealth} />
        )}
      </div>
    </div>
  );
}

function LineageHeader({
  from,
  to,
  onRangeChange,
}: {
  from: string;
  to: string;
  onRangeChange: (from: string, to: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>
          Data Lineage
        </span>
        <span className="font-display font-light italic text-xl" style={{ color: "var(--color-text)" }}>
          Lineage Explorer
        </span>
      </div>
      <DateRangePicker from={from} to={to} onChange={onRangeChange} />
    </div>
  );
}
