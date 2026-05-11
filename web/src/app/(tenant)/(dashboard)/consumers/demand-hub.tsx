"use client";

import { useState } from "react";
import { Users, BarChart3, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useDataProducts } from "@/hooks/use-data-products";

interface ProductConsumer {
  id: number;
  product_id: string;
  consumer_name: string;
  consumer_type: string;
  contact: string | null;
  registered_at: string;
  event_count: number;
  last_access_at: string | null;
}

interface ProductUsageDay {
  date: string;
  event_count: number;
}

interface DataProduct {
  data_product_id: string;
  display_name: string;
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Request failed");
  return res.json() as Promise<T>;
}

// ── Usage sparkline ───────────────────────────────────────────────────────────

function UsageBar({ days }: { days: ProductUsageDay[] }) {
  if (!days || days.length === 0) return null;
  const max = Math.max(...days.map((d) => d.event_count), 1);
  const recent = days.slice(-14);
  return (
    <div className="flex items-end gap-0.5 h-6">
      {recent.map((d, i) => (
        <div
          key={i}
          className="w-2 rounded-sm"
          style={{
            height: `${Math.max(2, (d.event_count / max) * 24)}px`,
            background: "var(--color-brand)",
            opacity: 0.5 + 0.5 * (d.event_count / max),
          }}
          title={`${d.date}: ${d.event_count}`}
        />
      ))}
    </div>
  );
}

// ── Product detail ────────────────────────────────────────────────────────────

function ProductDemandPanel({ productId }: { productId: string }) {
  const { data: consumersResponse } = useQuery({
    queryKey: ["consumers", productId],
    queryFn: () =>
      apiFetch<{ data: ProductConsumer[] }>(`/api/products/${encodeURIComponent(productId)}/consumers`)
        .then((r) => r.data ?? []),
    staleTime: 30_000,
    retry: 1,
  });

  const { data: usageResponse } = useQuery({
    queryKey: ["usage", productId],
    queryFn: () =>
      apiFetch<{ data: ProductUsageDay[] }>(`/api/products/${encodeURIComponent(productId)}/usage`)
        .then((r) => r.data ?? []),
    staleTime: 30_000,
    retry: 1,
  });

  const consumers = consumersResponse ?? [];
  const usage = usageResponse ?? [];
  const totalEvents = usage.reduce((s, d) => s + d.event_count, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Consumers", value: consumers.length },
          { label: "Events (30d)", value: totalEvents },
          { label: "Last access", value: consumers[0]?.last_access_at
            ? new Date(consumers[0].last_access_at).toLocaleDateString()
            : "—" },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl p-3"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</p>
            <p className="text-lg font-bold tabular-nums mt-1" style={{ color: "var(--color-text)" }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {usage.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>Daily usage (last 14 days)</p>
          <UsageBar days={usage} />
        </div>
      )}

      {consumers.length > 0 && (
        <div
          className="rounded-xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="p-3 border-b text-xs font-medium" style={{ color: "var(--color-text-muted)", borderColor: "var(--color-border)" }}>
            Registered consumers
          </div>
          {consumers.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 px-3 py-2 border-b last:border-0"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
                  {c.consumer_name}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {c.consumer_type}{c.contact ? ` · ${c.contact}` : ""}
                </p>
              </div>
              <div className="text-right text-xs" style={{ color: "var(--color-text-muted)" }}>
                <p>{c.event_count} events</p>
                {c.last_access_at && (
                  <p>{new Date(c.last_access_at).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Hub ───────────────────────────────────────────────────────────────────────

export function DemandHub() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: productsResponse, isLoading } = useDataProducts();
  const products = ((productsResponse as { data?: DataProduct[] } | null)?.data ?? []) as DataProduct[];

  const filtered = products.filter(
    (p) =>
      !search ||
      p.display_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-content flex h-full flex-col overflow-x-hidden">
      <div className="mb-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" style={{ color: "var(--color-brand)" }} />
          <div>
            <h1 className="text-lg font-medium leading-tight" style={{ color: "var(--color-text)" }}>Consumers</h1>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Demand-side analytics per data product
            </p>
          </div>
        </div>

        <div
          className="flex items-center gap-2 rounded-md border px-2.5"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
          <input
            type="text"
            placeholder="Filter products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--color-text)" }}
          />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div
          className="min-h-0 overflow-hidden rounded-lg border"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="border-b px-4 py-2.5 text-xs font-medium" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)", background: "var(--color-surface-subtle)" }}>
            Products
          </div>
          <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto p-2 xl:max-h-none xl:h-full">
            {isLoading && <p className="px-2 py-4 text-xs" style={{ color: "var(--color-text-muted)" }}>Loading…</p>}
            {!isLoading && filtered.length === 0 && (
              <p className="px-2 py-4 text-xs" style={{ color: "var(--color-text-muted)" }}>No matching products.</p>
            )}
            {filtered.map((p) => (
              <button
                key={p.data_product_id}
                onClick={() => setSelectedId(p.data_product_id)}
                className="rounded-md px-3 py-2 text-left text-sm transition-colors"
                style={{
                  background: selectedId === p.data_product_id ? "var(--color-sidebar-hover)" : "transparent",
                  color: "var(--color-text)",
                }}
              >
                {p.display_name}
              </button>
            ))}
          </div>
        </div>

        <div
          className="min-h-0 overflow-y-auto rounded-lg border"
          style={{ borderColor: "var(--color-border)" }}
        >
          {!selectedId && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <Users className="h-8 w-8" style={{ color: "var(--color-text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Select a product to view consumer analytics
            </p>
          </div>
        )}
        {selectedId && (
          <div className="p-4">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" style={{ color: "var(--color-brand)" }} />
              <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
                {products.find((p) => p.data_product_id === selectedId)?.display_name}
              </h2>
            </div>
            <ProductDemandPanel productId={selectedId} />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
