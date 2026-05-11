"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, Boxes, Database } from "lucide-react";
import { CatalogOverview } from "./catalog-overview";
import { EntityTab } from "./entity-tab";
import { DatasetTab } from "./dataset-tab";

type Tab = "overview" | "entities" | "datasets";

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "overview",  label: "Overview",  Icon: LayoutDashboard },
  { id: "datasets",  label: "Datasets",  Icon: Database },
  { id: "entities",  label: "Entities",  Icon: Boxes },
];

export function CatalogHub() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = useMemo<Tab>(() => {
    const value = searchParams.get("tab");
    return value === "entities" || value === "datasets" ? value : "overview";
  }, [searchParams]);
  const entityQuery = searchParams.get("entity_q") ?? "";
  const entityLayer = searchParams.get("entity_layer") ?? "";
  const entityStatus = searchParams.get("entity_status") ?? "";
  const datasetQuery = searchParams.get("dataset_q") ?? "";
  const datasetLayer = searchParams.get("dataset_layer") ?? "";

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="flex h-full flex-col page-content">
      {/* Tabs */}
      <div className="mb-6 overflow-x-auto border-b pt-3" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex min-w-max gap-1">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => updateParams({ tab: id })}
              className="flex min-h-[var(--touch-target-min)] items-center gap-2 px-3 py-2 text-sm font-medium transition-colors"
              style={{
                color: tab === id ? "var(--color-brand)" : "var(--color-text-muted)",
                borderBottom: tab === id ? "2px solid var(--color-brand)" : "2px solid transparent",
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

      {/* Content */}
      <div className="flex-1 min-h-0">
        {tab === "overview" && (
          <CatalogOverview
            onOpenTab={(nextTab) => updateParams({ tab: nextTab })}
            onOpenEntitiesWithFilter={(query) => updateParams({ tab: "entities", entity_q: query })}
          />
        )}
        {tab === "entities"  && (
          <EntityTab
            q={entityQuery}
            layer={entityLayer}
            status={entityStatus}
            onChangeQ={(value) => updateParams({ tab: "entities", entity_q: value || null })}
            onChangeLayer={(value) => updateParams({ tab: "entities", entity_layer: value || null })}
            onChangeStatus={(value) => updateParams({ tab: "entities", entity_status: value || null })}
          />
        )}
        {tab === "datasets"  && (
          <DatasetTab
            q={datasetQuery}
            layer={datasetLayer}
            onChangeQ={(value) => updateParams({ tab: "datasets", dataset_q: value || null })}
            onChangeLayer={(value) => updateParams({ tab: "datasets", dataset_layer: value || null })}
          />
        )}
      </div>
    </div>
  );
}
