"use client";

import { useState, useMemo, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Package, Search, ChevronDown, ShieldAlert, CircleCheckBig, UserRound, Layers3, PlusCircle, Pencil, Loader2, Download } from "lucide-react";
import { useDataProducts, useUpdateDataProduct, type DataProduct } from "@/hooks/use-data-products";
import { toast } from "sonner";
import { useTrustScore } from "@/hooks/use-trust-score";
import { TrustScoreBadge } from "@/components/trust/trust-score-badge";
import { DataProductSlideOver } from "@/app/(tenant)/(dashboard)/catalog/data-product-slide-over";

type Product = DataProduct;

// ── SLA badge ─────────────────────────────────────────────────────────────────

const SLA_STYLE: Record<string, { bg: string; text: string }> = {
  bronze: { bg: "var(--color-warning-subtle)", text: "var(--color-warning)" },
  silver: { bg: "var(--color-brand-subtle)",   text: "var(--color-brand)" },
  gold:   { bg: "var(--color-warning-subtle)", text: "var(--color-warning)" },
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
  if (!product.classification) issues.push("No classification");
  if (!product.data_steward) issues.push("No steward");
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
      ? { background: "var(--color-success-subtle)", color: "var(--color-success)" }
      : tone === "warning"
      ? { background: "var(--color-warning-subtle)", color: "var(--color-warning)" }
      : { background: "var(--color-surface-alt)", color: "var(--color-text-muted)" };
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

// ── Governance Edit Modal ─────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--color-surface-alt)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
};
const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none";

function GovernanceModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const update = useUpdateDataProduct(product.data_product_id);
  const [owner, setOwner]             = useState(product.owner ?? "");
  const [steward, setSteward]         = useState(product.data_steward ?? "");
  const [classification, setClass]    = useState(product.classification ?? "");
  const [retention, setRetention]     = useState(product.retention_days !== null ? String(product.retention_days) : "");
  const [error, setError]             = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    const retDays = retention.trim() ? Number(retention) : null;
    if (retDays !== null && (isNaN(retDays) || retDays <= 0)) {
      setError("Retention days must be a positive number");
      return;
    }
    try {
      await update.mutateAsync({
        owner:          owner.trim() || null,
        data_steward:   steward.trim() || null,
        classification: (classification || null) as "public" | "internal" | "confidential" | "restricted" | null,
        retention_days: retDays,
      });
      toast.success("Governance settings saved");
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      toast.error("Save failed", { description: msg });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Governance — ${product.display_name}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-elevated)" }}
      >
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            Governance — {product.display_name}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            These fields are evaluated by compliance policies.
          </p>
        </div>

        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Owner</label>
          <input value={owner} onChange={(e) => setOwner(e.target.value)}
            className={inputCls} style={INPUT_STYLE} placeholder="e.g. team-data-platform" />
        </div>

        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Data steward</label>
          <input value={steward} onChange={(e) => setSteward(e.target.value)}
            className={inputCls} style={INPUT_STYLE} placeholder="e.g. jane.doe@bank.nl" />
        </div>

        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Classification</label>
          <select value={classification} onChange={(e) => setClass(e.target.value)}
            className={inputCls} style={INPUT_STYLE}>
            <option value="">— Not set —</option>
            <option value="public">Public</option>
            <option value="internal">Internal</option>
            <option value="confidential">Confidential</option>
            <option value="restricted">Restricted</option>
          </select>
        </div>

        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Retention (days)</label>
          <input type="number" value={retention} onChange={(e) => setRetention(e.target.value)}
            className={inputCls} style={INPUT_STYLE} placeholder="e.g. 365" min={1} />
        </div>

        {error && <p className="text-xs" style={{ color: "var(--color-error)" }}>{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm"
            style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={update.isPending}
            className="flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5"
            style={{ background: "var(--color-accent)", color: "#fff", opacity: update.isPending ? 0.6 : 1 }}>
            {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Product card ──────────────────────────────────────────────────────────────

function ProductCard({ product }: { product: Product }) {
  const { data: trustData } = useTrustScore(product.data_product_id);
  const issues = getProductIssues(product);
  const readiness = getReadinessState(product);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      {editOpen && <GovernanceModal product={product} onClose={() => setEditOpen(false)} />}
      <div
        className="rounded-xl p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow relative group"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        {/* Edit governance button — top-right, visible on hover */}
        <button
          onClick={() => setEditOpen(true)}
          className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
          title="Edit governance"
        >
          <Pencil className="h-3 w-3" />
        </button>

        <Link
          href={`/products/${encodeURIComponent(product.data_product_id)}`}
          className="flex flex-col gap-3"
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
            {product.classification && (
              <span className="capitalize">{product.classification}</span>
            )}
            <span>{product.entity_count ?? 0} entities</span>
          </div>
        </Link>
      </div>
    </>
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
        style={{ background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }}
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
  const [slideOverOpen, setSlideOverOpen] = useState(false);

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
      <div className="flex h-full flex-col page-content">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="h-6 w-32 rounded animate-pulse" style={{ background: "var(--color-border)" }} />
            <div className="h-4 w-24 rounded animate-pulse" style={{ background: "var(--color-border)" }} />
          </div>
        <div className="h-8 w-28 rounded-lg animate-pulse" style={{ background: "var(--color-border)" }} />
        </div>
        <div className="h-9 w-full rounded-lg mb-6 animate-pulse" style={{ background: "var(--color-border)" }} />
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
          {Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col page-content">
      <div className="mb-6 flex flex-col gap-3 pt-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {(query || domain || readiness !== "all" || sortBy !== "name_asc") && (
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              This view is shareable through the URL.
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => {
              const header = ["Name","Domain","Owner","Data Steward","Classification","SLA Tier","External ID","Entities","Last Updated"].join(",");
              const rows = filtered.map((p) =>
                [
                  JSON.stringify(p.display_name),
                  JSON.stringify(p.domain ?? ""),
                  JSON.stringify(p.owner ?? ""),
                  JSON.stringify(p.data_steward ?? ""),
                  p.classification ?? "",
                  p.sla_tier ?? "",
                  p.external_id ?? "",
                  p.entity_count,
                  new Date(p.updated_at).toISOString().slice(0, 10),
                ].join(",")
              );
              const csv = [header, ...rows].join("\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `data-products-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex min-h-[var(--touch-target-min)] w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80 sm:min-h-0 sm:w-auto sm:justify-start sm:py-1.5 sm:text-xs"
            style={{ background: "var(--color-surface-raised)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            onClick={() => setSlideOverOpen(true)}
            className="inline-flex min-h-[var(--touch-target-min)] w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90 sm:min-h-0 sm:w-auto sm:justify-start sm:py-1.5 sm:text-xs"
            style={{ background: "var(--color-brand)", color: "#fff" }}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            New product
          </button>
        </div>
      </div>

      <DataProductSlideOver open={slideOverOpen} onClose={() => setSlideOverOpen(false)} />

      <div className="grid gap-4 mb-6 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Products" value={products.length} hint="Registered in this tenant" icon={Layers3} />
        <SummaryCard label="Ready" value={metrics.ready} hint="Owner, SLA, domain, members, classification and steward present" icon={CircleCheckBig} />
        <SummaryCard label="Missing owner" value={metrics.missingOwner} hint="Needs clear accountability" icon={UserRound} />
        <SummaryCard label="Missing SLA" value={metrics.missingSla} hint="No declared service tier" icon={ShieldAlert} />
      </div>

      {/* Filters */}
      <div className="mb-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,0.7fr))]">
        <div
          className="flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 sm:col-span-2 xl:col-span-1"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
          <input
            type="text"
            placeholder="Search products, domains, owners…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--color-text)" }}
          />
        </div>

        {domains.length > 1 && (
          <div
            className="flex min-h-[var(--touch-target-min)] items-center gap-1.5 rounded-lg px-3 py-2"
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
          className="flex min-h-[var(--touch-target-min)] items-center gap-1.5 rounded-lg px-3 py-2"
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
          className="flex min-h-[var(--touch-target-min)] items-center gap-1.5 rounded-lg px-3 py-2"
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
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
          <Package className="h-10 w-10" style={{ color: "var(--color-text-muted)", opacity: 0.5 }} />
          {query || domain || readiness !== "all" ? (
            <>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No products match your filters.</p>
              <button
                onClick={() => { setQuery(""); setDomain(""); setReadiness("all"); }}
                className="text-xs hover:underline"
                style={{ color: "var(--color-brand)" }}
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>No data products registered yet</p>
              <p className="text-xs text-center max-w-xs" style={{ color: "var(--color-text-muted)" }}>
                Data products are the building blocks of your data platform. Register your first product to start tracking lineage, quality, and ownership.
              </p>
              <button
                onClick={() => router.push("/onboarding")}
                className="mt-1 text-xs px-4 py-2 rounded-xl font-medium"
                style={{ background: "var(--color-brand)", color: "#fff" }}
              >
                Register your first product
              </button>
            </>
          )}
        </div>
      )}

      {/* Grid */}
      {!error && filtered.length > 0 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
          {filtered.map((p) => (
            <ProductCard key={p.data_product_id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
