"use client";

import { useState } from "react";
import { useDatasets } from "@/hooks/use-datasets";
import { Database, CheckCircle, XCircle, AlertTriangle, HelpCircle, Search } from "lucide-react";
import Link from "next/link";

const LAYERS = ["all", "landing", "raw", "bronze", "silver", "gold"] as const;
type Layer = typeof LAYERS[number];

const LAYER_BADGE: Record<string, { label: string; style: React.CSSProperties }> = {
  landing: {
    label: "landing",
    style: { background: "var(--color-surface-subtle, #f1f5f9)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" },
  },
  raw: {
    label: "raw",
    style: { background: "#dbeafe", color: "#1d4ed8" },
  },
  bronze: {
    label: "bronze",
    style: { background: "#fed7aa", color: "#c2410c" },
  },
  silver: {
    label: "silver",
    style: { background: "#cffafe", color: "#0e7490" },
  },
  gold: {
    label: "gold",
    style: { background: "#fef9c3", color: "#a16207" },
  },
};

const statusIcon = (status: string | null) => {
  switch (status) {
    case "SUCCESS": return <CheckCircle className="h-3.5 w-3.5" style={{ color: "#22c55e" }} />;
    case "FAILED": return <XCircle className="h-3.5 w-3.5" style={{ color: "#ef4444" }} />;
    case "WARNING": return <AlertTriangle className="h-3.5 w-3.5" style={{ color: "#f59e0b" }} />;
    default: return <HelpCircle className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />;
  }
};

function LayerBadge({ layer }: { layer: string | null }) {
  if (!layer) return <span style={{ color: "var(--color-text-muted)", fontSize: "0.75rem" }}>—</span>;
  const badge = LAYER_BADGE[layer];
  if (!badge) return (
    <span className="text-xs rounded-full px-2 py-0.5 font-mono" style={{ background: "var(--color-surface)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}>
      {layer}
    </span>
  );
  return (
    <span className="text-xs rounded-full px-2 py-0.5 font-mono font-medium" style={badge.style}>
      {badge.label}
    </span>
  );
}

export function DatasetRegistry() {
  const [layer, setLayer] = useState<Layer>("all");
  const [q, setQ] = useState("");
  const { data, isLoading, isError } = useDatasets({
    layer: layer !== "all" ? layer : undefined,
    q: q || undefined,
  });
  const datasets = (data?.data ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="flex flex-col h-full" style={{ padding: "var(--spacing-page, 24px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5" style={{ color: "var(--color-brand)" }} />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>Datasets</h1>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              All observed datasets across pipeline layers
            </p>
          </div>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
          <input
            type="text"
            placeholder="Search datasets…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="text-sm rounded-md border pl-8 pr-3 py-1.5 w-52"
            style={{ background: "var(--color-surface)", color: "var(--color-text)", borderColor: "var(--color-border)" }}
          />
        </div>
      </div>

      {/* Layer tabs */}
      <div className="flex gap-1 mb-4 border-b" style={{ borderColor: "var(--color-border)" }}>
        {LAYERS.map((l) => (
          <button
            key={l}
            onClick={() => setLayer(l)}
            className="px-3 py-2 text-sm font-medium capitalize transition-colors"
            style={{
              color: layer === l ? "var(--color-brand)" : "var(--color-text-muted)",
              borderBottom: layer === l ? "2px solid var(--color-brand)" : "2px solid transparent",
              background: "transparent",
              marginBottom: "-1px",
            }}
          >
            {l === "all" ? "All" : l}
          </button>
        ))}
      </div>

      {/* States */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--color-text-muted)" }}>
          Loading datasets…
        </div>
      )}
      {isError && (
        <div className="flex-1 flex items-center justify-center text-sm text-red-500">
          Failed to load datasets.
        </div>
      )}
      {!isLoading && !isError && datasets.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
          <Database className="h-10 w-10 opacity-20" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            No datasets found{layer !== "all" ? ` for layer "${layer}"` : ""}
            {q ? ` matching "${q}"` : ""}.
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && datasets.length > 0 && (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--color-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Dataset</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Layer</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Platform</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Group</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Last run</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d, i) => {
                const fqn = String(d.fqn ?? "");
                const objectName = String(d.object_name ?? fqn);
                const layerVal = d.layer != null ? String(d.layer) : null;
                const lineageHref = `/lineage?focus=${encodeURIComponent(fqn)}`;
                const lastRunAt = d.latest_run_at ? new Date(String(d.latest_run_at)).toLocaleString() : null;
                const lastSeenAt = d.last_seen_at ? new Date(String(d.last_seen_at)).toLocaleString() : null;
                return (
                  <tr
                    key={String(d.dataset_id ?? i)}
                    style={{
                      borderTop: i > 0 ? "1px solid var(--color-border)" : undefined,
                      background: "var(--color-bg)",
                    }}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={lineageHref}
                        className="font-medium hover:underline"
                        style={{ color: "var(--color-text)" }}
                      >
                        {objectName}
                      </Link>
                      <p className="text-xs font-mono mt-0.5 truncate max-w-xs" style={{ color: "var(--color-text-muted)" }}>
                        {fqn}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <LayerBadge layer={layerVal} />
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
                      {d.platform ? String(d.platform) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {d.entity_type ? String(d.entity_type) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--color-text)" }}>
                      {d.group_id ? String(d.group_id) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {statusIcon(d.latest_run_status != null ? String(d.latest_run_status) : null)}
                        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                          {lastRunAt ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {lastSeenAt ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
