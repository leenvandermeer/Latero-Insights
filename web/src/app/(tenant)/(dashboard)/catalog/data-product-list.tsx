"use client";

import { useState } from "react";
import Link from "next/link";
import { Package, Plus, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import {
  useDataProducts,
  useDeleteDataProduct,
  type DataProduct,
} from "@/hooks/use-data-products";
import { DataProductSlideOver } from "./data-product-slide-over";

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

// ── Card ──────────────────────────────────────────────────────────────────────

function DataProductCard({
  product,
  onEdit,
}: {
  product: DataProduct;
  onEdit: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteMutation = useDeleteDataProduct();

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(product.data_product_id);
    setConfirmDelete(false);
  };

  const updatedAgo = (() => {
    const diff = Date.now() - new Date(product.updated_at).getTime();
    const d = Math.floor(diff / 86400000);
    if (d === 0) return "today";
    if (d === 1) return "yesterday";
    return `${d}d ago`;
  })();

  return (
    <>
      <div
        className="relative rounded-xl p-4 flex flex-col gap-3 group"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/products/${encodeURIComponent(product.data_product_id)}`}
                className="text-sm font-semibold truncate hover:underline"
                style={{ color: "var(--color-text)" }}
              >
                {product.display_name}
              </Link>
              <SlaBadge tier={product.sla_tier} />
            </div>
            {product.domain && (
              <span className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                {product.domain}
              </span>
            )}
          </div>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1 rounded transition-opacity"
            style={{ color: "var(--color-text-muted)" }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Description */}
        {product.description && (
          <p
            className="text-xs leading-relaxed line-clamp-2"
            style={{ color: "var(--color-text-muted)" }}
          >
            {product.description}
          </p>
        )}

        {/* Entity pills */}
        {product.entity_ids.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.entity_ids.slice(0, 3).map((id) => (
              <span
                key={id}
                className="text-[10px] font-mono px-2 py-0.5 rounded"
                style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
              >
                {id}
              </span>
            ))}
            {product.entity_ids.length > 3 && (
              <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                +{product.entity_ids.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: "var(--color-text-muted)", borderTop: "1px solid var(--color-border)", paddingTop: 8 }}>
          <Link
            href={`/products/${encodeURIComponent(product.data_product_id)}`}
            className="font-medium hover:underline"
            style={{ color: "var(--color-brand)" }}
          >
            Open product
          </Link>
          <span>{product.entity_count} {product.entity_count === 1 ? "entity" : "entities"}</span>
          {product.owner && <span>· {product.owner}</span>}
          <span className="ml-auto">Updated {updatedAgo}</span>
        </div>

        {/* Dropdown menu */}
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div
              className="absolute right-2 top-10 z-20 rounded-lg shadow-lg overflow-hidden"
              style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", minWidth: 120 }}
            >
              <button
                onClick={() => { setMenuOpen(false); onEdit(); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-[var(--color-surface)]"
                style={{ color: "var(--color-text)" }}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left"
                style={{ color: "#ef4444" }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </>
        )}
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-sm rounded-xl p-6"
            style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
          >
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text)" }}>
              Delete "{product.display_name}"?
            </h3>
            <p className="text-xs mb-5" style={{ color: "var(--color-text-muted)" }}>
              Removes the data product. Linked entities are kept and unlinked.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                style={{ background: "#ef4444" }}
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <Package className="h-12 w-12 opacity-20" style={{ color: "var(--color-text-muted)" }} />
      <div className="text-center">
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>No data products yet</p>
        <p className="text-xs mt-1 max-w-xs" style={{ color: "var(--color-text-muted)" }}>
          Group your entities into a reusable data product. Add a description, owner, and SLA so consumers know what to expect.
        </p>
      </div>
      <button
        onClick={onCreateClick}
        className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
        style={{ background: "var(--color-brand)" }}
      >
        <Plus className="h-4 w-4" /> New data product
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function DataProductList() {
  const { data, isLoading, isError } = useDataProducts();
  const products = (data?.data ?? []) as DataProduct[];
  const [slideOver, setSlideOver] = useState<{ open: boolean; editing?: DataProduct }>({ open: false });

  const openCreate = () => setSlideOver({ open: true });
  const openEdit = (p: DataProduct) => setSlideOver({ open: true, editing: p });
  const closeSlideOver = () => setSlideOver({ open: false });

  return (
    <>
      {/* Toolbar */}
      {!isLoading && !isError && products.length > 0 && (
        <div className="flex justify-end mb-4">
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
            style={{ background: "var(--color-brand)" }}
          >
            <Plus className="h-4 w-4" /> New data product
          </button>
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl animate-pulse h-40"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }} />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-center py-12" style={{ color: "#ef4444" }}>
          Failed to load data products.
        </p>
      )}

      {!isLoading && !isError && products.length === 0 && (
        <EmptyState onCreateClick={openCreate} />
      )}

      {!isLoading && !isError && products.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => (
            <DataProductCard key={p.data_product_id} product={p} onEdit={() => openEdit(p)} />
          ))}
        </div>
      )}

      <DataProductSlideOver
        open={slideOver.open}
        onClose={closeSlideOver}
        initialValues={slideOver.editing}
      />
    </>
  );
}
