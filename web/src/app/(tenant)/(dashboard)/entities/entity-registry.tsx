"use client";

import { useState } from "react";
import { useEntities } from "@/hooks/use-entities";
import { Boxes, CheckCircle, XCircle, AlertTriangle, HelpCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const statusIcon = (status: string) => {
  switch (status) {
    case "SUCCESS": return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
    case "FAILED": return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case "WARNING": return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
    default: return <HelpCircle className="h-3.5 w-3.5 text-gray-400" />;
  }
};

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    SUCCESS: "text-green-600",
    FAILED: "text-red-600",
    WARNING: "text-yellow-600",
    UNKNOWN: "text-gray-400",
  };
  return map[status] ?? "text-gray-400";
};

export function EntityRegistry() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const { data, isLoading, isError } = useEntities({ q: q || undefined, status: statusFilter || undefined });
  const entities = (data?.data ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="flex flex-col h-full" style={{ padding: "var(--spacing-page, 24px)" }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Boxes className="h-5 w-5" style={{ color: "var(--color-brand)" }} />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>Entities</h1>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>All tracked data entities across layers</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
            <input
              type="text"
              placeholder="Search entities…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="text-sm rounded-md border pl-8 pr-3 py-1.5 w-48"
              style={{ background: "var(--color-surface)", color: "var(--color-text)", borderColor: "var(--color-border)" }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm rounded-md border px-2 py-1.5"
            style={{ background: "var(--color-surface)", color: "var(--color-text)", borderColor: "var(--color-border)" }}
          >
            <option value="">All statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
            <option value="WARNING">Warning</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center" style={{ color: "var(--color-text-muted)" }}>Loading entities…</div>
      )}
      {isError && (
        <div className="flex-1 flex items-center justify-center text-red-500">Failed to load entities.</div>
      )}
      {!isLoading && !isError && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entities.length === 0 && (
            <div className="col-span-full py-16 text-center" style={{ color: "var(--color-text-muted)" }}>
              No entities found
            </div>
          )}
          {entities.map((entity) => {
            const fqn = String(entity.entity_id ?? "");
            const layers = (entity.layer_statuses as Array<Record<string, string>>) ?? [];
            const health = String(entity.health_status ?? "UNKNOWN");
            return (
              <Link
                key={fqn}
                href={`/entities/${encodeURIComponent(fqn)}`}
                className="block rounded-xl border p-4 transition-colors hover:border-blue-400"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="font-medium text-sm truncate" style={{ color: "var(--color-text)" }}>{fqn}</span>
                  <span className={cn("flex items-center gap-1 text-xs", statusLabel(health))}>
                    {statusIcon(health)} {health}
                  </span>
                </div>
                {Boolean(entity.data_product_id) && (
                  <p className="text-xs mb-2 truncate" style={{ color: "var(--color-text-muted)" }}>
                    {String(entity.data_product_id)}
                  </p>
                )}
                {layers.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-2">
                    {layers.map((ls) => (
                      <span
                        key={ls.layer}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-medium",
                          ls.latest_status === "SUCCESS" && "bg-green-100 text-green-700",
                          ls.latest_status === "FAILED" && "bg-red-100 text-red-700",
                          ls.latest_status === "WARNING" && "bg-yellow-100 text-yellow-700",
                          !["SUCCESS", "FAILED", "WARNING"].includes(ls.latest_status) && "bg-gray-100 text-gray-500",
                        )}
                      >
                        {ls.layer}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
