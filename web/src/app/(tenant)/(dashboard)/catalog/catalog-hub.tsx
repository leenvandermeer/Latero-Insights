"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, Package, Boxes, Database } from "lucide-react";
import { CatalogOverview } from "./catalog-overview";
import { DataProductList } from "./data-product-list";
import { EntityTab } from "./entity-tab";
import { DatasetTab } from "./dataset-tab";

type Tab = "overview" | "products" | "entities" | "datasets";

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "overview",  label: "Overview", Icon: LayoutDashboard },
  { id: "products",  label: "Data Products", Icon: Package },
  { id: "entities",  label: "Entities",       Icon: Boxes },
  { id: "datasets",  label: "Datasets",       Icon: Database },
];

export function CatalogHub() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = useMemo<Tab>(() => {
    const value = searchParams.get("tab");
    return value === "products" || value === "entities" || value === "datasets" ? value : "overview";
  }, [searchParams]);
  const entityQuery = searchParams.get("entity_q") ?? "";
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
    <div className="flex flex-col h-full" style={{ padding: "var(--spacing-page, 24px)" }}>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>Catalog</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          Data products, entities, and datasets
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "var(--color-border)" }}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => updateParams({ tab: id })}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors"
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

      {/* Content */}
      <div className="flex-1 min-h-0">
        {tab === "overview" && (
          <CatalogOverview
            onOpenTab={(nextTab) => updateParams({ tab: nextTab })}
            onOpenEntitiesWithFilter={(query) => updateParams({ tab: "entities", entity_q: query })}
          />
        )}
        {tab === "products"  && <DataProductList />}
        {tab === "entities"  && (
          <EntityTab
            q={entityQuery}
            onChangeQ={(value) => updateParams({ tab: "entities", entity_q: value || null })}
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
