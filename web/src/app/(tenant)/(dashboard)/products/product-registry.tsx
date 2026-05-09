"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, Search } from "lucide-react";
import { useDataProducts } from "@/hooks/use-data-products";
import { useTrustScore } from "@/hooks/use-trust-score";
import { TrustScoreBadge } from "@/components/trust/trust-score-badge";

interface Product {
  data_product_id: string;
  display_name: string;
  description: string | null;
  owner: string | null;
  domain: string | null;
  sla_tier: "bronze" | "silver" | "gold" | null;
  entity_count: number;
  updated_at: string;
}

// ── SLA badge ─────────────────────────────────────────────────────────────────

const SLA_STYLE: Record<string, { bg: string; text: string }> = {
  bronze: { bg: "#fed7aa", text: "#c2410c" },
  silver: { bg: "#cffafe", text: "#0e7490" },
  gold:   { bg: "#fef9c3", text: "#a16207" },
};

function SlaBadge({ tier }: { tier: string | null }) {
  if (!tier) return null;
  const s = SLA_STYLE[tier];
  if (!s) return null;
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
      style={{ background: s.bg, color: s.text }}
    >
      {tier}
    </span>
  );
}

// ── Product card ──────────────────────────────────────────────────────────────

function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const { data: trustData } = useTrustScore(product.data_product_id);

  return (
    <button
      onClick={() => router.push(`/products/${encodeURIComponent(product.data_product_id)}`)}
      className="text-left rounded-xl p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow w-full"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
              {product.display_name}
            </span>
            <SlaBadge tier={product.sla_tier} />
          </div>
          {product.domain && (
            <span className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              {product.domain}
            </span>
          )}
        </div>
        <TrustScoreBadge score={(trustData as { score?: number } | undefined)?.score} />
      </div>

      {product.description && (
        <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--color-text-muted)" }}>
          {product.description}
        </p>
      )}

      <div className="flex items-center gap-3 mt-auto text-xs" style={{ color: "var(--color-text-muted)" }}>
        {product.owner && <span>Owner: {product.owner}</span>}
        <span>{product.entity_count ?? 0} entities</span>
      </div>
    </button>
  );
}

// ── Registry ──────────────────────────────────────────────────────────────────

export function ProductRegistry() {
  const { data: response, isLoading, error } = useDataProducts();
  const [query, setQuery] = useState("");

  const products = (
    (response as { data?: Product[] } | null)?.data ?? []
  );

  const filtered = products.filter((p) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      p.display_name?.toLowerCase().includes(q) ||
      p.domain?.toLowerCase().includes(q) ||
      p.owner?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full" style={{ padding: "var(--spacing-page, 24px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
            Data Products
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            {products.length} product{products.length !== 1 ? "s" : ""} in registry
          </p>
        </div>
        <a
          href="/catalog?tab=products"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
          style={{
            background: "var(--color-brand)",
            color: "#fff",
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          New Product
        </a>
      </div>

      {/* Search */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg mb-6"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
        <input
          type="text"
          placeholder="Search products, domains, owners…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--color-text)" }}
        />
      </div>

      {/* States */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Could not load data products.
          </p>
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <Package className="h-8 w-8" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {query ? "No products match your search." : "No data products registered yet."}
          </p>
        </div>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {filtered.map((p) => (
            <ProductCard key={p.data_product_id as string} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
