"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  CheckCircle2,
  GitBranch,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import { useEntityDetail, useEntityRuns, useEntityQuality } from "@/hooks/use-entities";
import { useDataProduct } from "@/hooks/use-data-products";
import { OverviewTab } from "./overview-tab";

// Tab types
type TabId = "overview" | "health" | "quality" | "lineage" | "issues";

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "health", label: "Health", Icon: Activity },
  { id: "quality", label: "Quality", Icon: CheckCircle2 },
  { id: "lineage", label: "Lineage", Icon: GitBranch },
  { id: "issues", label: "Issues", Icon: AlertTriangle },
];

// ── Main Hub Component ────────────────────────────────────────────────────────

interface EntityDetailHubProps {
  entityFqn: string;
}

export function EntityDetailHub({ entityFqn }: EntityDetailHubProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = useMemo<TabId>(() => {
    const value = searchParams.get("tab");
    const validTabs: TabId[] = ["overview", "health", "quality", "lineage", "issues"];
    return validTabs.includes(value as TabId) ? (value as TabId) : "overview";
  }, [searchParams]);

  const updateTab = (newTab: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Fetch entity data
  const { data: entityData, isLoading: entityLoading } = useEntityDetail(entityFqn);
  const { data: runsData, isLoading: runsLoading } = useEntityRuns(entityFqn, 20);
  const { data: qualityData, isLoading: qualityLoading } = useEntityQuality(entityFqn, 7);

  // Extract data from API responses
  const entity = entityData?.data as Record<string, unknown> | undefined;
  const runs = (runsData?.data ?? []) as Array<Record<string, unknown>>;

  // Fetch linked product if applicable
  const linkedProductId = entity?.product_id as string | undefined;
  const { data: productData } = useDataProduct(linkedProductId ?? "");
  const product = productData?.data as Record<string, unknown> | undefined;

  const isLoading = entityLoading || runsLoading || qualityLoading;

  // Calculate quick stats
  const successRate = useMemo(() => {
    if (!runs.length) return null;
    const successful = runs.filter((r) => r.status === "SUCCESS").length;
    return Math.round((successful / runs.length) * 100);
  }, [runs]);

  const lastRun = runs[0];
  const openIssuesCount = 0; // TODO: Fetch from incidents API

  return (
    <div className="flex h-full flex-col page-content">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => router.push("/catalog")}
          className="p-2 rounded-lg hover:bg-black/5 transition-colors"
          aria-label="Back to catalog"
        >
          <ArrowLeft className="h-5 w-5" style={{ color: "var(--color-text-muted)" }} />
        </button>
        <div className="flex-1 min-w-0">
          <h1
            className="text-xl font-bold truncate mb-1"
            style={{ color: "var(--color-text)" }}
          >
            {(entity?.display_name as string) ?? entityFqn}
          </h1>
          {linkedProductId && product && (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Part of{" "}
              <a
                href={`/products/${linkedProductId}`}
                className="underline hover:no-underline"
                style={{ color: "var(--color-brand)" }}
              >
                {(product.display_name as string) ?? linkedProductId}
              </a>
            </p>
          )}
        </div>

        {/* Quick stats chips */}
        <div className="flex gap-2 flex-shrink-0">
          {successRate !== null && (
            <div
              className="rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{
                background:
                  successRate >= 95
                    ? "rgba(16,185,129,0.12)"
                    : successRate >= 80
                    ? "rgba(245,158,11,0.12)"
                    : "rgba(239,68,68,0.12)",
                color:
                  successRate >= 95
                    ? "#059669"
                    : successRate >= 80
                    ? "#d97706"
                    : "#dc2626",
              }}
            >
              {successRate}% success
            </div>
          )}
          {openIssuesCount > 0 && (
            <div
              className="rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
              style={{ background: "rgba(239,68,68,0.12)", color: "#dc2626" }}
            >
              <AlertTriangle className="h-3 w-3" />
              {openIssuesCount} issues
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        className="mb-6 overflow-x-auto border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex min-w-max gap-1">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => updateTab(id)}
              className="flex min-h-[var(--touch-target-min)] items-center gap-2 px-3 py-2 text-sm font-medium transition-colors"
              style={{
                color: tab === id ? "var(--color-brand)" : "var(--color-text-muted)",
                borderBottom:
                  tab === id ? "2px solid var(--color-brand)" : "2px solid transparent",
                background: "transparent",
                marginBottom: "-1px",
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading && (
          <div
            className="flex items-center justify-center py-12 text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            Loading...
          </div>
        )}

        {!isLoading && tab === "overview" && (
          <OverviewTab
            entity={entity}
            product={product}
            runs={runs}
            successRate={successRate}
            lastRun={lastRun}
            openIssuesCount={openIssuesCount}
          />
        )}

        {!isLoading && tab === "health" && (
          <HealthTab entity={entity} runs={runs} />
        )}

        {!isLoading && tab === "quality" && (
          <QualityTab entityFqn={entityFqn} qualityData={qualityData} />
        )}

        {!isLoading && tab === "lineage" && (
          <LineageTab entityFqn={entityFqn} />
        )}

        {!isLoading && tab === "issues" && (
          <IssuesTab entityFqn={entityFqn} productId={linkedProductId} />
        )}
      </div>
    </div>
  );
}

// ── Tab Components (Placeholders - will be implemented) ──────────────────────

function HealthTab({ entity, runs }: any) {
  return (
    <div className="space-y-4">
      <div
        className="rounded-xl p-6"
        style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text)" }}>
          Health
        </h2>
        <p style={{ color: "var(--color-text-muted)" }}>
          Layer status, recent runs, and operational metrics will be shown here.
        </p>
      </div>
    </div>
  );
}

function QualityTab({ entityFqn, qualityData }: any) {
  return (
    <div className="space-y-4">
      <div
        className="rounded-xl p-6"
        style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text)" }}>
          Quality
        </h2>
        <p style={{ color: "var(--color-text-muted)" }}>
          Data quality checks, pass rates, and trends will be shown here.
        </p>
      </div>
    </div>
  );
}

function LineageTab({ entityFqn }: any) {
  return (
    <div className="space-y-4">
      <div
        className="rounded-xl p-6"
        style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text)" }}>
          Lineage
        </h2>
        <p style={{ color: "var(--color-text-muted)" }}>
          Dependency graph and impact analysis will be shown here.
        </p>
      </div>
    </div>
  );
}

function IssuesTab({ entityFqn, productId }: any) {
  return (
    <div className="space-y-4">
      <div
        className="rounded-xl p-6"
        style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text)" }}>
          Issues
        </h2>
        <p style={{ color: "var(--color-text-muted)" }}>
          Open incidents, policy exceptions, and SLA breaches will be shown here.
        </p>
      </div>
    </div>
  );
}
