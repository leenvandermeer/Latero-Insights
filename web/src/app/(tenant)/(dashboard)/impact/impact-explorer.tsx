"use client";

import { useState } from "react";
import { TrendingUp, ExternalLink, Plus, X, ArrowRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface BusinessOutput {
  id: number;
  installation_id: string;
  name: string;
  output_type: string;
  criticality: "low" | "medium" | "high" | "critical";
  owner: string | null;
  description: string | null;
  linked_product_count: number;
}

interface ImpactResult {
  entity_id: string;
  entity_name: string | null;
  product_id: string | null;
  product_name: string | null;
  output_id: number | null;
  output_name: string | null;
  hop_depth: number;
}

const CRITICALITY_STYLE: Record<string, { bg: string; text: string }> = {
  critical: { bg: "#fee2e2", text: "#b91c1c" },
  high:     { bg: "#ffedd5", text: "#c2410c" },
  medium:   { bg: "#fef9c3", text: "#a16207" },
  low:      { bg: "#f0f9ff", text: "#0369a1" },
};

const TYPE_LABELS: Record<string, string> = {
  report:     "Report",
  dashboard:  "Dashboard",
  api:        "API",
  model:      "ML Model",
  regulatory: "Regulatory",
  other:      "Other",
};

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error("Request failed");
  return res.json() as Promise<T>;
}

// ── Create Output modal ───────────────────────────────────────────────────────

function CreateOutputModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    output_type: "report",
    criticality: "medium",
    owner: "",
    description: "",
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiFetch<{ data: BusinessOutput }>("/api/business-outputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-outputs"] });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            New Business Output
          </h2>
          <button onClick={onClose}>
            <X className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(form);
          }}
          className="flex flex-col gap-3"
        >
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Name *</label>
            <input required type="text" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              placeholder="e.g. ESG Quarterly Report"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Type</label>
              <select value={form.output_type} onChange={(e) => setForm((f) => ({ ...f, output_type: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Criticality</label>
              <select value={form.criticality} onChange={(e) => setForm((f) => ({ ...f, criticality: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Owner</label>
            <input type="text" value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              placeholder="Optional"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-sm"
              style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
              Cancel
            </button>
            <button type="submit" disabled={createMutation.isPending} className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--color-brand)", color: "#fff" }}>
              {createMutation.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Impact detail panel ───────────────────────────────────────────────────────

function ImpactPanel({ entityId, onClose }: { entityId: string; onClose: () => void }) {
  const { data: response, isLoading } = useQuery({
    queryKey: ["entity-impact", entityId],
    queryFn: () => apiFetch<{ data: ImpactResult[] }>(`/api/lineage/${encodeURIComponent(entityId)}/impact`)
      .then((r) => r.data ?? []),
    staleTime: 60_000,
    retry: 1,
  });

  return (
    <div
      className="fixed right-0 top-0 bottom-0 w-96 z-40 flex flex-col"
      style={{ background: "var(--color-surface)", borderLeft: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--color-border)" }}>
        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Downstream Impact
        </span>
        <button onClick={onClose}>
          <X className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Computing impact…</p>}
        {!isLoading && (!response || response.length === 0) && (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No downstream impact found.</p>
        )}
        {response?.map((r, i) => (
          <div key={i} className="flex items-start gap-2 py-2 border-b" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex-shrink-0 mt-1 h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center"
              style={{ background: "var(--color-surface-raised)", color: "var(--color-text-muted)" }}>
              {r.hop_depth}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "var(--color-text)" }}>
                {r.entity_name ?? r.entity_id}
              </p>
              {r.product_name && (
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {r.product_name}
                </p>
              )}
              {r.output_name && (
                <div className="flex items-center gap-1 mt-0.5">
                  <ArrowRight className="h-3 w-3" style={{ color: "var(--color-brand)" }} />
                  <span className="text-xs font-medium" style={{ color: "var(--color-brand)" }}>
                    {r.output_name}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function ImpactExplorer() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [entityInput, setEntityInput] = useState("");

  const { data: response, isLoading } = useQuery({
    queryKey: ["business-outputs"],
    queryFn: () => apiFetch<{ data: BusinessOutput[] }>("/api/business-outputs").then((r) => r.data ?? []),
    staleTime: 60_000,
    retry: 1,
  });

  const outputs = response ?? [];

  return (
    <div className="page-content flex h-full flex-col overflow-x-hidden">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg font-medium leading-tight" style={{ color: "var(--color-text)" }}>Business Impact</h1>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            Business outputs and downstream impact analysis
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
          style={{ background: "var(--color-brand)", color: "#fff" }}>
          <Plus className="h-3.5 w-3.5" />
          New Output
        </button>
      </div>

      {/* Impact trace */}
      <div
        className="flex items-center gap-2 mb-6 p-3 rounded-xl"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
        <input
          type="text"
          placeholder="Enter entity ID to trace downstream impact…"
          value={entityInput}
          onChange={(e) => setEntityInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && entityInput.trim()) {
              setSelectedEntityId(entityInput.trim());
            }
          }}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--color-text)" }}
        />
        <button
          onClick={() => { if (entityInput.trim()) setSelectedEntityId(entityInput.trim()); }}
          className="text-xs px-3 py-1 rounded-lg"
          style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
        >
          Trace
        </button>
      </div>

      {/* Outputs grid */}
      {isLoading && <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</p>}
      {!isLoading && outputs.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-2">
          <TrendingUp className="h-8 w-8" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            No business outputs registered yet.
          </p>
        </div>
      )}
      {!isLoading && outputs.length > 0 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {outputs.map((o) => {
            const crit = CRITICALITY_STYLE[o.criticality] ?? CRITICALITY_STYLE.low;
            return (
              <div key={o.id}
                className="rounded-xl p-4 flex flex-col gap-2"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                    {o.name}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                    style={{ background: crit.bg, color: crit.text }}>
                    {o.criticality}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  <span>{TYPE_LABELS[o.output_type] ?? o.output_type}</span>
                  <span>·</span>
                  <span>{o.linked_product_count} product{o.linked_product_count !== 1 ? "s" : ""}</span>
                </div>
                {o.description && (
                  <p className="text-xs line-clamp-2" style={{ color: "var(--color-text-muted)" }}>
                    {o.description}
                  </p>
                )}
                {o.owner && (
                  <span className="text-xs mt-auto" style={{ color: "var(--color-text-muted)" }}>
                    Owner: {o.owner}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateOutputModal onClose={() => setShowCreate(false)} />}
      {selectedEntityId && (
        <ImpactPanel entityId={selectedEntityId} onClose={() => setSelectedEntityId(null)} />
      )}
    </div>
  );
}
