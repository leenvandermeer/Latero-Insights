"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ArrowRight, AlertCircle, ChevronDown } from "lucide-react";
import type { LineageAttribute, LineageEntity } from "@/lib/adapters/types";
import { lineageKeyLabel } from "./lineage-utils";

interface ColumnsViewProps {
  attributes: LineageAttribute[];
  entities?: LineageEntity[];
  initialSearch?: string;
  asOf?: string;
  onOpenTrace?: () => void;
}

export function ColumnsView({ attributes, entities = [], initialSearch = "", asOf, onOpenTrace }: ColumnsViewProps) {
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");

  useEffect(() => {
    setSearch(initialSearch);
    setEntityFilter("all");
  }, [initialSearch]);

  // Only show is_current=true rows (server already filters, but belt+suspenders)
  const current = useMemo(() => attributes.filter((a) => a.is_current), [attributes]);

  // Entities that have column lineage
  const coveredFqns = useMemo(() => new Set(current.map((a) => a.source_name)), [current]);

  // All unique source entities: those from column data + all lineage entities that could be sources
  const allSourceEntities = useMemo(() => {
    const fromAttrs = current.map((a) => a.source_name);
    // Add all lineage entities that are not pure sinks (have downstream connections)
    // to surface coverage gaps
    const fromGraph = entities
      .filter((e) => e.downstream_keys.length > 0)
      .map((e) => e.name);
    return [...new Set([...fromAttrs, ...fromGraph])].sort();
  }, [current, entities]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return current.filter((a) => {
      const matchEntity = entityFilter === "all" || a.source_name === entityFilter;
      const matchSearch =
        !q ||
        a.source_name.toLowerCase().includes(q) ||
        a.source_attribute.toLowerCase().includes(q) ||
        a.target_name.toLowerCase().includes(q) ||
        a.target_attribute.toLowerCase().includes(q) ||
        (a.evidence ?? "").toLowerCase().includes(q);
      return matchEntity && matchSearch;
    });
  }, [current, search, entityFilter]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 shrink-0 flex-wrap"
        style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}
      >
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {filtered.length} column flow{filtered.length !== 1 ? "s" : ""}
          {current.length !== filtered.length && ` of ${current.length}`}
        </span>

        {current.length === 0 && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: "rgba(245,158,11,0.12)", color: "#B45309", border: "1px solid rgba(180,83,9,0.18)" }}
          >
            Evidence unavailable
          </span>
        )}

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Coverage indicator */}
          {allSourceEntities.length > 0 && (
            <span className="text-[10px] font-medium" style={{ color: "var(--color-text-muted)" }}>
              {coveredFqns.size}/{allSourceEntities.length} entities met coverage
            </span>
          )}

          {/* Entity filter */}
          <div
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 max-w-[320px]"
            style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
          >
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="bg-transparent text-xs outline-none pr-1 min-w-0 w-56"
              style={{ color: "var(--color-text)" }}
            >
              <option value="all">All source entities ({coveredFqns.size} with coverage)</option>
              {allSourceEntities.map((fqn) => {
                const hasCoverage = coveredFqns.has(fqn);
                return (
                  <option key={fqn} value={fqn} title={fqn}
                    style={{ color: hasCoverage ? "var(--color-text)" : "var(--color-text-muted)" }}
                  >
                    {lineageKeyLabel(fqn)}{hasCoverage ? "" : " (no coverage)"}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="h-3.5 w-3.5 pointer-events-none shrink-0" style={{ color: "var(--color-text-muted)" }} />
          </div>

          {/* Search */}
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
          >
            <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search attribute or entity..."
              className="bg-transparent text-xs outline-none w-56"
              style={{ color: "var(--color-text)" }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            {entityFilter !== "all" && !coveredFqns.has(entityFilter) ? (
              <>
                <AlertCircle className="h-8 w-8" style={{ color: "var(--color-text-muted)" }} />
                <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  No column lineage for {lineageKeyLabel(entityFilter)}
                </p>
                <p className="text-xs text-center max-w-xs" style={{ color: "var(--color-text-muted)" }}>
                  This entity exists in the lineage graph but column-level mappings have not been synced yet.
                  Column lineage is derived from the source system and may not be available for all entities.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  {current.length === 0
                    ? "No column lineage evidence available"
                    : "No results for this filter."}
                </p>
                <p className="max-w-sm text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {current.length === 0
                    ? "Entity and dataset lineage are still available, but this tenant currently has no synced attribute-level mappings."
                    : "Try broadening the current filters or return to Advanced Trace to inspect a different entity path."}
                </p>
                {onOpenTrace && (
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={onOpenTrace}
                      className="rounded-lg px-3 py-2 text-xs font-semibold"
                      style={{ background: "var(--color-brand)", color: "#fff" }}
                    >
                      Back to Advanced Trace
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ background: "var(--color-surface)", borderBottom: "2px solid var(--color-border)" }}>
                <th className="text-left px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                  Source entity
                </th>
                <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                  Source attribute
                </th>
                <th className="px-2 py-2.5 w-6" />
                <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                  Target entity
                </th>
                <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                  Target attribute
                </th>
                <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                  Provenance
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr
                  key={i}
                  style={{
                        borderBottom: "1px solid var(--color-border)",
                    background: i % 2 === 0 ? "var(--color-card)" : "var(--color-surface)",
                  }}
                  className="transition-colors hover:bg-muted/40"
                >
                  <td className="px-4 py-2.5">
                    <span
                      className="font-mono text-[11px] rounded px-1.5 py-0.5"
                      style={{ background: "rgba(128,128,128,0.08)", color: "var(--color-text-muted)" }}
                      title={a.source_name}
                    >
                      {lineageKeyLabel(a.source_name)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono font-medium" style={{ color: "var(--color-accent)" }}>
                      {a.source_attribute}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <ArrowRight className="h-3.5 w-3.5 inline-block" style={{ color: "var(--color-text-muted)" }} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className="font-mono text-[11px] rounded px-1.5 py-0.5"
                      style={{ background: "rgba(128,128,128,0.08)", color: "var(--color-text-muted)" }}
                      title={a.target_name}
                    >
                      {lineageKeyLabel(a.target_name)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono font-medium" style={{ color: "var(--color-text)" }}>
                      {a.target_attribute}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={asOf
                        ? { background: "rgba(245,158,11,0.12)", color: "#B45309" }
                        : { background: "rgba(16,185,129,0.14)", color: "#047857" }}
                      title={asOf ? `Valid from ${a.valid_from ?? "unknown"}` : (a.evidence ?? "")}
                    >
                      {asOf ? `As of ${asOf}` : "Current mapping"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
