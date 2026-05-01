"use client";

import { useEffect, useMemo, useState } from "react";
import { useLineage, useDateRange } from "@/hooks";
import {
  PageHeader,
  DateRangePicker,
  SourceIndicator,
  ErrorMessage,
  EmptyState,
} from "@/components/ui";
import { isNoDataError } from "@/lib/api";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { RunEventCard } from "./run-event-card";
import { JsonDrawer } from "./json-drawer";
import { SearchableSelect } from "@/app/(dashboard)/lineage/searchable-select";
import { Network, Search } from "lucide-react";
import type { LineageHop } from "@/lib/adapters/types";
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

function buildJobName(datasetId: string, step: string): string {
  return `${datasetId}.${step}`;
}

const STEP_LAYER_LABELS: Record<string, string> = {
  landing: "Landing",
  raw: "Raw",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

const STEP_LAYER_ORDER = ["landing", "raw", "bronze", "silver", "gold"];

function stepToLayer(step: string): string {
  const normalized = step.toLowerCase();
  if (normalized.includes("to_gold") || normalized === "gold") return "gold";
  if (normalized.includes("to_silver") || normalized === "silver") return "silver";
  if (normalized.includes("to_bronze") || normalized === "bronze") return "bronze";
  if (normalized.includes("to_raw") || normalized === "raw") return "raw";
  if (normalized.includes("landing")) return "landing";
  return normalized;
}

export function OpenLineageDashboard() {
  const { from, to, setRange } = useDateRange();
  const { data: response, isLoading, error, refetch } = useLineage(from, to);
  const [selectedEvent, setSelectedEvent] = useState<RunEvent | null>(null);
  const [search, setSearch] = useState("");
  const [datasetFilter, setDatasetFilter] = useState("all");
  const [stepFilter, setStepFilter] = useState("all");

  const hops = response?.data ?? [];
  const dataFlowHopCount = useMemo(() => hops.filter(isDataFlowHop).length, [hops]);
  const contextHopCount = useMemo(() => hops.filter(isContextHop).length, [hops]);

  const runEvents = useMemo(() => {
    const byRun = new Map<string, RunEvent>();

    for (const hop of hops) {
      if (!byRun.has(hop.run_id)) {
        byRun.set(hop.run_id, {
          run_id: hop.run_id,
          job_name: buildJobName(hop.dataset_id, hop.step),
          dataset_id: hop.dataset_id,
          step: hop.step,
          layer: stepToLayer(hop.step),
          timestamp: hop.timestamp_utc,
          hops: [],
        });
      }
      byRun.get(hop.run_id)!.hops.push(hop);
    }

    return Array.from(byRun.values()).sort(
      (a, b) => b.timestamp.localeCompare(a.timestamp)
    );
  }, [hops]);

  const datasets = useMemo(() => [...new Set(runEvents.map(e => e.dataset_id))].sort(), [runEvents]);
  const layers = useMemo(() => {
    const present = new Set(runEvents.map(e => e.layer));
    return [
      ...STEP_LAYER_ORDER.filter(layer => present.has(layer)),
      ...[...present].filter(layer => !STEP_LAYER_ORDER.includes(layer)).sort(),
    ];
  }, [runEvents]);

  useEffect(() => {
    if (stepFilter !== "all" && !layers.includes(stepFilter)) {
      setStepFilter("all");
    }
  }, [layers, stepFilter]);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return runEvents.filter(e => {
      if (datasetFilter !== "all" && e.dataset_id !== datasetFilter) return false;
      if (stepFilter !== "all" && e.layer !== stepFilter) return false;
      if (q && !e.job_name.toLowerCase().includes(q) && !e.run_id.toLowerCase().includes(q) && !e.dataset_id.toLowerCase().includes(q) && !e.step.toLowerCase().includes(q) && !e.layer.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [runEvents, datasetFilter, stepFilter, search]);

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="OpenLineage" icon={Network} actions={<DateRangePicker from={from} to={to} onChange={setRange} />} />
        {isNoDataError(error)
          ? <EmptyState from={from} to={to} onRetry={() => refetch()} />
          : <ErrorMessage message={error.message} onRetry={() => refetch()} />
        }
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="OpenLineage"
        icon={Network}
        actions={
          <div className="flex items-center gap-1.5">
            {response && <SourceIndicator source={response.source} cachedAt={response.cachedAt} />}
            <DateRangePicker from={from} to={to} onChange={setRange} />
          </div>
        }
      />

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
        >
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
          <input
            type="text"
            placeholder="Search job name, run ID, dataset, step..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-52"
            style={{ color: "var(--color-text)", caretColor: "var(--color-accent)" }}
          />
        </div>
        <SearchableSelect
          value={datasetFilter}
          options={datasets}
          allLabel="All datasets"
          placeholder="Search dataset…"
          onChange={v => { setDatasetFilter(v); setStepFilter("all"); }}
          style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, color: "var(--color-text)" }}
        />
        <SearchableSelect
          value={stepFilter}
          options={layers}
          labels={STEP_LAYER_LABELS}
          allLabel="All layers"
          placeholder="Search layer…"
          onChange={setStepFilter}
          style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, color: "var(--color-text)" }}
        />
      </div>

      <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        {filteredEvents.length}{filteredEvents.length !== runEvents.length ? ` of ${runEvents.length}` : ""} run event{filteredEvents.length !== 1 ? "s" : ""}
        {" · "}{dataFlowHopCount} data flow hop{dataFlowHopCount !== 1 ? "s" : ""}
        {contextHopCount > 0 ? ` · ${contextHopCount} context` : ""}
        {(datasetFilter !== "all" || stepFilter !== "all" || search) && (
          <button
            onClick={() => { setSearch(""); setDatasetFilter("all"); setStepFilter("all"); }}
            className="ml-3 text-xs font-medium"
            style={{ color: "var(--color-accent)" }}
          >
            Clear filters
          </button>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : filteredEvents.length === 0 ? (
        <div className="flex items-center justify-center h-48 rounded-xl" style={{ border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-text-muted)" }}>
          {runEvents.length === 0 ? "No lineage events found for this date range" : "No events match the current filters"}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((event) => (
            <RunEventCard
              key={event.run_id}
              event={event}
              onViewJson={() => setSelectedEvent(event)}
            />
          ))}
        </div>
      )}

      {selectedEvent && (
        <JsonDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}
