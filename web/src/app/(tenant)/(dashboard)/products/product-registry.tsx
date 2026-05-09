"use client";

import { useState, useMemo, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Package, Search, ChevronDown, ShieldAlert, CircleCheckBig, UserRound, Layers3 } from "lucide-react";
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

type ReadinessState = "ready" | "needs_attention";

function getProductIssues(product: Product) {
  const issues: string[] = [];
  if (!product.owner) issues.push("Missing owner");
  if (!product.sla_tier) issues.push("Missing SLA");
  if (!product.domain) issues.push("Missing domain");
  if ((product.entity_count ?? 0) === 0) issues.push("No members");
  return issues;
}

function getReadinessState(product: Product): ReadinessState {
  return getProductIssues(product).length === 0 ? "ready" : "needs_attention";
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "warning" | "success";
}) {
  const style =
    tone === "success"
      ? { background: "#dcfce7", color: "#166534" }
      : tone === "warning"
      ? { background: "#fef3c7", color: "#b45309" }
      : { background: "var(--color-surface-raised)", color: "var(--color-text-muted)" };
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={style}>
      {label}
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ProductCardSkeleton() {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-4 w-36 rounded animate-pulse" style={{ background: "var(--color-border)" }} />
          <div className="h-3 w-20 rounded animate-pulse" style={{ background: "var(--color-border)" }} />
        </div>
        <div className="h-7 w-7 rounded-full animate-pulse shrink-0" style={{ background: "var(--color-border)" }} />
      </div>
      <div className="h-3 w-full rounded animate-pulse" style={{ background: "var(--color-border)" }} />
      <div className="h-3 w-2/3 rounded animate-pulse" style={{ background: "var(--color-border)" }} />
      <div className="h-3 w-28 rounded animate-pulse mt-auto" style={{ background: "var(--color-border)" }} />
    </div>
  );
}

// ── Product card ──────────────────────────────────────────────────────────────

function ProductCard({ product }: { product: Product }) {
  const { data: trustData } = useTrustScore(product.data_product_id);
  const issues = getProductIssues(product);
  const readiness = getReadinessState(product);

  return (
    <Link
      href={`/products/${encodeURIComponent(product.data_product_id)}`}
      className="text-left rounded-xl p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow block"
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

      <div className="flex flex-wrap gap-1.5">
        <StatusPill label={readiness === "ready" ? "Ready" : "Needs attention"} tone={readiness === "ready" ? "success" : "warning"} />
        {issues.slice(0, 2).map((issue) => (
          <StatusPill key={issue} label={issue} tone="neutral" />
        ))}
      </div>

      <div className="flex items-center gap-3 mt-auto text-xs" style={{ color: "var(--color-text-muted)" }}>
        {product.owner && <span>Owner: {product.owner}</span>}
        <span>{product.entity_count ?? 0} entities</span>
      </div>
    </Link>
  );
}

// ── Registry ──────────────────────────────────────────────────────────────────

type SortKey = "name_asc" | "name_desc" | "updated";
type ReadinessFilter = "all" | "ready" | "needs_attention" | "missing_owner" | "missing_sla";

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className="rounded-xl p-4 flex items-start justify-between gap-3"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-muted)" }}>
          {label}
        </p>
        <p className="mt-2 text-3xl font-semibold" style={{ color: "var(--color-text)" }}>
          {value}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
          {hint}
        </p>
      </div>
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: "var(--color-surface-raised)", color: "var(--color-text-muted)" }}
      >
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}

