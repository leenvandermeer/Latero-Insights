"use client";

import { useDeferredValue } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Search } from "lucide-react";
import { useEntities } from "@/hooks/use-entities";

// ── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  SUCCESS: { bg: "#dcfce7", text: "#15803d" },
  FAILED:  { bg: "#fee2e2", text: "#dc2626" },
  WARNING: { bg: "#fef9c3", text: "#a16207" },
  UNKNOWN: { bg: "var(--color-surface)", text: "var(--color-text-muted)" },
  RUNNING: { bg: "#dbeafe", text: "#1d4ed8" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.UNKNOWN;
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase"
      style={{ background: s.bg, color: s.text }}
    >
      {status}
    </span>
  );
}

// ── Layer pill ────────────────────────────────────────────────────────────────

const LAYER_COLORS: Record<string, { bg: string; text: string }> = {
  landing: { bg: "#f3f4f6", text: "#374151" },
  raw:     { bg: "#e0e7ff", text: "#3730a3" },
  bronze:  { bg: "#fed7aa", text: "#c2410c" },
  silver:  { bg: "#cffafe", text: "#0e7490" },
  gold:    { bg: "#fef9c3", text: "#a16207" },
};

function LayerPill({ layer, status }: { layer: string; status: string }) {
  const c = LAYER_COLORS[layer] ?? { bg: "var(--color-surface)", text: "var(--color-text-muted)" };
  const failed = status === "FAILED";
  const unknown = status === "UNKNOWN";
  return (
    <span
      className="text-[10px] font-mono px-2 py-0.5 rounded capitalize"
      style={{
        background: failed ? "#fee2e2" : unknown ? "var(--color-surface)" : c.bg,
        color: failed ? "#dc2626" : unknown ? "var(--color-text-muted)" : c.text,
        border: unknown ? "1px solid var(--color-border)" : "none",
        opacity: unknown ? 0.6 : 1,
      }}
    >
      {layer}
    </span>
  );
}

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

// ── Row ───────────────────────────────────────────────────────────────────────

function EntityRow({ entity, onOpenTrace }: { entity: Entity; onOpenTrace: (entityId: string) => void }) {
  const updatedAgo = (() => {
    if (!entity.latest_run_at) return null;
    const diff = Date.now() - new Date(entity.latest_run_at).getTime();
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
            {entity.display_name || entity.entity_id}
          </span>
          <span className="block font-mono text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            {entity.entity_id}
          </span>
        </div>
      </td>
      <td className="py-2.5 pr-4">
        <StatusBadge status={entity.health_status} />
      </td>
      <td className="py-2.5 pr-4">
        <div className="flex flex-wrap gap-1">
          {entity.layer_statuses.map((ls) => (
            <LayerPill key={ls.layer} layer={ls.layer} status={ls.latest_status} />
          ))}
        </div>
      </td>
      <td className="py-2.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
        {updatedAgo ?? "—"}
      </td>
      <td className="py-2.5 text-right">
        <button
          type="button"
          onClick={() => onOpenTrace(entity.entity_id)}
          className="rounded-lg px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-brand)" }}
        >
          Open Trace
        </button>
      </td>
    </tr>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

// ── Constants ─────────────────────────────────────────────────────────────────

const LAYERS = ["silver", "gold"] as const;
const STATUSES = ["SUCCESS", "FAILED", "WARNING", "RUNNING"] as const;

const STATUS_LABEL: Record<string, string> = {
  SUCCESS: "Success",
  FAILED: "Failed",
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

  function FilterPill({
    active,
    label,
    onClick,
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
  }) {
    return (
      <button
        onClick={onClick}
        className="px-2.5 py-1 rounded text-xs font-medium"
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
          {/* Search */}
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

          {/* Layer filter */}
          <div className="flex items-center gap-1 flex-wrap">
            <FilterPill active={layer === ""} label="All" onClick={() => onChangeLayer("")} />
            {LAYERS.map((l) => (
              <FilterPill
                key={l}
                active={layer === l}
                label={l}
                onClick={() => onChangeLayer(layer === l ? "" : l)}
              />
            ))}
          </div>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 flex-wrap">
          <FilterPill active={status === ""} label="All" onClick={() => onChangeStatus("")} />
          {STATUSES.map((s) => (
            <FilterPill
              key={s}
              active={status === s}
              label={STATUS_LABEL[s] ?? s}
              onClick={() => onChangeStatus(status === s ? "" : s)}
            />
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
        <div style={{ overflowX: "auto" }}>
          <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                {["Entity", "Status", "Layers", "Last run", ""].map((h) => (
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
              {entities.map((e) => (
                <EntityRow
                  key={e.entity_id}
                  entity={e}
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
