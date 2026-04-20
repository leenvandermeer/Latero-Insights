"use client";

import { useState } from "react";
import { useLineageEntities, useLineageAttributes } from "@/hooks";
import { SourceIndicator, ErrorMessage, EmptyState } from "@/components/ui";
import { Skeleton } from "@/components/ui/loading-skeleton";
import { isNoDataError } from "@/lib/api";
import { GraphView } from "./graph-view";
import { ChainsView } from "./chains-view";
import { ColumnsView } from "./columns-view";
import { GitFork, Link2, Columns3 } from "lucide-react";

type Tab = "graph" | "chains" | "columns";

const TABS: { id: Tab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "graph",   label: "Graph",   Icon: GitFork },
  { id: "chains",  label: "Chains",  Icon: Link2 },
  { id: "columns", label: "Columns", Icon: Columns3 },
];

export function LineageDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("graph");

  const {
    data: entitiesRes,
    isLoading: entitiesLoading,
    error: entitiesError,
    refetch: refetchEntities,
  } = useLineageEntities();

  const {
    data: attributesRes,
    isLoading: attributesLoading,
  } = useLineageAttributes();

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
          <span
            className="font-display font-light italic text-xl leading-none"
            style={{ color: "var(--color-text)" }}
          >
            Lineage Explorer
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {entitiesRes && (
            <SourceIndicator source={entitiesRes.source} cachedAt={entitiesRes.cachedAt} />
          )}
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
        ) : activeTab === "graph" ? (
          <GraphView entities={entities} attributes={attributes} refreshedAt={refreshedAt} />
        ) : activeTab === "chains" ? (
          <ChainsView entities={entities} />
        ) : (
          <ColumnsView attributes={attributes} />
        )}
      </div>
    </div>
  );
}
