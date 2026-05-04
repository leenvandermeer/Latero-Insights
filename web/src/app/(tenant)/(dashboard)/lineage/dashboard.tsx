"use client";

import { useState } from "react";
import { useLineageEntities, useLineageAttributes } from "@/hooks";
import { SourceIndicator, ErrorMessage, PageHeader } from "@/components/ui";
import { Skeleton } from "@/components/ui/loading-skeleton";
import { isNoDataError } from "@/lib/api";
import { GraphView } from "./graph-view";
import { ChainsView } from "./chains-view";
import { ColumnsView } from "./columns-view";
import { LineageOverview } from "./overview-view";
import { GitFork, Link2, Columns3, LayoutDashboard, RefreshCw, Loader2, GitBranch, Settings } from "lucide-react";

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
        <div className="px-6 pt-4 shrink-0">
          <PageHeader title="Lineage" icon={GitBranch} />
        </div>
        <div className="flex-1 p-6 flex items-center justify-center">
          {isNoDataError(entitiesError)
            ? (
              <div
                className="flex flex-col items-center gap-4 rounded-xl border p-10 text-center max-w-md"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
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
                    No lineage data was found for this installation. Make sure your Databricks connection is configured and a sync has been run.
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
    <div
      className="flex flex-col -mx-6 -mt-6"
      style={{ height: "100dvh", paddingTop: "24px" }}
    >
      {/* Header */}
      <div className="px-6 pt-4 shrink-0">
        <PageHeader
          title="Lineage"
          icon={GitBranch}
          actions={
            <div className="flex items-center gap-1.5">
              {entitiesRes && <SourceIndicator source={entitiesRes.source} cachedAt={entitiesRes.cachedAt} />}
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
          }
        />
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
          <ColumnsView attributes={attributes} entities={entities} initialSearch={columnsSearch} />
        )}
      </div>
    </div>
  );
}
