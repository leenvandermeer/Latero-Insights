"use client";

import { useMemo, useState } from "react";
import { Search, ArrowRight } from "lucide-react";
import type { LineageAttribute } from "@/lib/adapters/types";

interface ColumnsViewProps {
  attributes: LineageAttribute[];
}

export function ColumnsView({ attributes }: ColumnsViewProps) {
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");

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
      const matchSearch =
        !q ||
        a.source_entity_fqn.toLowerCase().includes(q) ||
        a.source_attribute.toLowerCase().includes(q) ||
        a.target_entity_fqn.toLowerCase().includes(q) ||
        a.target_attribute.toLowerCase().includes(q);
      return matchEntity && matchSearch;
    });
  }, [current, search, entityFilter]);

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
          {filtered.length} kolom-flow{filtered.length !== 1 ? "s" : ""}
          {current.length !== filtered.length && ` van ${current.length}`}
        </span>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Entity filter */}
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="text-xs rounded-lg px-2.5 py-1.5 outline-none max-w-[220px]"
            style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          >
            <option value="all">Alle bronentiteiten</option>
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
              placeholder="Zoek attribuut of entiteit…"
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
                ? "Geen kolom-lineage data beschikbaar."
                : "Geen resultaten voor dit filter."}
            </p>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ background: "var(--color-surface)", borderBottom: "2px solid var(--color-border)" }}>
                <th className="text-left px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                  Bronentiteit
                </th>
                <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                  Bronattribuut
                </th>
                <th className="px-2 py-2.5 w-6" />
                <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                  Doelentiteit
                </th>
                <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                  Doelattribuut
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
