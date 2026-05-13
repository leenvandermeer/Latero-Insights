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
  const c = LAYER_COLORS[layer] ?? { bg: "var(--color-surface)", text: "var(--color-text-muted)" };
  return (
    <span
      className="text-[10px] font-mono px-2 py-0.5 rounded capitalize"
      style={{ background: c.bg, color: c.text }}
    >
      {layer}
    </span>
  );
}

// ── Status dot ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: "var(--color-success)",
  FAILED:  "var(--color-error)",
  WARNING: "var(--color-warning)",
  RUNNING: "var(--color-brand)",
};

function StatusDot({ status }: { status: string | null }) {
  const color = STATUS_COLOR[status ?? ""] ?? "var(--color-text-muted)";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs"
      style={{ color: "var(--color-text-muted)" }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: status ? color : "var(--color-border)" }}
      />
      {status ?? "—"}
    </span>
  );
}

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

// ── Row ───────────────────────────────────────────────────────────────────────

function DatasetRow({
  dataset,
  onOpenTrace,
}: {
  dataset: Dataset;
  onOpenTrace?: (entityId: string) => void;
}) {
  const updatedAgo = (() => {
    if (!dataset.latest_run_at) return null;
    const diff = Date.now() - new Date(dataset.latest_run_at).getTime();
    const d = Math.floor(diff / 86400000);
    if (d === 0) return "today";
    if (d === 1) return "yesterday";
    return `${d}d ago`;
  })();

  return (
    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
      <td className="py-2.5 pr-4">
        <div>
          <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
            {dataset.object_name}
          </span>
          {dataset.namespace && (
            <span className="block font-mono text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              {dataset.namespace}
            </span>
          )}
        </div>
      </td>
      <td className="py-2.5 pr-4">
        <LayerBadge layer={dataset.layer} />
      </td>
      <td className="py-2.5 pr-4">
        <StatusDot status={dataset.latest_run_status} />
      </td>
      <td className="py-2.5 pr-4 text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
        {dataset.entity_id ?? "—"}
      </td>
      <td className="py-2.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
        {updatedAgo ?? "—"}
      </td>
      <td className="py-2.5 text-right">
        <button
          type="button"
          disabled={!dataset.entity_id || !onOpenTrace}
          onClick={() => dataset.entity_id && onOpenTrace?.(dataset.entity_id)}
          className="rounded-lg px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-brand)" }}
        >
          Open Trace
        </button>
      </td>
    </tr>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

const LAYERS = ["landing", "raw", "bronze"] as const;

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

        <div className="flex items-center gap-1">
          <button
            onClick={() => onChangeLayer("")}
            className="px-2.5 py-1 rounded text-xs font-medium"
            style={{
              background: layer === "" ? "var(--color-brand)" : "var(--color-surface)",
              color: layer === "" ? "white" : "var(--color-text-muted)",
              border: layer === "" ? "none" : "1px solid var(--color-border)",
            }}
          >
            All
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
            <div
              key={i}
              className="rounded-lg h-12 animate-pulse"
              style={{ background: "var(--color-surface)" }}
            />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm py-8 text-center" style={{ color: "#ef4444" }}>
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
        <div style={{ overflowX: "auto" }}>
          <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                {["Dataset", "Layer", "Status", "Entity", "Last run", ""].map((h) => (
                  <th
                    key={h}
                    className="pb-2 text-xs font-semibold pr-4"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => (
                <DatasetRow
                  key={`${d.dataset_id}-${d.layer}`}
                  dataset={d}
                  onOpenTrace={(entityId) => router.push(`/lineage?entity_fqn=${encodeURIComponent(entityId)}`)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
