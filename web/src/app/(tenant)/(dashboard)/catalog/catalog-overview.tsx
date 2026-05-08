"use client";

import { AlertTriangle, ArrowRight, Boxes, Database, Package, ShieldCheck } from "lucide-react";
import { useDataProducts, useEstateHealth } from "@/hooks/use-data-products";
import { useEntities } from "@/hooks/use-entities";
import { useDatasets } from "@/hooks/use-datasets";

type CatalogOverviewProps = {
  onOpenTab: (tab: "products" | "entities" | "datasets") => void;
  onOpenEntitiesWithFilter?: (query: string) => void;
};

type EstateHealth = {
  data_product_count: number;
  entity_count: number;
  issue_count: number;
  dq_pass_rate: number | null;
  last_run_at: string | null;
  last_sync_at: string | null;
};

function formatTime(value: string | null | undefined) {
  if (!value) return "No recent activity";
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function SummaryCard({
  label,
  value,
  detail,
  Icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "success" | "warning" | "error";
}) {
  const toneColor = {
    neutral: "var(--color-brand)",
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
  }[tone];

  return (
    <div
      className="rounded-xl px-4 py-4"
      style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold leading-none" style={{ color: "var(--color-text)" }}>
            {value}
          </p>
        </div>
        <span
          className="grid h-9 w-9 place-items-center rounded-lg"
          style={{ background: `${toneColor}1f`, color: toneColor }}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        {detail}
      </p>
    </div>
  );
}

export function CatalogOverview({ onOpenTab, onOpenEntitiesWithFilter }: CatalogOverviewProps) {
  const estateHealth = useEstateHealth();
  const products = useDataProducts();
  const entities = useEntities();
  const datasets = useDatasets();

  const estate = (estateHealth.data?.data ?? null) as EstateHealth | null;
  const productRows = (products.data?.data ?? []) as Array<{
    data_product_id: string;
    display_name: string;
    entity_count: number;
    owner: string | null;
    updated_at: string;
  }>;
  const entityRows = (entities.data?.data ?? []) as Array<{
    entity_id: string;
    display_name: string;
    health_status: string;
  }>;
  const datasetRows = (datasets.data?.data ?? []) as Array<{ layer: string }>;

  const failedEntities = entityRows.filter((entity) => entity.health_status === "FAILED");
  const warningEntities = entityRows.filter((entity) => entity.health_status === "WARNING");

  const layerMix = datasetRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.layer] = (acc[row.layer] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <section
        className="rounded-[20px] px-5 py-5 lg:px-6"
        style={{
          background: "linear-gradient(135deg, rgba(27,59,107,0.08), rgba(200,137,42,0.08))",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>
              Catalog
            </p>
            <h2 className="mt-2 text-lg font-medium leading-snug" style={{ color: "var(--color-text)" }}>
              Open products, entities, or datasets.
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onOpenTab("products")}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
                style={{ background: "var(--color-accent)", color: "#fff" }}
              >
                Open data products
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onOpenTab("entities")}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
                style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                Browse entities
              </button>
              <button
                type="button"
                onClick={() => onOpenTab("datasets")}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
                style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                Browse datasets
              </button>
            </div>
          </div>

          <div
            className="rounded-2xl px-4 py-4"
            style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              Activity
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>Last sync</p>
                <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {formatTime(estate?.last_sync_at)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>Latest run</p>
                <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {formatTime(estate?.last_run_at)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1">
              {Object.entries(layerMix).map(([layer, count]) => (
                <span
                  key={layer}
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
                >
                  {layer} {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Data products"
          value={estate?.data_product_count ?? productRows.length}
          detail="Business-facing groupings."
          Icon={Package}
        />
        <SummaryCard
          label="Entities"
          value={estate?.entity_count ?? entityRows.length}
          detail="Business entities in scope."
          Icon={Boxes}
        />
        <SummaryCard
          label="Datasets"
          value={datasetRows.length}
          detail="Datasets across all layers."
          Icon={Database}
        />
        <SummaryCard
          label="DQ pass rate"
          value={estate?.dq_pass_rate != null ? `${estate.dq_pass_rate}%` : "—"}
          detail={`${estate?.issue_count ?? 0} recent failed checks.`}
          Icon={ShieldCheck}
          tone={estate?.dq_pass_rate == null ? "neutral" : estate.dq_pass_rate >= 90 ? "success" : estate.dq_pass_rate >= 70 ? "warning" : "error"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
        <section
          className="rounded-xl"
          style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Recently maintained products</h3>
            <button
              type="button"
              onClick={() => onOpenTab("products")}
              className="inline-flex items-center gap-1 text-xs font-semibold"
              style={{ color: "var(--color-brand)" }}
            >
              Open products
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {productRows.length === 0 ? (
              <p className="px-4 py-6 text-sm" style={{ color: "var(--color-text-muted)" }}>No data products available yet.</p>
            ) : productRows.slice(0, 5).map((product) => (
              <div key={product.data_product_id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold" style={{ color: "var(--color-text)" }}>{product.display_name}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {product.entity_count} {product.entity_count === 1 ? "entity" : "entities"}{product.owner ? ` · ${product.owner}` : ""}
                  </p>
                </div>
                <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{formatTime(product.updated_at)}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          className="rounded-xl"
          style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Needs attention</h3>
            <button
              type="button"
              onClick={() => onOpenTab("entities")}
              className="inline-flex items-center gap-1 text-xs font-semibold"
              style={{ color: "var(--color-brand)" }}
            >
              Open entities
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {[...failedEntities, ...warningEntities].slice(0, 6).length === 0 ? (
              <div className="flex items-center gap-3 px-4 py-6">
                <ShieldCheck className="h-5 w-5" style={{ color: "#10B981" }} />
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No failed or warning entities detected.</p>
              </div>
            ) : (
              [...failedEntities, ...warningEntities].slice(0, 6).map((entity) => (
                <button
                  key={entity.entity_id}
                  type="button"
                  onClick={() => onOpenEntitiesWithFilter?.(entity.display_name || entity.entity_id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: entity.health_status === "FAILED" ? "#EF4444" : "#F59E0B" }} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                      {entity.display_name || entity.entity_id}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {entity.entity_id} · {entity.health_status.toLowerCase()}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
