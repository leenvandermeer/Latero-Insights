"use client";

import { useDataProducts } from "@/hooks/use-data-products";
import { Package, Boxes } from "lucide-react";
import Link from "next/link";

export function DataCatalog() {
  const { data, isLoading, isError } = useDataProducts();
  const products = (data?.data ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="flex flex-col h-full" style={{ padding: "var(--spacing-page, 24px)" }}>
      <div className="flex items-center gap-3 mb-6">
        <Package className="h-5 w-5" style={{ color: "var(--color-brand)" }} />
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>Data Catalog</h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Registered data products and their entities</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center" style={{ color: "var(--color-text-muted)" }}>Loading catalog…</div>
      )}
      {isError && (
        <div className="flex-1 flex items-center justify-center text-red-500">Failed to load data products.</div>
      )}
      {!isLoading && !isError && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.length === 0 && (
            <div className="col-span-full py-16 text-center" style={{ color: "var(--color-text-muted)" }}>
              No data products registered yet.
            </div>
          )}
          {products.map((product) => {
            const id = String(product.data_product_id ?? "");
            return (
              <div
                key={id}
                className="rounded-xl border p-5"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <Package className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--color-brand)" }} />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: "var(--color-text)" }}>
                      {String(product.display_name ?? id)}
                    </p>
                    {Boolean(product.domain) && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{String(product.domain)}</p>
                    )}
                  </div>
                </div>
                {Boolean(product.description) && (
                  <p className="text-xs mb-3 line-clamp-2" style={{ color: "var(--color-text-muted)" }}>
                    {String(product.description)}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    <Boxes className="h-3.5 w-3.5" />
                    {Number(product.entity_count ?? 0)} entities
                  </span>
                  <Link
                    href={`/entities?product_id=${encodeURIComponent(id)}`}
                    className="text-xs font-medium hover:underline"
                    style={{ color: "var(--color-brand)" }}
                  >
                    View entities →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