export function ProductRegistry() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: response, isLoading, error } = useDataProducts();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [domain, setDomain] = useState(searchParams.get("domain") ?? "");
  const [sortBy, setSortBy] = useState<SortKey>((searchParams.get("sort") as SortKey) || "name_asc");
  const [readiness, setReadiness] = useState<ReadinessFilter>((searchParams.get("readiness") as ReadinessFilter) || "all");

  const products = (response as { data?: Product[] } | null)?.data ?? [];

  const domains = useMemo(
    () => Array.from(new Set(products.map((p) => p.domain).filter(Boolean))) as string[],
    [products],
  );

  const filtered = useMemo(() => {
    let list = products;
    if (domain) list = list.filter((p) => p.domain === domain);
    if (readiness !== "all") {
      list = list.filter((product) => {
        if (readiness === "ready") return getReadinessState(product) === "ready";
        if (readiness === "needs_attention") return getReadinessState(product) === "needs_attention";
        if (readiness === "missing_owner") return !product.owner;
        if (readiness === "missing_sla") return !product.sla_tier;
        return true;
      });
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) =>
          p.display_name?.toLowerCase().includes(q) ||
          p.domain?.toLowerCase().includes(q) ||
          p.owner?.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === "updated")   return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      if (sortBy === "name_desc") return b.display_name.localeCompare(a.display_name);
      return a.display_name.localeCompare(b.display_name);
    });
  }, [products, query, domain, sortBy, readiness]);

  const metrics = useMemo(() => {
    const ready = products.filter((product) => getReadinessState(product) === "ready").length;
    const missingOwner = products.filter((product) => !product.owner).length;
    const missingSla = products.filter((product) => !product.sla_tier).length;
    return { ready, missingOwner, missingSla };
  }, [products]);

  useEffect(() => {
    const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    if (query) params.set("q", query); else params.delete("q");
    if (domain) params.set("domain", domain); else params.delete("domain");
    if (sortBy !== "name_asc") params.set("sort", sortBy); else params.delete("sort");
    if (readiness !== "all") params.set("readiness", readiness); else params.delete("readiness");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [query, domain, sortBy, readiness, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full" style={{ padding: "var(--spacing-page, 24px)" }}>
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex flex-col gap-2">
            <div className="h-6 w-32 rounded animate-pulse" style={{ background: "var(--color-border)" }} />
            <div className="h-4 w-24 rounded animate-pulse" style={{ background: "var(--color-border)" }} />
          </div>
          <div className="h-8 w-28 rounded-lg animate-pulse" style={{ background: "var(--color-border)" }} />
        </div>
        <div className="h-9 w-full rounded-lg mb-6 animate-pulse" style={{ background: "var(--color-border)" }} />
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ padding: "var(--spacing-page, 24px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
            Data Products
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Browse operational products and surface governance gaps quickly.
          </p>
          {(query || domain || readiness !== "all" || sortBy !== "name_asc") && (
            <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
              This view is shareable through the URL.
            </p>
          )}
        </div>
        <Link
          href="/catalog?tab=products"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-90"
          style={{ background: "var(--color-brand)", color: "#fff" }}
        >
          + New Product
        </Link>
      </div>

      <div className="grid gap-4 mb-6 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Products" value={products.length} hint="Registered in this tenant" icon={Layers3} />
        <SummaryCard label="Ready" value={metrics.ready} hint="Owner, SLA, domain, and members present" icon={CircleCheckBig} />
        <SummaryCard label="Missing owner" value={metrics.missingOwner} hint="Needs clear accountability" icon={UserRound} />
        <SummaryCard label="Missing SLA" value={metrics.missingSla} hint="No declared service tier" icon={ShieldAlert} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-[200px]"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
          <input
            type="text"
            placeholder="Search products, domains, owners…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--color-text)" }}
          />
        </div>

        {domains.length > 1 && (
          <div
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="bg-transparent text-sm outline-none pr-1"
              style={{ color: domain ? "var(--color-text)" : "var(--color-text-muted)" }}
            >
              <option value="">All domains</option>
              {domains.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <ChevronDown className="h-3.5 w-3.5 pointer-events-none shrink-0" style={{ color: "var(--color-text-muted)" }} />
          </div>
        )}

        <div
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <select
            value={readiness}
            onChange={(e) => setReadiness(e.target.value as ReadinessFilter)}
            className="bg-transparent text-sm outline-none pr-1"
            style={{ color: readiness === "all" ? "var(--color-text-muted)" : "var(--color-text)" }}
          >
            <option value="all">All readiness states</option>
            <option value="ready">Ready</option>
            <option value="needs_attention">Needs attention</option>
            <option value="missing_owner">Missing owner</option>
            <option value="missing_sla">Missing SLA</option>
          </select>
          <ChevronDown className="h-3.5 w-3.5 pointer-events-none shrink-0" style={{ color: "var(--color-text-muted)" }} />
        </div>

        <div
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="bg-transparent text-sm outline-none pr-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            <option value="name_asc">Name A → Z</option>
            <option value="name_desc">Name Z → A</option>
            <option value="updated">Recently updated</option>
          </select>
          <ChevronDown className="h-3.5 w-3.5 pointer-events-none shrink-0" style={{ color: "var(--color-text-muted)" }} />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Could not load data products.
          </p>
        </div>
      )}

      {/* Empty */}
      {!error && filtered.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <Package className="h-8 w-8" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {query || domain || readiness !== "all" ? "No products match your filters." : "No data products registered yet."}
          </p>
          {(query || domain || readiness !== "all") && (
            <button
              onClick={() => { setQuery(""); setDomain(""); setReadiness("all"); }}
              className="text-xs hover:underline"
              style={{ color: "var(--color-brand)" }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      {!error && filtered.length > 0 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {filtered.map((p) => (
            <ProductCard key={p.data_product_id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
