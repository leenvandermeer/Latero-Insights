"use client";

import { useState } from "react";
import { useLineageEntities, useLineageAttributes } from "@/hooks";
import { SourceIndicator, ErrorMessage, EmptyState } from "@/components/ui";
import { Skeleton } from "@/components/ui/loading-skeleton";
import { isNoDataError } from "@/lib/api";
import { GraphView } from "./graph-view";
import { ChainsView } from "./chains-view";
import { ColumnsView } from "./columns-view";
import { LineageOverview } from "./overview-view";
import { GitFork, Link2, Columns3, LayoutDashboard, RefreshCw, Loader2 } from "lucide-react";

type Tab = "overview" | "graph" | "chains" | "columns";

const TABS: { id: Tab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "graph",   label: "Graph",   Icon: GitFork },
  { id: "chains",  label: "Chains",  Icon: Link2 },
  { id: "columns", label: "Columns", Icon: Columns3 },
];

export function LineageDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [columnsSearch, setColumnsSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

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

  const isLoading = entitiesLoading || (activeTab === "columns" && attributesLoading);

  const refreshedAt = entitiesRes?.cachedAt
    ?? entities
        .map((e) => e.latest_success_at)
        .filter(Boolean)
        .sort()
        .reverse()[0]
    ?? undefined;

  if (entitiesError) {
    return (
      <div
        className="flex flex-col -mx-6 -mt-6"
        style={{ height: "100dvh", paddingTop: "24px" }}
      >
        <div
          className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <span className="font-display font-light italic text-xl" style={{ color: "var(--color-text)" }}>
            Lineage Explorer
          </span>
        </div>
        <div className="flex-1 p-6">
          {isNoDataError(entitiesError)
            ? <EmptyState from="" to="" onRetry={() => refetchEntities()} />
            : <ErrorMessage message={(entitiesError as Error).message} onRetry={() => refetchEntities()} />
          }
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col -mx-6 -mt-6"
      style={{ height: "100dvh", paddingTop: "24px" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <span
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest shrink-0"
              style={{ color: "var(--color-accent)", letterSpacing: "0.13em" }}
            >
              <span
                aria-hidden="true"
                style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--color-accent)", flexShrink: 0 }}
              />
              Data Lineage
            </span>
            <div className="space-y-1">
              <span
                className="block font-display font-light italic text-xl leading-none"
                style={{ color: "var(--color-text)" }}
              >
                Lineage Explorer
              </span>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--color-text-muted)" }}
              >
                Explore entity flow, impact paths and column mappings from one shared lineage model.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {entitiesRes && (
            <SourceIndicator source={entitiesRes.source} cachedAt={entitiesRes.cachedAt} />
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing || entitiesLoading}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all hover:-translate-y-0.5 disabled:opacity-40"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)", background: "var(--color-surface)" }}
            title="Refresh lineage data"
          >
            {refreshing
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />}
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="flex items-center gap-1 px-6 py-1.5 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}
      >
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: activeTab === id ? "var(--color-accent)" : "transparent",
              color: activeTab === id ? "#fff" : "var(--color-text-muted)",
            }}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <Skeleton className="w-full h-full" />
        ) : activeTab === "overview" ? (
          <LineageOverview
            entities={entities}
            attributes={attributes}
            refreshedAt={refreshedAt}
            onOpenTab={setActiveTab}
          />
        ) : activeTab === "graph" ? (
          <GraphView
            entities={entities}
            attributes={attributes}
            refreshedAt={refreshedAt}
            onOpenColumns={(query) => {
              setColumnsSearch(query ?? "");
              setActiveTab("columns");
            }}
          />
        ) : activeTab === "chains" ? (
          <ChainsView entities={entities} />
        ) : (
          <ColumnsView attributes={attributes} initialSearch={columnsSearch} />
        )}
      </div>
    </div>
  );
}
