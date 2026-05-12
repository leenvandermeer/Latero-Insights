"use client";

import { useState } from "react";
import { TrendingUp, Plus, X, ArrowRight, Search, GitBranch, Package } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Types — aligned to API responses
// ---------------------------------------------------------------------------

interface BusinessOutput {
  id: string;                                           // UUID
  installation_id: string;
  name: string;
  output_type: string;
  criticality: "low" | "medium" | "high" | "critical";
  owner_team: string | null;
  description: string | null;
  linked_product_count: number;
}

// /api/lineage/[id]/impact returns business output rows + extra fields
interface ImpactedOutput {
  id: string;
  name: string;
  output_type: string;
  criticality: "low" | "medium" | "high" | "critical";
  owner_team: string | null;
  description: string | null;
  via_product_id: string;
  min_depth: number;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CRITICALITY_STYLE: Record<string, { bg: string; text: string }> = {
  critical: { bg: "#fee2e2", text: "#b91c1c" },
  high:     { bg: "#ffedd5", text: "#c2410c" },
  medium:   { bg: "#fef9c3", text: "#a16207" },
  low:      { bg: "#f0f9ff", text: "#0369a1" },
};

// Matches VALID_OUTPUT_TYPES in /api/business-outputs/route.ts
const TYPE_LABELS: Record<string, string> = {
  kpi:       "KPI",
  dashboard: "Dashboard",
  process:   "Process",
  report:    "Report",
  risk:      "Risk",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error("Request failed");
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Create output modal
// ---------------------------------------------------------------------------

function CreateOutputModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    output_type: "report",
    criticality: "medium",
    owner_team: "",
    description: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<{ data: BusinessOutput }>("/api/business-outputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          output_type: form.output_type,
          criticality: form.criticality,
          owner_team: form.owner_team.trim() || null,
          description: form.description.trim() || null,
        }),
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
            New business output
          </h2>
          <button onClick={onClose}>
            <X className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
          </button>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="flex flex-col gap-3"
        >
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Name *</label>
            <input
              required
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. ESG Quarterly Report"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Type</label>
              <select
                value={form.output_type}
                onChange={(e) => setForm((f) => ({ ...f, output_type: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Criticality</label>
              <select
                value={form.criticality}
                onChange={(e) => setForm((f) => ({ ...f, criticality: e.target.value }))}
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
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Owner team</label>
            <input
              type="text"
              value={form.owner_team}
              onChange={(e) => setForm((f) => ({ ...f, owner_team: e.target.value }))}
              placeholder="e.g. Risk Team"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What business purpose does this output serve?"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            />
          </div>
          {mutation.isError && (
            <p className="text-xs" style={{ color: "#b91c1c" }}>Failed to create. Try again.</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm"
              style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !form.name.trim()}
              className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--color-brand)", color: "#fff" }}
            >
              {mutation.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Impact trace panel
// ---------------------------------------------------------------------------

function ImpactPanel({ entityId, onClose }: { entityId: string; onClose: () => void }) {
  const { data: results = [], isLoading } = useQuery<ImpactedOutput[]>({
    queryKey: ["entity-impact", entityId],
    queryFn: () =>
      apiFetch<{ data: ImpactedOutput[] }>(`/api/lineage/${encodeURIComponent(entityId)}/impact`)
        .then((r) => r.data ?? []),
    staleTime: 60_000,
    retry: 1,
  });

  return (
    <div
      className="fixed right-0 top-0 bottom-0 w-96 z-40 flex flex-col shadow-xl"
      style={{ background: "var(--color-surface)", borderLeft: "1px solid var(--color-border)" }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Downstream impact</p>
          <p className="text-xs truncate mt-0.5 font-mono" style={{ color: "var(--color-text-muted)" }}>
            {entityId}
          </p>
        </div>
        <button onClick={onClose} className="ml-3 shrink-0">
          <X className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <p className="px-4 py-6 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Computing impact…
          </p>
        )}
        {!isLoading && results.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 px-4 text-center">
            <GitBranch className="h-6 w-6" style={{ color: "var(--color-text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              No downstream business outputs found for this entity.
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Make sure lineage edges and product output links are configured.
            </p>
          </div>
        )}
        {results.map((r) => {
          const crit = CRITICALITY_STYLE[r.criticality] ?? CRITICALITY_STYLE.low;
          return (
            <div
              key={`${r.id}-${r.via_product_id}`}
              className="flex items-start gap-3 px-4 py-3 border-b last:border-0"
              style={{ borderColor: "var(--color-border)" }}
            >
              {/* Hop depth indicator */}
              <div
                className="shrink-0 mt-0.5 h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{ background: "var(--color-surface-subtle)", color: "var(--color-text-muted)" }}
                title={`${r.min_depth} hop${r.min_depth !== 1 ? "s" : ""} downstream`}
              >
                {r.min_depth}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                    {r.name}
                  </span>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize"
                    style={{ background: crit.bg, color: crit.text }}
                  >
                    {r.criticality}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  {TYPE_LABELS[r.output_type] ?? r.output_type}
                  {r.owner_team ? ` · ${r.owner_team}` : ""}
                </p>
                {r.description && (
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--color-text-muted)" }}>
                    {r.description}
                  </p>
                )}
                <div className="flex items-center gap-1 mt-1.5">
                  <Package className="h-3 w-3" style={{ color: "var(--color-brand)" }} />
                  <span className="text-[10px] font-mono" style={{ color: "var(--color-brand)" }}>
                    {r.via_product_id}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!isLoading && results.length > 0 && (
        <div
          className="px-4 py-2.5 border-t text-xs shrink-0"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
        >
          {results.length} affected output{results.length !== 1 ? "s" : ""}
          {" · "}max {Math.max(...results.map((r) => r.min_depth))} hop{Math.max(...results.map((r) => r.min_depth)) !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Output card
// ---------------------------------------------------------------------------

function OutputCard({ output }: { output: BusinessOutput }) {
  const crit = CRITICALITY_STYLE[output.criticality] ?? CRITICALITY_STYLE.low;
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-snug" style={{ color: "var(--color-text)" }}>
          {output.name}
        </span>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0"
          style={{ background: crit.bg, color: crit.text }}
        >
          {output.criticality}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-xs flex-wrap" style={{ color: "var(--color-text-muted)" }}>
        <span>{TYPE_LABELS[output.output_type] ?? output.output_type}</span>
        <span>·</span>
        <span>{output.linked_product_count} product{output.linked_product_count !== 1 ? "s" : ""}</span>
        {output.owner_team && (
          <>
            <span>·</span>
            <span>{output.owner_team}</span>
          </>
        )}
      </div>
      {output.description && (
        <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          {output.description}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImpactExplorer
// ---------------------------------------------------------------------------

export function ImpactExplorer() {
  const [showCreate, setShowCreate] = useState(false);
  const [entityInput, setEntityInput] = useState("");
  const [tracedEntityId, setTracedEntityId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [critFilter, setCritFilter] = useState("");

  const { data: response, isLoading } = useQuery<BusinessOutput[]>({
    queryKey: ["business-outputs", typeFilter, critFilter],
    queryFn: () => {
      const url = new URL("/api/business-outputs", window.location.origin);
      if (typeFilter) url.searchParams.set("output_type", typeFilter);
      if (critFilter) url.searchParams.set("criticality", critFilter);
      return apiFetch<{ data: BusinessOutput[] }>(url.toString()).then((r) => r.data ?? []);
    },
    staleTime: 60_000,
    retry: 1,
  });

  const outputs = response ?? [];

  function runTrace() {
    const id = entityInput.trim();
    if (id) setTracedEntityId(id);
  }

  return (
    <div className="page-content flex h-full flex-col overflow-x-hidden">
      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-2 pt-3">
        {/* Impact trace bar */}
        <div
          className="flex flex-1 min-w-0 items-center gap-2 rounded-lg px-3 py-2"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
          <input
            type="text"
            placeholder="Enter entity ID to trace downstream impact…"
            value={entityInput}
            onChange={(e) => setEntityInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runTrace()}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--color-text)" }}
          />
          {entityInput && (
            <button onClick={() => setEntityInput("")} className="shrink-0">
              <X className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
            </button>
          )}
        </div>
        <button
          onClick={runTrace}
          disabled={!entityInput.trim()}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium disabled:opacity-40"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
        >
          <ArrowRight className="h-3.5 w-3.5" />
          Trace
        </button>

        {/* Filters */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-sm px-2 py-2 rounded-lg outline-none"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
        >
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={critFilter}
          onChange={(e) => setCritFilter(e.target.value)}
          className="text-sm px-2 py-2 rounded-lg outline-none"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
        >
          <option value="">All criticality</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium ml-auto"
          style={{ background: "var(--color-brand)", color: "#fff" }}
        >
          <Plus className="h-3.5 w-3.5" />
          New output
        </button>
      </div>

      {/* Output count */}
      {!isLoading && outputs.length > 0 && (
        <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
          {outputs.length} business output{outputs.length !== 1 ? "s" : ""}
          {(typeFilter || critFilter) && (
            <button
              onClick={() => { setTypeFilter(""); setCritFilter(""); }}
              className="ml-2 font-medium"
              style={{ color: "var(--color-accent)" }}
            >
              Clear filters
            </button>
          )}
        </p>
      )}

      {/* Grid */}
      {isLoading && (
        <p className="text-sm py-4" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      )}
      {!isLoading && outputs.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <TrendingUp className="h-8 w-8" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {typeFilter || critFilter
              ? "No outputs match the current filters."
              : "No business outputs registered yet."}
          </p>
          {!typeFilter && !critFilter && (
            <button
              onClick={() => setShowCreate(true)}
              className="text-xs font-medium"
              style={{ color: "var(--color-brand)" }}
            >
              Register the first output
            </button>
          )}
        </div>
      )}
      {!isLoading && outputs.length > 0 && (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
        >
          {outputs.map((o) => (
            <OutputCard key={o.id} output={o} />
          ))}
        </div>
      )}

      {showCreate && <CreateOutputModal onClose={() => setShowCreate(false)} />}
      {tracedEntityId && (
        <ImpactPanel entityId={tracedEntityId} onClose={() => setTracedEntityId(null)} />
      )}
    </div>
  );
}
