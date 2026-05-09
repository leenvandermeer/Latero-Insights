"use client";

import { useState } from "react";
import { DollarSign, TrendingUp, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface CostRecord {
  id: number;
  product_id: string;
  product_name?: string;
  period_start: string;
  period_end: string;
  cost_usd: string;
  source: "databricks" | "manual" | "estimated";
  notes: string | null;
  created_at: string;
}

interface ProductCostSummary {
  product_id: string;
  display_name: string;
  total_usd: number;
  record_count: number;
  roi_score: number | null;
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Request failed");
  return res.json() as Promise<T>;
}

const SOURCE_STYLE: Record<string, { bg: string; text: string }> = {
  databricks: { bg: "#dbeafe", text: "#1e40af" },
  manual:     { bg: "#fef9c3", text: "#a16207" },
  estimated:  { bg: "#f1f5f9", text: "#475569" },
};

// ── ROI bar ───────────────────────────────────────────────────────────────────

function RoiBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>—</span>;
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 70 ? "#16a34a" : pct >= 40 ? "#ca8a04" : "#dc2626";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--color-border)" }}>
        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs tabular-nums w-8 text-right" style={{ color }}>{pct}</span>
    </div>
  );
}

// ── Add cost modal ─────────────────────────────────────────────────────────────

function AddCostModal({ products, onClose }: {
  products: ProductCostSummary[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    product_id: products[0]?.product_id ?? "",
    period_start: new Date().toISOString().slice(0, 10),
    period_end: new Date().toISOString().slice(0, 10),
    cost_usd: "",
    source: "manual" as "databricks" | "manual" | "estimated",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["costs"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Add Cost Record</h2>

        {[
          { label: "Product", key: "product_id", type: "select", options: products.map((p) => ({ value: p.product_id, label: p.display_name })) },
          { label: "Period start", key: "period_start", type: "date" },
          { label: "Period end", key: "period_end", type: "date" },
          { label: "Cost (USD)", key: "cost_usd", type: "number" },
          { label: "Source", key: "source", type: "select", options: [
            { value: "manual", label: "Manual" },
            { value: "estimated", label: "Estimated" },
            { value: "databricks", label: "Databricks" },
          ]},
          { label: "Notes", key: "notes", type: "text" },
        ].map(({ label, key, type, options }) => (
          <div key={key}>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>{label}</label>
            {type === "select" && options ? (
              <select
                value={form[key as keyof typeof form] as string}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input
                type={type}
                value={form[key as keyof typeof form] as string}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              />
            )}
          </div>
        ))}

        {mutation.isError && (
          <p className="text-xs" style={{ color: "#dc2626" }}>Failed to save. Please try again.</p>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm"
            style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
            Cancel
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--color-brand)", color: "#fff" }}>
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function CostDashboard() {
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: costsResponse, isLoading } = useQuery({
    queryKey: ["costs"],
    queryFn: () => apiFetch<{ data: CostRecord[] }>("/api/costs")
      .then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
  });

  const records = costsResponse ?? [];

  // Aggregate per product
  const summaryMap = new Map<string, ProductCostSummary>();
  for (const rec of records) {
    const key = rec.product_id;
    if (!summaryMap.has(key)) {
      summaryMap.set(key, { product_id: key, display_name: rec.product_name ?? key, total_usd: 0, record_count: 0, roi_score: null });
    }
    const s = summaryMap.get(key)!;
    s.total_usd += parseFloat(rec.cost_usd);
    s.record_count += 1;
  }
  const summaries = Array.from(summaryMap.values());

  const totalUsd = summaries.reduce((s, p) => s + p.total_usd, 0);
  const avgRoi = null; // computed server-side on demand

  return (
    <div className="flex flex-col h-full" style={{ padding: "var(--spacing-page, 24px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>Costs & ROI</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Cost attribution and return-on-investment per data product
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
          style={{ background: "var(--color-brand)", color: "#fff" }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add record
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total cost (USD)", value: `$${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: DollarSign },
          { label: "Products tracked", value: summaries.length.toString(), icon: TrendingUp },
          { label: "Avg ROI score", value: "—", icon: TrendingUp },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <Icon className="h-4 w-4 mt-0.5" style={{ color: "var(--color-brand)" }} />
            <div>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</p>
              <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: "var(--color-text)" }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Per-product ROI table */}
      {summaries.length > 0 && (
        <div className="mb-6 rounded-xl overflow-hidden border" style={{ borderColor: "var(--color-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--color-surface)" }}>
                {["Product", "Total (USD)", "Records", "ROI score"].map((h) => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-medium"
                    style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaries.map((p) => (
                <tr key={p.product_id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--color-text)" }}>{p.display_name}</td>
                  <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--color-text)" }}>
                    ${p.total_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--color-text-muted)" }}>{p.record_count}</td>
                  <td className="px-4 py-2.5 w-40"><RoiBar score={p.roi_score} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cost records */}
      <div>
        <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--color-text)" }}>All records</h2>
        {isLoading && <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</p>}
        {!isLoading && records.length === 0 && (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No cost records yet.</p>
        )}
        <div className="flex flex-col gap-2">
          {records.map((rec) => {
            const style = SOURCE_STYLE[rec.source] ?? SOURCE_STYLE.estimated;
            return (
              <div key={rec.id} className="rounded-xl p-4 flex items-start gap-3"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                  style={{ background: style.bg, color: style.text }}>
                  {rec.source}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                    {rec.product_name ?? rec.product_id}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {new Date(rec.period_start).toLocaleDateString()} – {new Date(rec.period_end).toLocaleDateString()}
                    {rec.notes && ` · ${rec.notes}`}
                  </p>
                </div>
                <p className="text-sm font-bold tabular-nums" style={{ color: "var(--color-text)" }}>
                  ${parseFloat(rec.cost_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {showAddModal && (
        <AddCostModal
          products={summaries}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
