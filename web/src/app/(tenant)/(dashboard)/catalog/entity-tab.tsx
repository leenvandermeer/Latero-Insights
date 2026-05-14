"use client";

import { useDeferredValue } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Search } from "lucide-react";
import { useEntities } from "@/hooks/use-entities";

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

// ── Status style ──────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: "var(--color-success)",
  FAILED:  "var(--color-error)",
  WARNING: "var(--color-warning)",
  RUNNING: "var(--color-brand)",
  UNKNOWN: "var(--color-text-muted)",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface LayerStatus {
  layer: string;
  latest_status: string;
  latest_run_at?: string;
}

interface Entity {
  entity_id: string;
  display_name: string;
  data_product_id: string | null;
  source_system: string | null;
  owner: string | null;
  health_status: string;
  latest_run_at: string | null;
  layer_statuses: LayerStatus[];
}

// ── Card row ──────────────────────────────────────────────────────────────────

const LAYER_SEQUENCE = ["landing", "raw", "bronze", "silver", "gold"] as const;

function getHighestLayer(statuses: LayerStatus[]): string | null {
  let best: string | null = null;
  let bestIdx = -1;
  for (const ls of statuses) {
    const idx = LAYER_SEQUENCE.indexOf(ls.layer as typeof LAYER_SEQUENCE[number]);
    if (idx > bestIdx) { bestIdx = idx; best = ls.layer; }
  }
  return best;
}

function EntityCard({ entity, onOpenTrace }: { entity: Entity; onOpenTrace: (entityId: string) => void }) {
  const highestLayer = getHighestLayer(entity.layer_statuses);
  const statusColor = STATUS_COLOR[entity.health_status] ?? "var(--color-text-muted)";

  const runAt = entity.latest_run_at
    ? new Date(entity.latest_run_at).toLocaleString("nl-NL", {
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
        {highestLayer ? (
          <LayerBadge layer={highestLayer} />
        ) : (
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded"
            style={{ background: "var(--color-surface-raised)", color: "var(--color-text-muted)" }}
          >
            —
          </span>
        )}
      </div>

      {/* Name + id */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
          {entity.display_name || entity.entity_id}
        </p>
        <p className="mt-0.5 font-mono text-[10px] truncate" style={{ color: "var(--color-text-muted)" }}>
          {entity.entity_id}
        </p>
        {entity.layer_statuses.length > 1 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {entity.layer_statuses.map((ls) => (
              <LayerBadge key={ls.layer} layer={ls.layer} />
            ))}
          </div>
        )}
      </div>

      {/* Status + time + action */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-xs font-semibold" style={{ color: statusColor }}>
          {entity.health_status}
        </span>
        {runAt && (
          <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
            {runAt}
          </span>
        )}
        <button
          type="button"
          onClick={() => onOpenTrace(entity.entity_id)}
          className="mt-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-brand)" }}
        >
          Open Trace
        </button>
      </div>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LAYERS = ["landing", "raw", "bronze", "silver", "gold"] as const;
const STATUSES = ["SUCCESS", "FAILED", "WARNING", "RUNNING"] as const;

const STATUS_LABEL: Record<string, string> = {
  SUCCESS: "Success",
  FAILED:  "Failed",
  WARNING: "Warning",
  RUNNING: "Running",
};

// ── Tab ───────────────────────────────────────────────────────────────────────

export function EntityTab({
  q,
  layer,
  status,
  onChangeQ,
  onChangeLayer,
  onChangeStatus,
}: {
  q: string;
  layer: string;
  status: string;
  onChangeQ: (value: string) => void;
  onChangeLayer: (value: string) => void;
  onChangeStatus: (value: string) => void;
}) {
  const router = useRouter();
  const deferredQ = useDeferredValue(q);
  const { data, isLoading, isError } = useEntities({
    q: deferredQ || undefined,
    layer: layer || undefined,
    status: status || undefined,
  });
  const entities = (data?.data ?? []) as Entity[];

  function FilterPill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
    return (
      <button
        onClick={onClick}
        className="px-2.5 py-1 rounded text-xs font-medium capitalize"
        style={{
          background: active ? "var(--color-brand)" : "var(--color-surface)",
          color: active ? "white" : "var(--color-text-muted)",
          border: active ? "none" : "1px solid var(--color-border)",
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-col gap-3">
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
              placeholder="Search entities…"
              className="text-sm bg-transparent outline-none w-full"
              style={{ color: "var(--color-text)" }}
            />
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <FilterPill active={layer === ""} label="All layers" onClick={() => onChangeLayer("")} />
            {LAYERS.map((l) => (
              <FilterPill key={l} active={layer === l} label={l} onClick={() => onChangeLayer(layer === l ? "" : l)} />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <FilterPill active={status === ""} label="All statuses" onClick={() => onChangeStatus("")} />
          {STATUSES.map((s) => (
            <FilterPill key={s} active={status === s} label={STATUS_LABEL[s] ?? s} onClick={() => onChangeStatus(status === s ? "" : s)} />
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
          Failed to load entities.
        </p>
      )}

      {!isLoading && !isError && entities.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16">
          <Boxes className="h-10 w-10 opacity-20" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {q || layer || status ? "No entities match your filters." : "No entities registered yet."}
          </p>
        </div>
      )}

      {!isLoading && !isError && entities.length > 0 && (
        <div className="flex flex-col gap-2">
          {entities.map((e) => (
            <EntityCard
              key={e.entity_id}
              entity={e}
              onOpenTrace={(entityId) => router.push(`/lineage?entity_fqn=${encodeURIComponent(entityId)}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
