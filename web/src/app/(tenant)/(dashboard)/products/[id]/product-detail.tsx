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
import { useTrustScore } from "@/hooks/use-trust-score";
import { useIncidents } from "@/hooks/use-incidents";
import { TrustScoreBreakdown } from "@/components/trust/trust-score-breakdown";
import { TrustScoreBadge } from "@/components/trust/trust-score-badge";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "overview" | "incidents" | "lineage" | "evidence";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview",  label: "Overview" },
  { id: "incidents", label: "Incidents" },
  { id: "lineage",   label: "Lineage" },
  { id: "evidence",  label: "Evidence" },
];

const SLA_STYLE: Record<string, { bg: string; text: string }> = {
  bronze: { bg: "#fed7aa", text: "#c2410c" },
  silver: { bg: "#cffafe", text: "#0e7490" },
  gold:   { bg: "#fef9c3", text: "#a16207" },
};

const SEVERITY_STYLE: Record<string, { bg: string; text: string }> = {
  critical: { bg: "#fee2e2", text: "#b91c1c" },
  high:     { bg: "#ffedd5", text: "#c2410c" },
  medium:   { bg: "#fef9c3", text: "#a16207" },
  low:      { bg: "#f0f9ff", text: "#0369a1" },
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  open:        { bg: "#fee2e2", text: "#b91c1c" },
  in_progress: { bg: "#fef9c3", text: "#a16207" },
  resolved:    { bg: "#dcfce7", text: "#166534" },
};

interface TrustScoreData {
  score: number;
  factors: {
    has_owner: boolean;
    has_sla: boolean;
    lineage_coverage: number;
    quality_pass_rate: number;
    open_critical_incidents: number;
  };
}

interface EvidenceRecord {
  id: number;
  event_type: string;
  payload: Record<string, unknown>;
  recorded_at: string;
  recorded_by: string | null;
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
  background: "var(--color-surface-raised)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
};

// ── Edit Product Modal ────────────────────────────────────────────────────────

