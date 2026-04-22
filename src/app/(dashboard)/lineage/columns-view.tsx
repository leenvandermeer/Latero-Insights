"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ArrowRight } from "lucide-react";
import type { LineageAttribute } from "@/lib/adapters/types";

interface ColumnsViewProps {
  attributes: LineageAttribute[];
  initialSearch?: string;
}

export function ColumnsView({ attributes, initialSearch = "" }: ColumnsViewProps) {
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [provenanceFilter, setProvenanceFilter] = useState("all");

  useEffect(() => {
    setSearch(initialSearch);
    setEntityFilter("all");
    setProvenanceFilter("all");
  }, [initialSearch]);

  // Only show is_current=true rows (server already filters, but belt+suspenders)
  const current = useMemo(() => attributes.filter((a) => a.is_current), [attributes]);

  const sourceEntities = useMemo(() => {
    const unique = [...new Set(current.map((a) => a.source_entity_fqn))].sort();
    return unique;
  }, [current]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return current.filter((a) => {
      const matchEntity = entityFilter === "all" || a.source_entity_fqn === entityFilter;
      const matchProvenance = provenanceFilter === "all" || (a.provenance ?? "lineage_attributes_current") === provenanceFilter;
      const matchSearch =
        !q ||
        a.source_entity_fqn.toLowerCase().includes(q) ||
        a.source_attribute.toLowerCase().includes(q) ||
        a.target_entity_fqn.toLowerCase().includes(q) ||
        a.target_attribute.toLowerCase().includes(q) ||
        (a.evidence ?? "").toLowerCase().includes(q);
      return matchEntity && matchProvenance && matchSearch;
    });
  }, [current, search, entityFilter, provenanceFilter]);

  const provenanceCounts = useMemo(() => {
    const counts = {
      lineage_attributes_current: 0,
      data_lineage_hop: 0,
    };
    for (const attribute of current) {
      const key = attribute.provenance ?? "lineage_attributes_current";
      if (key === "data_lineage_hop") counts.data_lineage_hop++;
      else counts.lineage_attributes_current++;
    }
    return counts;
  }, [current]);

  function provenanceLabel(provenance?: string) {
    return provenance === "data_lineage_hop" ? "Fallback hop" : "Current mapping";
  }

  function shortName(fqn: string) {
    const parts = fqn.split(".");
    return parts[parts.length - 1] ?? fqn;
  }

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

        <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          {provenanceCounts.lineage_attributes_current} current · {provenanceCounts.data_lineage_hop} fallback
        </span>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <select
            value={provenanceFilter}
            onChange={(e) => setProvenanceFilter(e.target.value)}
            className="text-xs rounded-lg px-2.5 py-1.5 outline-none"
            style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          >
            <option value="all">All provenance</option>
            <option value="lineage_attributes_current">Current mappings</option>
            <option value="data_lineage_hop">Fallback hops</option>
          </select>

          {/* Entity filter */}
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="text-xs rounded-lg px-2.5 py-1.5 outline-none max-w-[220px]"
            style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          >
            <option value="all">All source entities</option>
            {sourceEntities.map((e) => (
              <option key={e} value={e} title={e}>{shortName(e)}</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search attribute or entity..."
              className="text-xs rounded-lg pl-7 pr-3 py-1.5 w-52 outline-none"
              style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {current.length === 0
                ? "No column lineage data available."
                : "No results for this filter."}
            </p>
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
                      title={a.source_entity_fqn}
                    >
                      {shortName(a.source_entity_fqn)}
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
                      title={a.target_entity_fqn}
                    >
                      {shortName(a.target_entity_fqn)}
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
                      style={{
                        background: (a.provenance ?? "lineage_attributes_current") === "data_lineage_hop" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.14)",
                        color: (a.provenance ?? "lineage_attributes_current") === "data_lineage_hop" ? "#B45309" : "#047857",
                      }}
                      title={a.evidence ?? ""}
                    >
                      {provenanceLabel(a.provenance)}
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
