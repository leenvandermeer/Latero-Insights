"use client";

import React, { useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  ChevronLeft, Pencil, Trash2, RefreshCw, AlertTriangle,
  Shield, GitBranch, Plus, ArrowRight, Loader2, CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useDataProduct, useUpdateDataProduct, useDeleteDataProduct,
  type DataProduct, type DataProductInput,
} from "@/hooks/use-data-products";
import { useEntities } from "@/hooks/use-entities";
import { useQuality } from "@/hooks/use-quality";
import type { DataQualityCheck } from "@/lib/adapters/types";
import { useRefreshTrustScore, useTrustScore, type TrustFactor } from "@/hooks/use-trust-score";
import { toast } from "sonner";
import { useIncidents } from "@/hooks/use-incidents";
import { TrustScoreBreakdown } from "@/components/trust/trust-score-breakdown";
import { TrustScoreBadge } from "@/components/trust/trust-score-badge";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "overview" | "incidents" | "lineage" | "quality" | "evidence";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview",  label: "Overview" },
  { id: "incidents", label: "Issues" },
  { id: "lineage",   label: "Lineage" },
  { id: "quality",   label: "Data Quality" },
  { id: "evidence",  label: "Evidence" },
];

const SLA_STYLE: Record<string, { bg: string; text: string }> = {
  bronze: { bg: "var(--color-warning-subtle)", text: "var(--color-warning)" },
  silver: { bg: "var(--color-brand-subtle)",   text: "var(--color-brand)" },
  gold:   { bg: "var(--color-warning-subtle)", text: "var(--color-warning)" },
};

const SEVERITY_STYLE: Record<string, { bg: string; text: string }> = {
  critical: { bg: "var(--color-error-subtle)",   text: "var(--color-error)" },
  high:     { bg: "var(--color-error-subtle)",   text: "var(--color-error)" },
  medium:   { bg: "var(--color-warning-subtle)", text: "var(--color-warning)" },
  low:      { bg: "var(--color-brand-subtle)",   text: "var(--color-brand)" },
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  open:        { bg: "var(--color-error-subtle)",   text: "var(--color-error)" },
  in_progress: { bg: "var(--color-warning-subtle)", text: "var(--color-warning)" },
  resolved:    { bg: "var(--color-success-subtle)", text: "var(--color-success)" },
};

const ENTITY_HEALTH_STYLE: Record<string, { bg: string; text: string }> = {
  SUCCESS: { bg: "var(--color-success-subtle)", text: "var(--color-success)" },
  WARNING: { bg: "var(--color-warning-subtle)", text: "var(--color-warning)" },
  FAILED:  { bg: "var(--color-error-subtle)",   text: "var(--color-error)" },
  UNKNOWN: { bg: "var(--color-surface-alt)",    text: "var(--color-text-muted)" },
};

const ENTITY_LAYER_STYLE: Record<string, { bg: string; text: string }> = {
  landing: { bg: "var(--color-brand-subtle)",   text: "var(--color-brand)" },
  raw:     { bg: "var(--color-success-subtle)", text: "var(--color-success)" },
  bronze:  { bg: "var(--color-warning-subtle)", text: "var(--color-warning)" },
  silver:  { bg: "var(--color-surface-alt)",    text: "var(--color-text-muted)" },
  gold:    { bg: "var(--color-warning-subtle)", text: "var(--color-warning)" },
};

const ENTITY_LAYER_ORDER = ["landing", "raw", "bronze", "silver", "gold"] as const;

interface TrustScoreData {
  score: number;
  factors: TrustFactor[];
}

interface EvidenceRecord {
  id: number;
  event_type: string;
  payload: Record<string, unknown>;
  recorded_at: string;
  recorded_by: string | null;
}

interface ProductMemberEntity {
  entity_id: string;
  display_name: string | null;
  health_status?: string;
  latest_run_at?: string | null;
  layer_statuses?: Array<{ layer: string; latest_status?: string }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Badge({ bg, text, label }: { bg: string; text: string; label: string }) {
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
      style={{ background: bg, color: text }}
    >
      {label}
    </span>
  );
}

const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inputStyle = {
  background: "var(--color-surface-alt)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
};

function getEntityHighestLayer(entity: ProductMemberEntity): string | null {
  const layers = new Set((entity.layer_statuses ?? []).map((item) => item.layer));
  for (let index = ENTITY_LAYER_ORDER.length - 1; index >= 0; index -= 1) {
    const layer = ENTITY_LAYER_ORDER[index];
    if (layers.has(layer)) return layer;
  }
  return null;
}

function getProductGaps(product: DataProduct) {
  const gaps: string[] = [];
  if (!product.owner) gaps.push("Add an owner");
  if (!product.domain) gaps.push("Add a domain");
  if (!product.sla_tier) gaps.push("Set an SLA tier");
  if ((product.entity_count ?? 0) === 0) gaps.push("Link at least one entity");
  return gaps;
}

function ProductSignalCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--color-text)" }}>
        {value}
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
        {hint}
      </p>
    </div>
  );
}

