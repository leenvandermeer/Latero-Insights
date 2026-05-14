"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Boxes, Database } from "lucide-react";
import { EntityTab } from "./entity-tab";
import { DatasetTab } from "./dataset-tab";
import { useEntities } from "@/hooks/use-entities";
import { useDatasets } from "@/hooks/use-datasets";
import { useEstateHealth } from "@/hooks/use-data-products";

type Tab = "entities" | "datasets";

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "entities", label: "Entities", Icon: Boxes },
  { id: "datasets", label: "Datasets", Icon: Database },
];

type EstateHealth = {
  entity_count: number;
  dq_pass_rate: number | null;
};

function EstateSummary() {
  const { data: estateData } = useEstateHealth();
  const { data: entitiesData } = useEntities();
  const { data: datasetsData } = useDatasets();

  const estate = (estateData?.data ?? null) as EstateHealth | null;
  const entityCount = estate?.entity_count ?? (entitiesData?.data as unknown[])?.length ?? 0;
  const datasetCount = (datasetsData?.data as unknown[])?.length ?? 0;
  const dqRate = estate?.dq_pass_rate;

  return (
    <div
      className="grid grid-cols-3 gap-px mb-6 rounded-xl overflow-hidden"
      style={{ background: "var(--color-border)" }}
    >
      {[
        {
          label: "Entities",
          value: entityCount,
          hint: "Business entities in scope",
        },
        {
          label: "Datasets",
          value: datasetCount,
          hint: "Datasets across all layers",
        },
        {
          label: "DQ pass rate",
          value: dqRate != null ? `${dqRate}%` : "—",
          hint: "Last 30 days",
          color:
            dqRate == null
              ? "var(--color-text)"
              : dqRate >= 90
              ? "var(--color-success)"
              : dqRate >= 70
              ? "var(--color-warning)"
              : "var(--color-error)",
        },
      ].map(({ label, value, hint, color }) => (
        <div
          key={label}
          className="px-5 py-4"
          style={{ background: "var(--color-surface)" }}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            {label}
          </p>
          <p
            className="mt-2 text-2xl font-semibold"
            style={{ color: color ?? "var(--color-text)" }}
          >
            {value}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            {hint}
          </p>
        </div>
      ))}
    </div>
  );
}

export function CatalogHub() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = useMemo<Tab>(() => {
    const value = searchParams.get("tab");
    return value === "datasets" ? "datasets" : "entities";
  }, [searchParams]);

  const entityQuery  = searchParams.get("entity_q")      ?? "";
  const entityLayer  = searchParams.get("entity_layer")  ?? "";
  const entityStatus = searchParams.get("entity_status") ?? "";
  const datasetQuery = searchParams.get("dataset_q")     ?? "";
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
      <EstateSummary />

      {/* Tabs */}
      <div className="mb-5 overflow-x-auto border-b" style={{ borderColor: "var(--color-border)" }}>
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
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === "entities" && (
          <EntityTab
            q={entityQuery}
            layer={entityLayer}
            status={entityStatus}
            onChangeQ={(v) => updateParams({ tab: "entities", entity_q: v || null })}
            onChangeLayer={(v) => updateParams({ tab: "entities", entity_layer: v || null })}
            onChangeStatus={(v) => updateParams({ tab: "entities", entity_status: v || null })}
          />
        )}
        {tab === "datasets" && (
          <DatasetTab
            q={datasetQuery}
            layer={datasetLayer}
            onChangeQ={(v) => updateParams({ tab: "datasets", dataset_q: v || null })}
            onChangeLayer={(v) => updateParams({ tab: "datasets", dataset_layer: v || null })}
          />
        )}
      </div>
    </div>
  );
}
