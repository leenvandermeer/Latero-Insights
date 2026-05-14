"use client";

import { useDeferredValue } from "react";
import { useRouter } from "next/navigation";
import { Database, Search } from "lucide-react";
import { useDatasets } from "@/hooks/use-datasets";

// ── Layer badge ───────────────────────────────────────────────────────────────

const LAYER_COLORS: Record<string, { bg: string; text: string }> = {
  landing: { bg: "var(--color-surface-raised)",  text: "var(--color-text-muted)" },
  raw:     { bg: "var(--color-brand-subtle)",     text: "var(--color-brand)" },
  bronze:  { bg: "var(--color-accent-subtle)",    text: "var(--color-accent)" },
  silver:  { bg: "var(--color-brand-subtle)",     text: "var(--color-brand-light)" },
  gold:    { bg: "var(--color-warning-subtle)",   text: "var(--color-warning)" },
};

function LayerBadge({ layer }: { layer: string }) {
  const c = LAYER_COLORS[layer] ?? { bg: "var(--color-surface-raised)", text: "var(--color-text-muted)" };
  return (
    <span
      className="text-[10px] font-mono px-2 py-0.5 rounded capitalize flex-shrink-0"
      style={{ background: c.bg, color: c.text }}
    >
      {layer}
    </span>
  );
}

// ── Status color ──────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: "var(--color-success)",
  FAILED:  "var(--color-error)",
  WARNING: "var(--color-warning)",
  RUNNING: "var(--color-brand)",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Dataset {
  dataset_id: string;
  namespace: string | null;
  object_name: string;
  platform: string | null;
  layer: string;
  entity_id: string | null;
  latest_run_status: string | null;
  latest_run_at: string | null;
}

// ── Card row ──────────────────────────────────────────────────────────────────

function DatasetCard({
  dataset,
  onOpenTrace,
}: {
  dataset: Dataset;
  onOpenTrace?: (entityId: string) => void;
}) {
  const statusColor = STATUS_COLOR[dataset.latest_run_status ?? ""] ?? "var(--color-text-muted)";

  const runAt = dataset.latest_run_at
    ? new Date(dataset.latest_run_at).toLocaleString("nl-NL", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      {/* Layer badge */}
      <div className="pt-0.5">
        <LayerBadge layer={dataset.layer} />
      </div>

      {/* Name + namespace */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
          {dataset.object_name}
        </p>
        {dataset.namespace && (
          <p className="mt-0.5 font-mono text-[10px] truncate" style={{ color: "var(--color-text-muted)" }}>
            {dataset.namespace}
          </p>
        )}
        {dataset.entity_id && (
          <p className="mt-0.5 font-mono text-[10px] truncate" style={{ color: "var(--color-text-muted)" }}>
            {dataset.entity_id}
          </p>
        )}
      </div>

      {/* Status + time + action */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span
          className="text-xs font-semibold"
          style={{ color: dataset.latest_run_status ? statusColor : "var(--color-text-muted)" }}
        >
          {dataset.latest_run_status ?? "—"}
        </span>
        {runAt && (
          <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
            {runAt}
          </span>
        )}
        {dataset.entity_id && onOpenTrace && (
          <button
            type="button"
            onClick={() => dataset.entity_id && onOpenTrace(dataset.entity_id)}
            className="mt-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-brand)" }}
          >
            Open Trace
          </button>
        )}
      </div>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LAYERS = ["landing", "raw", "bronze", "silver", "gold"] as const;

// ── Tab ───────────────────────────────────────────────────────────────────────

export function DatasetTab({
  q,
  layer,
  onChangeQ,
  onChangeLayer,
}: {
  q: string;
  layer: string;
  onChangeQ: (value: string) => void;
  onChangeLayer: (value: string) => void;
}) {
  const router = useRouter();
  const deferredQ = useDeferredValue(q);
  const { data, isLoading, isError } = useDatasets({ q: deferredQ || undefined, layer: layer || undefined });
  const datasets = (data?.data ?? []) as Dataset[];

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", maxWidth: 280 }}
        >
          <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
          <input
            type="text"
            value={q}
            onChange={(e) => onChangeQ(e.target.value)}
            placeholder="Search datasets…"
            className="text-sm bg-transparent outline-none w-full"
            style={{ color: "var(--color-text)" }}
          />
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => onChangeLayer("")}
            className="px-2.5 py-1 rounded text-xs font-medium"
            style={{
              background: layer === "" ? "var(--color-brand)" : "var(--color-surface)",
              color: layer === "" ? "white" : "var(--color-text-muted)",
              border: layer === "" ? "none" : "1px solid var(--color-border)",
            }}
          >
            All layers
          </button>
          {LAYERS.map((l) => (
            <button
              key={l}
              onClick={() => onChangeLayer(layer === l ? "" : l)}
              className="px-2.5 py-1 rounded text-xs font-medium capitalize"
              style={{
                background: layer === l ? "var(--color-brand)" : "var(--color-surface)",
                color: layer === l ? "white" : "var(--color-text-muted)",
                border: layer === l ? "none" : "1px solid var(--color-border)",
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl h-16 animate-pulse" style={{ background: "var(--color-surface)" }} />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm py-8 text-center" style={{ color: "var(--color-error)" }}>
          Failed to load datasets.
        </p>
      )}

      {!isLoading && !isError && datasets.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16">
          <Database className="h-10 w-10 opacity-20" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {q || layer ? "No datasets match your filters." : "No datasets registered yet."}
          </p>
        </div>
      )}

      {!isLoading && !isError && datasets.length > 0 && (
        <div className="flex flex-col gap-2">
          {datasets.map((d) => (
            <DatasetCard
              key={`${d.dataset_id}-${d.layer}`}
              dataset={d}
              onOpenTrace={(entityId) => router.push(`/lineage?entity_fqn=${encodeURIComponent(entityId)}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
