"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useLineageEntities, useLineageAttributes } from "@/hooks";
import { ErrorMessage } from "@/components/ui";
import { Skeleton } from "@/components/ui/loading-skeleton";
import { isNoDataError } from "@/lib/api";
import { TraceView } from "./trace-view";
import { ColumnsView } from "./columns-view";
import { LineageOverview } from "./overview-view";
import type { LineageEntity } from "@/lib/adapters/types";
import { Columns3, LayoutDashboard, RefreshCw, Loader2, GitBranch, Download, Settings, Route } from "lucide-react";

type Tab = "overview" | "trace" | "columns";
type TraceDirection = "upstream" | "downstream" | "both";

interface TraceRequest {
  anchorKey?: string | null;
  direction?: TraceDirection;
  depth?: number;
}

const TABS: { id: Tab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "trace", label: "Advanced Trace", Icon: Route },
  { id: "columns", label: "Column mappings", Icon: Columns3 },
];

function downloadEntitiesAsJSON(entities: LineageEntity[]) {
  const payload = { generated_at: new Date().toISOString(), format: "latero-lineage-v2", entities };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lineage-export-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function LineageDashboard() {
  const searchParams = useSearchParams();
  const initialGuid = searchParams.get("guid") ?? undefined;
  const initialEntityFqn = searchParams.get("entity_fqn") ?? undefined;

  const [activeTab, setActiveTab] = useState<Tab>((initialGuid || initialEntityFqn) ? "trace" : "overview");
  const [columnsSearch, setColumnsSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [traceRequest, setTraceRequest] = useState<TraceRequest | null>(null);

  useEffect(() => {
    if (initialGuid || initialEntityFqn) setActiveTab("trace");
  }, [initialGuid, initialEntityFqn]);

  const {
    data: entitiesRes,
    isLoading: entitiesLoading,
    error: entitiesError,
    refetch: refetchEntities,
  } = useLineageEntities();

  const {
    data: attributesRes,
    isLoading: attributesLoading,
    refetch: refetchAttributes,
  } = useLineageAttributes();

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchEntities(), refetchAttributes()]);
    } finally {
      setRefreshing(false);
    }
  };

  const entities = entitiesRes?.data ?? [];
  const attributes = attributesRes?.data ?? [];
  const currentAttributeCount = attributes.filter((attribute) => attribute.is_current).length;

  const isLoading = entitiesLoading || (activeTab === "columns" && attributesLoading);

  const refreshedAt = entitiesRes?.cachedAt
    ?? entities
        .map((e) => e.latest_success_at)
        .filter(Boolean)
        .sort()
        .reverse()[0]
    ?? undefined;

  const modeSummary = activeTab === "overview"
    ? "Overview shows the current state of all entities, chains, and layer coverage."
    : activeTab === "trace"
      ? "Advanced Trace investigates one path with direction, depth, and layer controls."
      : "Column mappings show attribute-level evidence for the path you are inspecting.";

  if (entitiesError) {
    return (
      <div className="page-content flex flex-col gap-4 pt-3">
        <div
          className="flex min-h-[420px] items-center justify-center rounded-xl border p-6"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          {isNoDataError(entitiesError)
            ? (
              <div
                className="flex max-w-md flex-col items-center gap-4 text-center"
              >
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-xl"
                  style={{ background: "rgba(128,128,128,0.08)", color: "var(--color-text-muted)" }}
                >
                  <GitBranch className="h-6 w-6" />
                </div>
                <div className="space-y-1.5">
                  <p className="font-semibold text-base" style={{ color: "var(--color-text)" }}>No lineage data available</p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                    No lineage data was found for this workspace. Make sure your Databricks connection is configured and a sync has been run.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => refetchEntities()}
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all hover:-translate-y-px"
                    style={{ background: "var(--color-brand, #1B3B6B)", color: "#fff" }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </button>
                  <a
                    href="/settings"
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all hover:-translate-y-px"
                    style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Settings
                  </a>
                </div>
              </div>
            )
            : <ErrorMessage message={(entitiesError as Error).message} onRetry={() => refetchEntities()} />
          }
        </div>
      </div>
    );
  }

  return (
    <div className="page-content flex min-h-[calc(100dvh-120px)] flex-col gap-4 pt-3">
      {/* Content shell */}
      <div
        className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        {/* Tab bar */}
        <div
          className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-2"
          style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: activeTab === id ? "var(--color-accent)" : "transparent",
                  color: activeTab === id ? "#fff" : "var(--color-text-muted)",
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {id === "columns" && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      background: activeTab === id
                        ? "rgba(255,255,255,0.18)"
                        : currentAttributeCount > 0
                          ? "rgba(16,185,129,0.12)"
                          : "rgba(245,158,11,0.12)",
                      color: activeTab === id
                        ? "#fff"
                        : currentAttributeCount > 0
                          ? "#047857"
                          : "#B45309",
                    }}
                  >
                    {currentAttributeCount > 0 ? currentAttributeCount : "0"}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => downloadEntitiesAsJSON(entities)}
              disabled={entities.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all hover:-translate-y-0.5 disabled:opacity-40"
              style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)", background: "var(--color-surface)" }}
              title="Download lineage data as JSON"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing || entitiesLoading}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all hover:-translate-y-0.5 disabled:opacity-40"
              style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)", background: "var(--color-surface)" }}
            >
              {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Inner content */}
        <div className="flex flex-1 min-h-0 flex-col">
        <div
          className="border-b px-4 py-2 text-xs"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)", background: "var(--color-surface)" }}
        >
          {modeSummary}
        </div>
        {isLoading ? (
          <Skeleton className="w-full h-full" />
        ) : activeTab === "overview" ? (
          <LineageOverview
            entities={entities}
            attributes={attributes}
            refreshedAt={refreshedAt}
            onOpenTab={setActiveTab}
            onOpenTrace={(anchorKey, options) => {
              setTraceRequest({
                anchorKey,
                direction: options?.direction,
                depth: options?.depth,
              });
              setActiveTab("trace");
            }}
          />
        ) : activeTab === "trace" ? (
          <TraceView
            entities={entities}
            attributes={attributes}
            initialGuid={initialGuid}
            initialEntityFqn={initialEntityFqn}
            request={traceRequest}
            onOpenColumns={(query) => {
              setColumnsSearch(query ?? "");
              setActiveTab("columns");
            }}
          />
        ) : (
          <ColumnsView
            attributes={attributes}
            entities={entities}
            initialSearch={columnsSearch}
            onOpenTrace={() => setActiveTab("trace")}
          />
        )}
      </div>
      </div>
    </div>
  );
}