function ProductMembersPanel({
  productId,
  compact = false,
  onManageMembers,
}: {
  productId: string;
  compact?: boolean;
  onManageMembers?: () => void;
}) {
  const { data, isLoading } = useEntities({ product_id: productId });
  const members = useMemo(() => {
    const rows = ((data?.data ?? []) as ProductMemberEntity[]).slice();
    rows.sort((a, b) => {
      const layerA = getEntityHighestLayer(a);
      const layerB = getEntityHighestLayer(b);
      const layerRankA = layerA ? ENTITY_LAYER_ORDER.indexOf(layerA as (typeof ENTITY_LAYER_ORDER)[number]) : -1;
      const layerRankB = layerB ? ENTITY_LAYER_ORDER.indexOf(layerB as (typeof ENTITY_LAYER_ORDER)[number]) : -1;
      if (layerRankA !== layerRankB) return layerRankB - layerRankA;
      return (a.display_name ?? a.entity_id).localeCompare(b.display_name ?? b.entity_id);
    });
    return rows;
  }, [data]);

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            Member entities
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Review composition and open trace from a member.
          </p>
        </div>
        <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
          {members.length} member{members.length === 1 ? "" : "s"}
        </span>
      </div>

      {onManageMembers && (
        <div className="flex justify-start">
          <button
            type="button"
            onClick={onManageMembers}
            className="rounded-lg px-3 py-1.5 text-xs font-medium"
            style={{
              background: "var(--color-brand)",
              color: "var(--color-text-on-dark)",
            }}
          >
            Manage members
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: compact ? 3 : 5 }).map((_, index) => (
            <div
              key={index}
              className="rounded-lg p-3 animate-pulse"
              style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
            >
              <div className="h-4 w-40 rounded" style={{ background: "var(--color-border)" }} />
            </div>
          ))}
        </div>
      )}

      {!isLoading && members.length === 0 && (
        <div
          className="rounded-lg p-4 text-sm"
          style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
        >
          This product has no linked entities yet.
        </div>
      )}

      {!isLoading && members.length > 0 && (
        <div className="flex flex-col gap-2">
          {members.slice(0, compact ? 6 : members.length).map((entity) => {
            const health = ENTITY_HEALTH_STYLE[entity.health_status ?? "UNKNOWN"] ?? ENTITY_HEALTH_STYLE.UNKNOWN;
            const highestLayer = getEntityHighestLayer(entity);
            const layerStyle = highestLayer ? ENTITY_LAYER_STYLE[highestLayer] : null;
            return (
              <div
                key={entity.entity_id}
                className="rounded-lg px-3 py-3 flex items-start justify-between gap-3"
                style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/entities/${encodeURIComponent(entity.entity_id)}`}
                    className="text-sm font-medium hover:underline"
                    style={{ color: "var(--color-text)" }}
                  >
                    {entity.display_name || entity.entity_id}
                  </Link>
                  <p className="mt-1 truncate text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                    {entity.entity_id}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge bg={health.bg} text={health.text} label={(entity.health_status ?? "unknown").toLowerCase()} />
                    {layerStyle && highestLayer && (
                      <Badge bg={layerStyle.bg} text={layerStyle.text} label={highestLayer} />
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Link
                    href={`/lineage?entity_fqn=${encodeURIComponent(entity.entity_id)}`}
                    className="text-xs font-medium hover:underline"
                    style={{ color: "var(--color-brand)" }}
                  >
                    Open trace
                  </Link>
                  {entity.latest_run_at && (
                    <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                      {new Date(entity.latest_run_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {compact && members.length > 6 && (
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {members.length - 6} more entities are available in this product.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ManageMembersModal({
  product,
  onClose,
}: {
  product: DataProduct;
  onClose: () => void;
}) {
  const qc     = useQueryClient();
  const update = useUpdateDataProduct(product.data_product_id);
  const { data } = useEntities();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(product.entity_ids);
  const [error, setError] = useState<string | null>(null);

  const entities = useMemo(
    () => ((data?.data ?? []) as ProductMemberEntity[]).slice().sort((a, b) => (a.display_name ?? a.entity_id).localeCompare(b.display_name ?? b.entity_id)),
    [data]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entities;
    return entities.filter((entity) =>
      (entity.display_name ?? "").toLowerCase().includes(q) ||
      entity.entity_id.toLowerCase().includes(q)
    );
  }, [entities, query]);

  const toggleEntity = (entityId: string) => {
    setSelected((current) =>
      current.includes(entityId)
        ? current.filter((id) => id !== entityId)
        : [...current, entityId]
    );
  };

  const handleSave = async () => {
    if (selected.length === 0) {
      setError("Select at least one entity");
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({ entity_ids: selected });
      await qc.invalidateQueries({ queryKey: ["entities"] });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update members");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Manage members"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="w-full max-w-2xl rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-elevated)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              Manage members
            </h2>
            <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
              Add or remove entities linked to this product.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            Close
          </button>
        </div>

        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search entities…"
          className={inputCls}
          style={inputStyle}
        />

        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--color-border)" }}
        >
          <div className="max-h-[420px] overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-sm" style={{ color: "var(--color-text-muted)" }}>
                No entities match your search.
              </div>
            )}
            {filtered.map((entity, index) => {
              const checked = selected.includes(entity.entity_id);
              const health = ENTITY_HEALTH_STYLE[entity.health_status ?? "UNKNOWN"] ?? ENTITY_HEALTH_STYLE.UNKNOWN;
              const highestLayer = getEntityHighestLayer(entity);
              const layerStyle = highestLayer ? ENTITY_LAYER_STYLE[highestLayer] : null;
              return (
                <button
                  key={entity.entity_id}
                  type="button"
                  onClick={() => toggleEntity(entity.entity_id)}
                  className="w-full px-4 py-3 flex items-start gap-3 text-left"
                  style={{
                    background: checked ? "var(--color-surface-alt)" : "transparent",
                    borderTop: index === 0 ? "none" : "1px solid var(--color-border)",
                  }}
                >
                  <span
                    className="mt-0.5 flex h-4 w-4 items-center justify-center rounded"
                    style={{
                      background: checked ? "var(--color-brand)" : "transparent",
                      border: checked ? "none" : "1px solid var(--color-border)",
                    }}
                  >
                    {checked && <CheckCircle2 className="h-3 w-3 text-white" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                      {entity.display_name || entity.entity_id}
                    </p>
                    <p className="mt-1 truncate text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                      {entity.entity_id}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge bg={health.bg} text={health.text} label={(entity.health_status ?? "unknown").toLowerCase()} />
                      {layerStyle && highestLayer && (
                        <Badge bg={layerStyle.bg} text={layerStyle.text} label={highestLayer} />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-xs" style={{ color: "var(--color-error)" }}>{error}</p>}

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {selected.length} member{selected.length === 1 ? "" : "s"} selected
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={update.isPending}
              className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--color-brand)" }}
            >
              {update.isPending ? "Saving…" : "Save members"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Edit Product Modal ────────────────────────────────────────────────────────

function EditProductModal({
  product,
  onClose,
}: {
  product: DataProduct;
  onClose: () => void;
}) {
  const update = useUpdateDataProduct(product.data_product_id);
  const gaps = getProductGaps(product);
  const [form, setForm] = useState({
    display_name:   product.display_name,
    description:    product.description ?? "",
    owner:          product.owner ?? "",
    data_steward:   product.data_steward ?? "",
    domain:         product.domain ?? "",
    classification: (product.classification ?? "") as "public" | "internal" | "confidential" | "restricted" | "",
    retention_days: product.retention_days !== null ? String(product.retention_days) : "",
    sla_tier:       (product.sla_tier ?? "") as "bronze" | "silver" | "gold" | "",
  });
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.display_name.trim()) { setError("Name is required"); return; }
    const retDays = form.retention_days.trim() ? Number(form.retention_days) : null;
    if (retDays !== null && (isNaN(retDays) || retDays <= 0)) {
      setError("Retention days must be a positive number");
      return;
    }
    setError(null);
    try {
      const input: Partial<DataProductInput> = {
        display_name:   form.display_name.trim(),
        description:    form.description.trim() || undefined,
        owner:          form.owner.trim() || null,
        data_steward:   form.data_steward.trim() || null,
        domain:         form.domain.trim() || undefined,
        classification: (form.classification as "public" | "internal" | "confidential" | "restricted") || null,
        retention_days: retDays,
        sla_tier:       (form.sla_tier as "bronze" | "silver" | "gold") || null,
      };
      await update.mutateAsync(input);
      toast.success("Product saved");
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setError(msg);
      toast.error("Save failed", { description: msg });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit product"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}  
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-elevated)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Edit product
        </h2>

        {gaps.length > 0 && (
          <div
            className="rounded-xl px-3 py-2"
            style={{ background: "var(--color-warning-subtle)", border: "1px solid var(--color-warning)" }}
          >
            <p className="text-xs font-semibold" style={{ color: "var(--color-warning)" }}>
              Product completeness
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {gaps.map((gap) => (
                <span
                  key={gap}
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: "var(--color-warning-subtle)", color: "var(--color-warning)" }}
                >
                  {gap}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Display name</label>
          <input value={form.display_name} onChange={set("display_name")} className={inputCls} style={inputStyle} />
        </div>

        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Description</label>
          <textarea value={form.description} onChange={set("description")} rows={3} className={inputCls + " resize-none"} style={inputStyle} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Owner</label>
            <input value={form.owner} onChange={set("owner")} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Data steward</label>
            <input value={form.data_steward} onChange={set("data_steward")} className={inputCls} style={inputStyle} placeholder="e.g. jane.doe@bank.nl" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Domain</label>
            <input value={form.domain} onChange={set("domain")} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Retention (days)</label>
            <input type="number" value={form.retention_days} onChange={set("retention_days")} min={1} className={inputCls} style={inputStyle} placeholder="e.g. 365" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Classification</label>
            <select value={form.classification} onChange={set("classification")} className={inputCls} style={inputStyle}>
              <option value="">— Not set —</option>
              <option value="public">Public</option>
              <option value="internal">Internal</option>
              <option value="confidential">Confidential</option>
              <option value="restricted">Restricted</option>
            </select>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>SLA tier</label>
            <select value={form.sla_tier} onChange={set("sla_tier")} className={inputCls} style={inputStyle}>
              <option value="">— None —</option>
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
            </select>
          </div>
        </div>

        {error && <p className="text-xs" style={{ color: "var(--color-error)" }}>{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm"
            style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={update.isPending}
            className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "var(--color-brand)", color: "var(--color-text-on-dark)" }}
          >
            {update.isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
              : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal ─────────────────────────────────────────────────

function DeleteConfirmModal({
  product,
  onClose,
  onDeleted,
}: {
  product: DataProduct;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const del   = useDeleteDataProduct();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);
    try {
      await del.mutateAsync(product.data_product_id);
      toast.success(`"${product.display_name}" deleted`);
      onDeleted();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      setError(msg);
      toast.error("Delete failed", { description: msg });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Delete product"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-elevated)" }}
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            Delete product?
          </h2>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            <strong style={{ color: "var(--color-text)" }}>{product.display_name}</strong> and all
            associated metadata will be permanently removed. This cannot be undone.
          </p>
        </div>

        {error && <p className="text-xs" style={{ color: "var(--color-error)" }}>{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm"
            style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={del.isPending}
            className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "var(--color-error)", color: "var(--color-text-on-dark)" }}
          >
            {del.isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting…</>
              : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({
  product,
  trustScore,
  refreshing,
  onRefreshTrust,
  onManageMembers,
}: {
  product: DataProduct;
  trustScore: TrustScoreData | null;
  refreshing: boolean;
  onRefreshTrust: () => Promise<void>;
  onManageMembers: () => void;
}) {
  const slaStyle = product.sla_tier ? SLA_STYLE[product.sla_tier] : null;
  const gaps = getProductGaps(product);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 flex flex-col gap-4">
        {gaps.length > 0 && (
          <div
            className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background: "var(--color-warning-subtle)", border: "1px solid var(--color-warning)" }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" style={{ color: "var(--color-warning)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--color-warning)" }}>
                Needs attention
              </h2>
            </div>
            <p className="text-xs" style={{ color: "var(--color-warning)" }}>
              Complete the product basics so ownership and trust are clearer.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {gaps.map((gap) => (
                <span
                  key={gap}
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: "var(--color-warning-subtle)", color: "var(--color-warning)" }}
                >
                  {gap}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Details card */}
        <div
          className="rounded-xl p-4 flex flex-col gap-3"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Details</h2>
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <dt style={{ color: "var(--color-text-muted)" }}>Owner</dt>
            <dd style={{ color: "var(--color-text)" }}>{product.owner ?? "—"}</dd>
            <dt style={{ color: "var(--color-text-muted)" }}>Data steward</dt>
            <dd style={{ color: "var(--color-text)" }}>{product.data_steward ?? "—"}</dd>
            <dt style={{ color: "var(--color-text-muted)" }}>Domain</dt>
            <dd style={{ color: "var(--color-text)" }}>{product.domain ?? "—"}</dd>
            <dt style={{ color: "var(--color-text-muted)" }}>Classification</dt>
            <dd style={{ color: "var(--color-text)" }} className="capitalize">{product.classification ?? "—"}</dd>
            <dt style={{ color: "var(--color-text-muted)" }}>SLA tier</dt>
            <dd>
              {slaStyle
                ? <Badge bg={slaStyle.bg} text={slaStyle.text} label={product.sla_tier!} />
                : <span style={{ color: "var(--color-text-muted)" }}>—</span>}
            </dd>
            <dt style={{ color: "var(--color-text-muted)" }}>Retention</dt>
            <dd style={{ color: "var(--color-text)" }}>{product.retention_days ? `${product.retention_days} days` : "—"}</dd>
            <dt style={{ color: "var(--color-text-muted)" }}>Entities</dt>
            <dd style={{ color: "var(--color-text)" }}>{product.entity_count}</dd>
            <dt style={{ color: "var(--color-text-muted)" }}>Last updated</dt>
            <dd style={{ color: "var(--color-text)" }}>
              {new Date(product.updated_at).toLocaleDateString("en-GB", {
                day: "2-digit", month: "short", year: "numeric",
              })}
            </dd>
            {product.contract_ver && (
              <>
                <dt style={{ color: "var(--color-text-muted)" }}>Contract version</dt>
                <dd style={{ color: "var(--color-text)" }} className="font-mono text-xs">{product.contract_ver}</dd>
              </>
            )}
            {product.external_id && (
              <>
                <dt style={{ color: "var(--color-text-muted)" }}>External ID</dt>
                <dd style={{ color: "var(--color-text-muted)" }} className="font-mono text-xs truncate" title={product.external_id}>{product.external_id}</dd>
              </>
            )}
          </dl>
          {product.description && (
            <p
              className="text-xs leading-relaxed border-t pt-3"
              style={{ color: "var(--color-text-muted)", borderColor: "var(--color-border)" }}
            >
              {product.description}
            </p>
          )}
        </div>

        <ProductMembersPanel productId={product.data_product_id} onManageMembers={onManageMembers} />
      </div>

      {/* Trust score */}
      <div className="flex flex-col gap-2">
        {trustScore ? (
          <TrustScoreBreakdown score={trustScore.score} factors={trustScore.factors} />
        ) : (
          <div
            className="rounded-xl p-4 flex items-center justify-center"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", minHeight: 120 }}
          >
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
              <Shield className="h-4 w-4" /> Trust score unavailable
            </div>
          </div>
        )}
        <button
          onClick={onRefreshTrust}
          disabled={refreshing}
          className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-xs disabled:opacity-50"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          <RefreshCw className={"h-3 w-3" + (refreshing ? " animate-spin" : "")} />
          Recalculate trust score
        </button>
      </div>
    </div>
  );
}

// ── Incidents tab ─────────────────────────────────────────────────────────────

function IncidentsTab({ productId }: { productId: string }) {
  const { data: incidents, isLoading } = useIncidents({ product_id: productId });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/incidents?product_id=${encodeURIComponent(productId)}`}
          className="flex items-center gap-1 text-xs hover:underline"
          style={{ color: "var(--color-brand)" }}
        >
          View all issues <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          href={`/incidents?new=1&product_id=${encodeURIComponent(productId)}`}
          className="flex min-h-[var(--touch-target-min)] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium sm:min-h-0 sm:justify-start sm:py-1.5 sm:text-xs"
          style={{ background: "var(--color-brand)", color: "var(--color-text-on-dark)" }}
        >
          <Plus className="h-3.5 w-3.5" /> Report issue
        </Link>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
          <Loader2 className="h-4 w-4 animate-spin" /> Loading issues…
        </div>
      )}

      {!isLoading && (!incidents || incidents.length === 0) && (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <CheckCircle2 className="h-7 w-7 mx-auto mb-2" style={{ color: "var(--color-success)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>No open issues</p>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            This product has no recorded trust issues.
          </p>
        </div>
      )}

      {incidents?.map((inc) => {
        const sev = SEVERITY_STYLE[inc.severity] ?? SEVERITY_STYLE.low;
        const sts = STATUS_STYLE[inc.status]     ?? STATUS_STYLE.open;
        return (
          <div
            key={inc.id}
            className="flex flex-col gap-2 rounded-xl px-3 py-3 sm:flex-row sm:items-center"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <div className="flex min-w-0 items-start gap-3">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" style={{ color: sev.text }} />
              <span className="min-w-0 flex-1 text-sm sm:truncate" style={{ color: "var(--color-text)" }}>
                {inc.title}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto sm:justify-end">
              <Badge bg={sev.bg} text={sev.text} label={inc.severity} />
              <Badge bg={sts.bg} text={sts.text} label={inc.status.replace("_", " ")} />
              <span className="text-xs whitespace-nowrap" style={{ color: "var(--color-text-muted)" }}>
                {new Date(inc.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Lineage tab ───────────────────────────────────────────────────────────────

const LAYER_SEQUENCE = ["landing", "raw", "bronze", "silver", "gold"] as const;
type Layer = (typeof LAYER_SEQUENCE)[number];

const LAYER_ABBR: Record<Layer, string> = {
  landing: "L",
  raw: "R",
  bronze: "B",
  silver: "S",
  gold: "G",
};

function LayerFlowBar({ members }: { members: ProductMemberEntity[] }) {
  const countsByLayer = useMemo(() => {
    const counts: Partial<Record<Layer, number>> = {};
    for (const entity of members) {
      const highest = getEntityHighestLayer(entity) as Layer | null;
      if (highest) counts[highest] = (counts[highest] ?? 0) + 1;
    }
    return counts;
  }, [members]);

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-3"
        style={{ color: "var(--color-text-muted)" }}
      >
        Pipeline layers
      </p>
      <div className="flex items-center gap-0">
        {LAYER_SEQUENCE.map((layer, index) => {
          const count = countsByLayer[layer] ?? 0;
          const present = count > 0;
          const style = present ? ENTITY_LAYER_STYLE[layer] : null;
          return (
            <React.Fragment key={layer}>
              {index > 0 && (
                <div
                  className="flex-1 h-px min-w-[12px]"
                  style={{
                    background: present || (countsByLayer[LAYER_SEQUENCE[index - 1]] ?? 0) > 0
                      ? "var(--color-border)"
                      : "var(--color-border)",
                    opacity: present || (countsByLayer[LAYER_SEQUENCE[index - 1]] ?? 0) > 0 ? 1 : 0.35,
                  }}
                />
              )}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div
                  className="h-3 w-3 rounded-full"
                  title={present ? `${count} ${count === 1 ? "entity" : "entities"} in ${layer}` : `No entities in ${layer}`}
                  style={{
                    background: present ? style!.text : "var(--color-border)",
                    opacity: present ? 1 : 0.35,
                  }}
                />
                <span
                  className="text-[10px] font-medium hidden sm:block capitalize"
                  style={{ color: present ? "var(--color-text)" : "var(--color-text-muted)", opacity: present ? 1 : 0.5 }}
                >
                  {layer}
                </span>
                <span
                  className="text-[10px] font-medium sm:hidden"
                  style={{ color: present ? "var(--color-text)" : "var(--color-text-muted)", opacity: present ? 1 : 0.5 }}
                >
                  {LAYER_ABBR[layer]}
                </span>
                <span
                  className="text-[10px]"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {present ? count : "—"}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function LayerGroupedEntities({
  productId,
  onGoToOverview,
}: {
  productId: string;
  onGoToOverview: () => void;
}) {
  const { data, isLoading } = useEntities({ product_id: productId });

  const { grouped, unclassified } = useMemo(() => {
    const rows = (data?.data ?? []) as ProductMemberEntity[];
    const byLayer: Partial<Record<Layer, ProductMemberEntity[]>> = {};
    const unclassifiedEntities: ProductMemberEntity[] = [];

    for (const entity of rows) {
      const highestLayer = getEntityHighestLayer(entity);
      if (highestLayer) {
        byLayer[highestLayer as Layer] = [...(byLayer[highestLayer as Layer] ?? []), entity];
      } else {
        unclassifiedEntities.push(entity);
      }
    }

    const orderedGroups: { layer: Layer; entities: ProductMemberEntity[] }[] = [];
    for (let i = LAYER_SEQUENCE.length - 1; i >= 0; i--) {
      const layer = LAYER_SEQUENCE[i];
      if (byLayer[layer]?.length) {
        orderedGroups.push({
          layer,
          entities: (byLayer[layer] ?? []).sort((a, b) =>
            (a.display_name ?? a.entity_id).localeCompare(b.display_name ?? b.entity_id)
          ),
        });
      }
    }

    return { grouped: orderedGroups, unclassified: unclassifiedEntities };
  }, [data]);

  const allMembers = useMemo(
    () => (data?.data ?? []) as ProductMemberEntity[],
    [data]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl p-4 animate-pulse"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <div className="h-4 w-32 rounded mb-2" style={{ background: "var(--color-border)" }} />
            <div className="h-3 w-48 rounded" style={{ background: "var(--color-border)" }} />
          </div>
        ))}
      </div>
    );
  }

  if (allMembers.length === 0) {
    return (
      <div
        className="rounded-xl p-8 flex flex-col items-center gap-3 text-center"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <GitBranch className="h-5 w-5" style={{ color: "var(--color-text-muted)" }} />
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
            No member entities
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Add entities from the Overview tab to trace lineage.
          </p>
        </div>
        <button
          type="button"
          onClick={onGoToOverview}
          className="mt-1 flex items-center gap-1 text-xs font-medium hover:underline"
          style={{ color: "var(--color-brand)" }}
        >
          Go to Overview <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <LayerFlowBar members={allMembers} />

      {grouped.map(({ layer, entities }) => {
        const layerStyle = ENTITY_LAYER_STYLE[layer];
        return (
          <div key={layer} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: layerStyle.text }}
              >
                {layer}
              </span>
              <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                · {entities.length} {entities.length === 1 ? "entity" : "entities"}
              </span>
            </div>
            {entities.map((entity) => {
              const health = ENTITY_HEALTH_STYLE[entity.health_status ?? "UNKNOWN"] ?? ENTITY_HEALTH_STYLE.UNKNOWN;
              return (
                <div
                  key={entity.entity_id}
                  className="rounded-xl px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/entities/${encodeURIComponent(entity.entity_id)}`}
                      className="text-sm font-medium hover:underline"
                      style={{ color: "var(--color-text)" }}
                    >
                      {entity.display_name || entity.entity_id}
                    </Link>
                    <p
                      className="mt-0.5 text-[11px] truncate"
                      title={entity.entity_id}
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {entity.entity_id}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <Badge bg={layerStyle.bg} text={layerStyle.text} label={layer} />
                      <Badge bg={health.bg} text={health.text} label={(entity.health_status ?? "unknown").toLowerCase()} />
                    </div>
                  </div>
                  <Link
                    href={`/lineage?entity_fqn=${encodeURIComponent(entity.entity_id)}`}
                    className="flex items-center gap-1 text-xs font-medium hover:underline shrink-0 min-h-[var(--touch-target-min)] sm:min-h-0"
                    style={{ color: "var(--color-brand)" }}
                  >
                    Open trace <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              );
            })}
          </div>
        );
      })}

      {unclassified.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "var(--color-text-muted)" }}
            >
              Unclassified
            </span>
            <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
              · {unclassified.length} {unclassified.length === 1 ? "entity" : "entities"}
            </span>
          </div>
          {unclassified.map((entity) => {
            const health = ENTITY_HEALTH_STYLE[entity.health_status ?? "UNKNOWN"] ?? ENTITY_HEALTH_STYLE.UNKNOWN;
            return (
              <div
                key={entity.entity_id}
                className="rounded-xl px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/entities/${encodeURIComponent(entity.entity_id)}`}
                    className="text-sm font-medium hover:underline"
                    style={{ color: "var(--color-text)" }}
                  >
                    {entity.display_name || entity.entity_id}
                  </Link>
                  <p
                    className="mt-0.5 text-[11px] truncate"
                    title={entity.entity_id}
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {entity.entity_id}
                  </p>
                  <div className="mt-2">
                    <Badge bg={health.bg} text={health.text} label={(entity.health_status ?? "unknown").toLowerCase()} />
                  </div>
                </div>
                <Link
                  href={`/lineage?entity_fqn=${encodeURIComponent(entity.entity_id)}`}
                  className="flex items-center gap-1 text-xs font-medium hover:underline shrink-0 min-h-[var(--touch-target-min)] sm:min-h-0"
                  style={{ color: "var(--color-brand)" }}
                >
                  Open trace <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <div
        className="rounded-xl px-4 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Explore upstream sources and downstream consumers across all systems.
        </p>
        <Link
          href="/lineage"
          className="flex items-center justify-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg shrink-0 min-h-[var(--touch-target-min)] sm:min-h-0"
          style={{ background: "var(--color-brand)", color: "var(--color-text-on-dark)" }}
        >
          Open Lineage Explorer <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function LineageTab({
  productId,
  onGoToOverview,
}: {
  productId: string;
  onGoToOverview: () => void;
}) {
  return <LayerGroupedEntities productId={productId} onGoToOverview={onGoToOverview} />;
}

// ── Data Quality tab ──────────────────────────────────────────────────────────

const DQ_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  PASS:    { bg: "var(--color-success-subtle)", text: "var(--color-success)" },
  SUCCESS: { bg: "var(--color-success-subtle)", text: "var(--color-success)" },
  FAIL:    { bg: "var(--color-error-subtle)",   text: "var(--color-error)" },
  FAILED:  { bg: "var(--color-error-subtle)",   text: "var(--color-error)" },
  WARN:    { bg: "var(--color-warning-subtle)", text: "var(--color-warning)" },
  WARNING: { bg: "var(--color-warning-subtle)", text: "var(--color-warning)" },
  ERROR:   { bg: "var(--color-error-subtle)",   text: "var(--color-error)" },
  UNKNOWN: { bg: "var(--color-surface-alt)",    text: "var(--color-text-muted)" },
};

const DQ_CATEGORY_STYLE: Record<string, { bg: string; text: string }> = {
  schema:       { bg: "var(--color-brand-subtle)",   text: "var(--color-brand)" },
  accuracy:     { bg: "var(--color-success-subtle)", text: "var(--color-success)" },
  completeness: { bg: "var(--color-warning-subtle)", text: "var(--color-warning)" },
  freshness:    { bg: "var(--color-brand-subtle)",   text: "var(--color-brand)" },
  uniqueness:   { bg: "var(--color-success-subtle)", text: "var(--color-success)" },
  custom:       { bg: "var(--color-surface-alt)",    text: "var(--color-text-muted)" },
};

function DataQualityTab({ productId }: { productId: string }) {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  }, []);

  const { data: entitiesData } = useEntities({ product_id: productId });
  const memberFqns = useMemo(
    () => new Set(((entitiesData?.data ?? []) as ProductMemberEntity[]).map((e) => e.entity_id)),
    [entitiesData]
  );

  const { data: qualityData, isLoading } = useQuality(thirtyDaysAgo, today);

  const checks = useMemo(() => {
    const all = (qualityData?.data ?? []) as DataQualityCheck[];
    return all
      .filter((c) => memberFqns.has(c.dataset_id))
      .sort((a, b) => new Date(b.timestamp_utc).getTime() - new Date(a.timestamp_utc).getTime());
  }, [qualityData, memberFqns]);

  const filtered = useMemo(
    () => statusFilter === "all" ? checks : checks.filter((c) => c.check_status === statusFilter),
    [checks, statusFilter]
  );

  const stats = useMemo(() => {
    const total  = checks.length;
    const passed = checks.filter((c) => c.check_status === "PASS").length;
    const failed = checks.filter((c) => c.check_status === "FAIL" || c.check_status === "ERROR").length;
    const warned = checks.filter((c) => c.check_status === "WARN").length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : null;
    return { total, passed, failed, warned, passRate };
  }, [checks]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-4 flex items-start gap-3 animate-pulse"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <div className="h-5 w-14 rounded-full shrink-0" style={{ background: "var(--color-border)" }} />
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-4 w-48 rounded" style={{ background: "var(--color-border)" }} />
              <div className="h-3 w-32 rounded" style={{ background: "var(--color-border)" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (checks.length === 0) {
    return (
      <div
        className="rounded-xl p-8 flex flex-col items-center gap-3 text-center"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <CheckCircle2 className="h-5 w-5" style={{ color: "var(--color-text-muted)" }} />
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
            No quality checks found
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            No checks recorded for this product's member entities in the last 30 days.
          </p>
        </div>
        <Link
          href="/quality"
          className="flex items-center gap-1 text-xs font-medium hover:underline"
          style={{ color: "var(--color-brand)" }}
        >
          Open Data Quality <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-muted)" }}>Pass rate</p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: stats.passRate !== null && stats.passRate >= 80 ? "var(--color-success)" : "var(--color-error)" }}>
            {stats.passRate !== null ? `${stats.passRate}%` : "—"}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>Last 30 days</p>
        </div>
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-muted)" }}>Total</p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--color-text)" }}>{stats.total}</p>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>Checks run</p>
        </div>
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-muted)" }}>Failed</p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: stats.failed > 0 ? "var(--color-error)" : "var(--color-text)" }}>{stats.failed}</p>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>Fail + error</p>
        </div>
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-muted)" }}>Warnings</p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: stats.warned > 0 ? "var(--color-warning)" : "var(--color-text)" }}>{stats.warned}</p>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>Checks with warn</p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5">
        {(["all", "PASS", "FAIL", "WARN", "ERROR"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className="rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{
              background: statusFilter === s ? "var(--color-brand)" : "var(--color-surface)",
              color: statusFilter === s ? "var(--color-text-on-dark)" : "var(--color-text-muted)",
              border: statusFilter === s ? "none" : "1px solid var(--color-border)",
            }}
          >
            {s === "all" ? "All checks" : s}
          </button>
        ))}
      </div>

      {/* Check list */}
      {filtered.length === 0 && (
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No checks match this filter.</p>
        </div>
      )}

      {filtered.map((check, index) => {
        const statusStyle   = DQ_STATUS_STYLE[check.check_status] ?? DQ_STATUS_STYLE.UNKNOWN;
        const categoryStyle = { bg: "var(--color-brand-subtle)", text: "var(--color-brand)" };
        return (
          <div
            key={`${check.result_id ?? check.check_id}-${index}`}
            className="rounded-xl px-4 py-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 w-fit"
              style={{ background: categoryStyle.bg, color: categoryStyle.text }}
            >
              {check.check_category ?? "quality"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
                {check.check_name || check.check_id}
              </p>
              <p className="text-[11px] mt-0.5 truncate" title={check.dataset_id} style={{ color: "var(--color-text-muted)" }}>
                {check.dataset_id}
              </p>
              {check.message && (
                <p className="text-xs mt-1 line-clamp-1" style={{ color: "var(--color-text-muted)" }}>{check.message}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-[11px] font-semibold" style={{ color: statusStyle.text }}>
                {check.check_status}
              </span>
              <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                {new Date(check.timestamp_utc).toLocaleString("en-GB", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        );
      })}

      <div className="flex justify-end">
        <Link
          href="/quality"
          className="flex items-center gap-1 text-xs font-medium hover:underline"
          style={{ color: "var(--color-brand)" }}
        >
          Open full Data Quality view <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

// ── Evidence tab ──────────────────────────────────────────────────────────────

interface ActivityRecord {
  id: string;
  source: "pipeline_run";
  entity_fqn: string;
  status: string;
  occurred_at: string;
  label: string | null;
  detail: string | null;
}

const ACTIVITY_STATUS_STYLE: Record<string, { color: string }> = {
  SUCCESS: { color: "var(--color-success)" },
  FAILED:  { color: "var(--color-error)" },
  WARNING: { color: "var(--color-warning)" },
  RUNNING: { color: "var(--color-brand)" },
};

const EVENT_COLORS: Record<string, { bg: string; text: string }> = {
  quality_check:       { bg: "var(--color-success-subtle)", text: "var(--color-success)" },
  transformation:      { bg: "var(--color-brand-subtle)",   text: "var(--color-brand)" },
  source_snapshot:     { bg: "var(--color-brand-subtle)",   text: "var(--color-brand)" },
  approval:            { bg: "var(--color-success-subtle)", text: "var(--color-success)" },
  exception:           { bg: "var(--color-error-subtle)",   text: "var(--color-error)" },
  incident_resolved:   { bg: "var(--color-success-subtle)", text: "var(--color-success)" },
};

function summarisePayload(eventType: string, payload: Record<string, unknown>): string {
  switch (eventType) {
    case "quality_check": {
      const check  = payload.check_name ?? payload.check_id ?? "check";
      const result = payload.result ?? payload.status ?? payload.verdict;
      return result ? `${String(check)}: ${String(result)}` : String(check);
    }
    case "approval":
      return payload.approved_by ? `Approved by ${String(payload.approved_by)}` : "Approval recorded";
    case "exception":
      return payload.reason ? String(payload.reason) : "Exception recorded";
    case "incident_resolved":
      return payload.title ? `Resolved: ${String(payload.title)}` : "Incident resolved";
    default: {
      const entries = Object.entries(payload).slice(0, 3);
      return entries.length === 0 ? "—" : entries.map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
    }
  }
}

function EvidenceTab({ productId }: { productId: string }) {
  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ["product-activity", productId],
    queryFn: () =>
      fetch(`/api/products/${encodeURIComponent(productId)}/activity`)
        .then((r) => r.json())
        .then((b: { data: ActivityRecord[] }) => b.data ?? []),
    staleTime: 30_000,
    retry: 1,
  });

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ["evidence", productId],
    queryFn: () =>
      fetch(`/api/products/${encodeURIComponent(productId)}/evidence`)
        .then((r) => r.json())
        .then((b: { data: EvidenceRecord[] }) => b.data ?? []),
    staleTime: 30_000,
    retry: 1,
  });

  const activity = useMemo(() => activityData ?? [], [activityData]);
  const ledger   = useMemo(() => ledgerData   ?? [], [ledgerData]);

  const isLoading = activityLoading || ledgerLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl p-4 flex items-start gap-3 animate-pulse"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <div className="h-5 w-20 rounded-full shrink-0" style={{ background: "var(--color-border)" }} />
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-4 w-48 rounded" style={{ background: "var(--color-border)" }} />
              <div className="h-3 w-32 rounded" style={{ background: "var(--color-border)" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Activity feed ── */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Pipeline runs — last 30 days
        </h2>

        {activity.length === 0 && (
          <div
            className="rounded-xl p-6 text-center"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              No activity recorded for this product's member entities in the last 30 days.
            </p>
          </div>
        )}

        {activity.map((rec) => {
          const sourceStyle = { bg: "var(--color-brand-subtle)", text: "var(--color-brand)" };
          const statusColor = ACTIVITY_STATUS_STYLE[rec.status]?.color ?? "var(--color-text-muted)";
          const shortFqn = rec.entity_fqn.split(".").slice(-2).join(".");
          return (
            <div
              key={`${rec.id}-${rec.entity_fqn}`}
              className="rounded-xl px-4 py-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 w-fit"
                style={{ background: sourceStyle.bg, color: sourceStyle.text }}
              >
                {rec.source === "pipeline_run" ? "run" : "quality"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
                  {rec.label || shortFqn}
                </p>
                <p className="text-[11px] truncate mt-0.5" title={rec.entity_fqn} style={{ color: "var(--color-text-muted)" }}>
                  {rec.entity_fqn}
                </p>
                {rec.detail && (
                  <p className="text-xs mt-1 line-clamp-1" style={{ color: "var(--color-text-muted)" }}>{rec.detail}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[11px] font-semibold" style={{ color: statusColor }}>
                  {rec.status}
                </span>
                <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                  {new Date(rec.occurred_at).toLocaleString("en-GB", {
                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Formal evidence ledger ── */}
      {ledger.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            Formal evidence records
          </h2>
          {ledger.map((rec) => {
            const style   = EVENT_COLORS[rec.event_type] ?? { bg: "var(--color-surface-alt)", text: "var(--color-text-muted)" };
            const summary = summarisePayload(rec.event_type, rec.payload);
            return (
              <div key={rec.id} className="rounded-xl p-4 flex items-start gap-3"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold mt-0.5 shrink-0"
                  style={{ background: style.bg, color: style.text }}
                >
                  {rec.event_type.replace(/_/g, " ")}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: "var(--color-text)" }}>{summary}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                    {new Date(rec.recorded_at).toLocaleString("en-GB", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                    {rec.recorded_by && ` · ${rec.recorded_by}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ledger.length === 0 && (
        <div
          className="rounded-xl px-4 py-3 flex items-start gap-3"
          style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
        >
          <Shield className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            No formal evidence records yet. Push them via{" "}
            <code className="font-mono">POST /api/products/{"{id}"}/evidence</code>{" "}
            to build an auditable trail.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function ProductDetail({ productId }: { productId: string }) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const tab = useMemo<Tab>(() => {
    const v = searchParams.get("tab");
    return (v === "overview" || v === "incidents" || v === "lineage" || v === "quality" || v === "evidence") ? v : "overview";
  }, [searchParams]);

  const { data: productResponse, isLoading, error } = useDataProduct(productId);
  const { data: trustData }  = useTrustScore(productId);
  const refreshTrust = useRefreshTrustScore(productId);
  const { data: incidents }  = useIncidents({ product_id: productId });
  const { data: evidence } = useQuery({
    queryKey: ["product-evidence-summary", productId],
    queryFn: () =>
      fetch(`/api/products/${encodeURIComponent(productId)}/evidence`)
        .then((r) => r.json())
        .then((b: { data: EvidenceRecord[] }) => b.data ?? []),
    staleTime: 30_000,
    retry: 1,
  });

  const [showEdit,   setShowEdit]   = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showManageMembers, setShowManageMembers] = useState(false);

  const product    = (productResponse as { data?: DataProduct } | null)?.data ?? null;
  const trustScore = trustData
    ? { score: (trustData as TrustScoreData).score, factors: (trustData as TrustScoreData).factors }
    : null;

  const incidentCount = incidents?.filter((i) => i.status !== "resolved").length ?? 0;
  const criticalIncidentCount = incidents?.filter((i) => i.status !== "resolved" && i.severity === "critical").length ?? 0;
  const evidenceCount = evidence?.length ?? 0;
  const latestEvidenceAt = evidence?.[0]?.recorded_at ?? null;

  const setTab = (t: Tab) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", t);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const handleRefreshTrust = async () => {
    await refreshTrust.mutateAsync();
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--color-text-muted)" }} />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Product not found.</p>
      </div>
    );
  }

  const slaStyle = product.sla_tier ? SLA_STYLE[product.sla_tier] : null;

  return (
    <div className="page-content flex h-full flex-col overflow-x-hidden">
      {/* Breadcrumb */}
      <button
        onClick={() => router.push("/products")}
        className="flex items-center gap-1 text-xs mb-4 hover:underline w-fit"
        style={{ color: "var(--color-text-muted)" }}
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Products
      </button>

      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-medium leading-tight truncate" style={{ color: "var(--color-text)" }}>
              {product.display_name}
            </h1>
            {trustScore && <TrustScoreBadge score={trustScore.score} size="lg" />}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {product.domain && (
              <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>{product.domain}</span>
            )}
            {slaStyle && (
              <Badge bg={slaStyle.bg} text={slaStyle.text} label={product.sla_tier!} />
            )}
            {product.owner && (
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Owner: {product.owner}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-start lg:flex-shrink-0">
          <button
            onClick={() => setShowEdit(true)}
            className="flex min-h-[var(--touch-target-min)] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium sm:min-h-0 sm:justify-start sm:py-1.5 sm:text-xs"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="flex min-h-[var(--touch-target-min)] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium sm:min-h-0 sm:justify-start sm:py-1.5 sm:text-xs"
            style={{
              background: "var(--color-surface)",
              border: "1px solid #fca5a5",
              color: "var(--color-error)",
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>

      <div className="grid gap-4 mb-5 md:grid-cols-2 xl:grid-cols-4">
        <ProductSignalCard label="Open incidents" value={incidentCount} hint="Current unresolved product issues" />
        <ProductSignalCard label="Critical" value={criticalIncidentCount} hint="Highest-priority incidents" />
        <ProductSignalCard label="Evidence" value={evidenceCount} hint="Recorded evidence events" />
        <ProductSignalCard
          label="Last evidence"
          value={
            latestEvidenceAt
              ? new Date(latestEvidenceAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
              : "—"
          }
          hint="Most recent recorded product event"
        />
      </div>

      {/* Tabs */}
      <div className="mb-5 overflow-x-auto border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex min-w-max gap-1">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex min-h-[var(--touch-target-min)] items-center gap-1.5 px-3 py-2 text-sm font-medium"
              style={{
                color: tab === id ? "var(--color-brand)" : "var(--color-text-muted)",
                borderBottom: tab === id ? "2px solid var(--color-brand)" : "2px solid transparent",
                background: "transparent",
                marginBottom: "-1px",
              }}
            >
              {label}
              {id === "incidents" && incidentCount > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none"
                  style={{ background: "var(--color-error-subtle)", color: "var(--color-error)" }}
                >
                  {incidentCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === "overview"  && (
          <OverviewTab
            product={product}
            trustScore={trustScore}
            refreshing={refreshTrust.isPending}
            onRefreshTrust={handleRefreshTrust}
            onManageMembers={() => setShowManageMembers(true)}
          />
        )}
        {tab === "incidents" && <IncidentsTab productId={productId} />}
        {tab === "lineage"   && <LineageTab productId={productId} onGoToOverview={() => setTab("overview")} />}
        {tab === "quality"   && <DataQualityTab productId={productId} />}
        {tab === "evidence"  && <EvidenceTab productId={productId} />}
      </div>

      {showEdit && (
        <EditProductModal product={product} onClose={() => setShowEdit(false)} />
      )}
      {showManageMembers && (
        <ManageMembersModal
          product={product}
          onClose={() => setShowManageMembers(false)}
        />
      )}
      {showDelete && (
        <DeleteConfirmModal
          product={product}
          onClose={() => setShowDelete(false)}
          onDeleted={() => router.push("/products")}
        />
      )}
    </div>
  );
}
