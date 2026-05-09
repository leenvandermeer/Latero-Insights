"use client";

import { useState } from "react";
import { BookOpen, Plus, Search, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface GlossaryTerm {
  id: number;
  installation_id: string;
  name: string;
  definition: string;
  domain: string | null;
  owner: string | null;
  status: "active" | "draft" | "deprecated";
  valid_from: string;
  valid_to: string | null;
  created_at: string;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error("Request failed");
  return res.json() as Promise<T>;
}

// ── Create modal ──────────────────────────────────────────────────────────────

function CreateTermModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    definition: "",
    domain: "",
    owner: "",
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiFetch<{ data: GlossaryTerm }>("/api/glossary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["glossary"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.definition.trim()) return;
    createMutation.mutate({
      name: form.name.trim(),
      definition: form.definition.trim(),
      domain: form.domain.trim() || "",
      owner: form.owner.trim() || "",
    });
  };

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
            New Glossary Term
          </h2>
          <button onClick={onClose}>
            <X className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {[
            { key: "name", label: "Term *", placeholder: "e.g. Active Customer" },
            { key: "definition", label: "Definition *", placeholder: "Clear, unambiguous definition…" },
            { key: "domain", label: "Domain", placeholder: "e.g. Finance" },
            { key: "owner", label: "Owner", placeholder: "e.g. data-governance@company.com" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>
                {label}
              </label>
              {key === "definition" ? (
                <textarea
                  required
                  rows={3}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                  style={{
                    background: "var(--color-surface-raised)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                  placeholder={placeholder}
                />
              ) : (
                <input
                  type="text"
                  required={key === "name"}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--color-surface-raised)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                  placeholder={placeholder}
                />
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm"
              style={{
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-muted)",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--color-brand)", color: "#fff" }}
            >
              {createMutation.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Term card ─────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  active:     { bg: "#dcfce7", text: "#166534" },
  draft:      { bg: "#f0f9ff", text: "#0369a1" },
  deprecated: { bg: "#f1f5f9", text: "#64748b" },
};

function TermCard({ term }: { term: GlossaryTerm }) {
  const sts = STATUS_STYLE[term.status] ?? STATUS_STYLE.draft;
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          {term.name}
        </span>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize whitespace-nowrap"
          style={{ background: sts.bg, color: sts.text }}
        >
          {term.status}
        </span>
      </div>
      <p className="text-xs leading-relaxed line-clamp-3" style={{ color: "var(--color-text-muted)" }}>
        {term.definition}
      </p>
      <div className="flex items-center gap-3 text-xs mt-auto" style={{ color: "var(--color-text-muted)" }}>
        {term.domain && <span>{term.domain}</span>}
        {term.owner && <span>Owner: {term.owner}</span>}
        <span className="ml-auto">
          {new Date(term.valid_from).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

// ── Hub ───────────────────────────────────────────────────────────────────────

export function GlossaryHub() {
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: response, isLoading } = useQuery({
    queryKey: ["glossary", query],
    queryFn: () => {
      const url = new URL("/api/glossary", window.location.origin);
      if (query) url.searchParams.set("q", query);
      return apiFetch<{ data: GlossaryTerm[] }>(url.toString()).then((r) => r.data);
    },
    staleTime: 30_000,
    retry: 1,
  });

  const terms = response ?? [];

  return (
    <div className="flex flex-col h-full" style={{ padding: "var(--spacing-page, 24px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
            Business Glossary
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            {terms.length} term{terms.length !== 1 ? "s" : ""} in registry
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
          style={{ background: "var(--color-brand)", color: "#fff" }}
        >
          <Plus className="h-3.5 w-3.5" />
          New Term
        </button>
      </div>

      {/* Search */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg mb-6"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
        <input
          type="text"
          placeholder="Search terms, definitions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--color-text)" }}
        />
      </div>

      {/* States */}
      {isLoading && (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      )}
      {!isLoading && terms.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-2">
          <BookOpen className="h-8 w-8" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {query ? "No terms match your search." : "No glossary terms defined yet."}
          </p>
        </div>
      )}
      {!isLoading && terms.length > 0 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {terms.map((t) => <TermCard key={t.id} term={t} />)}
        </div>
      )}

      {showCreate && <CreateTermModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