function EditProductModal({
  product,
  onClose,
}: {
  product: DataProduct;
  onClose: () => void;
}) {
  const update = useUpdateDataProduct(product.data_product_id);
  const [form, setForm] = useState({
    display_name: product.display_name,
    description:  product.description ?? "",
    owner:        product.owner ?? "",
    domain:       product.domain ?? "",
    sla_tier:     (product.sla_tier ?? "") as "bronze" | "silver" | "gold" | "",
  });
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.display_name.trim()) { setError("Name is required"); return; }
    setError(null);
    try {
      const input: Partial<DataProductInput> = {
        display_name: form.display_name.trim(),
        description:  form.description.trim() || undefined,
        owner:        form.owner.trim()        || undefined,
        domain:       form.domain.trim()       || undefined,
        sla_tier:     (form.sla_tier as "bronze" | "silver" | "gold") || null,
      };
      await update.mutateAsync(input);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Edit product
        </h2>

        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Display name</label>
          <input value={form.display_name} onChange={set("display_name")} className={inputCls} style={inputStyle} />
        </div>

        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Description</label>
          <textarea value={form.description} onChange={set("description")} rows={3} className={inputCls + " resize-none"} style={inputStyle} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Owner</label>
            <input value={form.owner} onChange={set("owner")} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Domain</label>
            <input value={form.domain} onChange={set("domain")} className={inputCls} style={inputStyle} />
          </div>
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

        {error && <p className="text-xs" style={{ color: "#b91c1c" }}>{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm"
            style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={update.isPending}
            className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "var(--color-brand)", color: "#fff" }}
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
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
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

        {error && <p className="text-xs" style={{ color: "#b91c1c" }}>{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm"
            style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={del.isPending}
            className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "#b91c1c", color: "#fff" }}
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
}: {
  product: DataProduct;
  trustScore: TrustScoreData | null;
  refreshing: boolean;
  onRefreshTrust: () => void;
}) {
  const slaStyle = product.sla_tier ? SLA_STYLE[product.sla_tier] : null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Details card */}
      <div
        className="lg:col-span-2 rounded-xl p-4 flex flex-col gap-3"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Details</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt style={{ color: "var(--color-text-muted)" }}>Owner</dt>
          <dd style={{ color: "var(--color-text)" }}>{product.owner ?? "—"}</dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Domain</dt>
          <dd style={{ color: "var(--color-text)" }}>{product.domain ?? "—"}</dd>
          <dt style={{ color: "var(--color-text-muted)" }}>SLA tier</dt>
          <dd>
            {slaStyle
              ? <Badge bg={slaStyle.bg} text={slaStyle.text} label={product.sla_tier!} />
              : <span style={{ color: "var(--color-text-muted)" }}>—</span>}
          </dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Entities</dt>
          <dd style={{ color: "var(--color-text)" }}>{product.entity_count}</dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Last updated</dt>
          <dd style={{ color: "var(--color-text)" }}>
            {new Date(product.updated_at).toLocaleDateString("en-GB", {
              day: "2-digit", month: "short", year: "numeric",
            })}
          </dd>
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
      <div className="flex items-center justify-between">
        <Link
          href={`/incidents?product_id=${encodeURIComponent(productId)}`}
          className="text-xs hover:underline flex items-center gap-1"
          style={{ color: "var(--color-brand)" }}
        >
          View all incidents <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          href={`/incidents?new=1&product_id=${encodeURIComponent(productId)}`}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
          style={{ background: "var(--color-brand)", color: "#fff" }}
        >
          <Plus className="h-3.5 w-3.5" /> Create incident
        </Link>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
          <Loader2 className="h-4 w-4 animate-spin" /> Loading incidents…
        </div>
      )}

      {!isLoading && (!incidents || incidents.length === 0) && (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <CheckCircle2 className="h-7 w-7 mx-auto mb-2" style={{ color: "#16a34a" }} />
          <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>No open incidents</p>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            This product has no recorded incidents.
          </p>
        </div>
      )}

      {incidents?.map((inc) => {
        const sev = SEVERITY_STYLE[inc.severity] ?? SEVERITY_STYLE.low;
        const sts = STATUS_STYLE[inc.status]     ?? STATUS_STYLE.open;
        return (
          <div
            key={inc.id}
            className="flex items-center gap-3 py-2.5 px-3 rounded-xl"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: sev.text }} />
            <span className="flex-1 text-sm truncate" style={{ color: "var(--color-text)" }}>
              {inc.title}
            </span>
            <div className="flex items-center gap-1.5">
              <Badge bg={sev.bg} text={sev.text} label={inc.severity} />
              <Badge bg={sts.bg} text={sts.text} label={inc.status.replace("_", " ")} />
            </div>
            <span className="text-xs whitespace-nowrap" style={{ color: "var(--color-text-muted)" }}>
              {new Date(inc.opened_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Lineage tab ───────────────────────────────────────────────────────────────

function LineageTab({ productId }: { productId: string }) {
  return (
    <div
      className="rounded-xl p-8 flex flex-col items-center gap-4 text-center"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <GitBranch className="h-8 w-8" style={{ color: "var(--color-text-muted)" }} />
      <div>
        <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
          View lineage for this product
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          Explore upstream sources and downstream consumers in the full lineage graph.
        </p>
      </div>
      <Link
        href={`/lineage?product_id=${encodeURIComponent(productId)}`}
        className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-medium"
        style={{ background: "var(--color-brand)", color: "#fff" }}
      >
        Open lineage graph <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

// ── Evidence tab ──────────────────────────────────────────────────────────────

const EVENT_COLORS: Record<string, { bg: string; text: string }> = {
  quality_run:    { bg: "#dcfce7", text: "#166534" },
  lineage_update: { bg: "#dbeafe", text: "#1e40af" },
  policy_check:   { bg: "#fef9c3", text: "#a16207" },
  incident:       { bg: "#fee2e2", text: "#b91c1c" },
};

function summarisePayload(eventType: string, payload: Record<string, unknown>): string {
  switch (eventType) {
    case "quality_run": {
      const check  = payload.check_name ?? payload.check_id ?? "check";
      const result = payload.result ?? payload.status ?? payload.verdict;
      return result ? `${String(check)}: ${String(result)}` : String(check);
    }
    case "lineage_update": {
      const from = payload.source ?? payload.from;
      const to   = payload.target ?? payload.to;
      if (from && to) return `${String(from)} → ${String(to)}`;
      return payload.message ? String(payload.message) : "Lineage updated";
    }
    case "policy_check": {
      const policy  = payload.policy_name ?? payload.policy_id ?? "policy";
      const verdict = payload.verdict ?? payload.result;
      return verdict ? `${String(policy)}: ${String(verdict)}` : String(policy);
    }
    case "incident":
      return payload.title ? String(payload.title) : "Incident recorded";
    default: {
      const entries = Object.entries(payload).slice(0, 3);
      return entries.length === 0 ? "—" : entries.map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
    }
  }
}

function EvidenceTab({ productId }: { productId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["evidence", productId],
    queryFn: () =>
      fetch(`/api/products/${encodeURIComponent(productId)}/evidence`)
        .then((r) => r.json())
        .then((b: { data: EvidenceRecord[] }) => b.data ?? []),
    staleTime: 30_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl p-4 flex items-start gap-3 animate-pulse"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <div className="h-5 w-20 rounded-full shrink-0" style={{ background: "var(--color-border)" }} />
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-4 w-full rounded" style={{ background: "var(--color-border)" }} />
              <div className="h-3 w-32 rounded" style={{ background: "var(--color-border)" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <Shield className="h-6 w-6 mx-auto mb-2" style={{ color: "var(--color-text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No evidence records yet.</p>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          Records appear automatically as pipeline runs and quality checks complete.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {data.map((rec) => {
        const style   = EVENT_COLORS[rec.event_type] ?? { bg: "#f1f5f9", text: "#475569" };
        const summary = summarisePayload(rec.event_type, rec.payload);
        return (
          <div key={rec.id} className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium mt-0.5 shrink-0"
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
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function ProductDetail({ productId }: { productId: string }) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const qc           = useQueryClient();

  const tab = useMemo<Tab>(() => {
    const v = searchParams.get("tab");
    return (v === "overview" || v === "incidents" || v === "lineage" || v === "evidence") ? v : "overview";
  }, [searchParams]);

  const { data: productResponse, isLoading, error } = useDataProduct(productId);
  const { data: trustData }  = useTrustScore(productId);
  const { data: incidents }  = useIncidents({ product_id: productId });

  const [showEdit,   setShowEdit]   = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const product    = (productResponse as { data?: DataProduct } | null)?.data ?? null;
  const trustScore = trustData
    ? { score: (trustData as TrustScoreData).score, factors: (trustData as TrustScoreData).factors }
    : null;

  const incidentCount = incidents?.filter((i) => i.status !== "resolved").length ?? 0;

  const setTab = (t: Tab) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", t);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const handleRefreshTrust = async () => {
    setRefreshing(true);
    try {
      await fetch(`/api/products/${encodeURIComponent(productId)}/trust?refresh=true`);
      await qc.invalidateQueries({ queryKey: ["trust-score", productId] });
    } finally {
      setRefreshing(false);
    }
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
    <div className="flex flex-col h-full" style={{ padding: "var(--spacing-page, 24px)" }}>
      {/* Breadcrumb */}
      <button
        onClick={() => router.push("/products")}
        className="flex items-center gap-1 text-xs mb-4 hover:underline w-fit"
        style={{ color: "var(--color-text-muted)" }}
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Products
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold truncate" style={{ color: "var(--color-text)" }}>
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
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
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
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{
              background: "var(--color-surface)",
              border: "1px solid #fca5a5",
              color: "#b91c1c",
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b" style={{ borderColor: "var(--color-border)" }}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="px-3 py-2 text-sm font-medium flex items-center gap-1.5"
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
                style={{ background: "#fee2e2", color: "#b91c1c" }}
              >
                {incidentCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === "overview"  && (
          <OverviewTab
            product={product}
            trustScore={trustScore}
            refreshing={refreshing}
            onRefreshTrust={handleRefreshTrust}
          />
        )}
        {tab === "incidents" && <IncidentsTab productId={productId} />}
        {tab === "lineage"   && <LineageTab productId={productId} />}
        {tab === "evidence"  && <EvidenceTab productId={productId} />}
      </div>

      {showEdit && (
        <EditProductModal product={product} onClose={() => setShowEdit(false)} />
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
