"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

export interface SearchableSelectProps {
  value: string;
  options: string[];
  labels?: Record<string, string>;
  /** If provided, an "All …" entry is prepended and value "all" maps to this label. */
  allLabel?: string;
  placeholder: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
  /** Minimum trigger button width (default 160) */
  minWidth?: number;
}

export function SearchableSelect({
  value,
  options,
  labels,
  allLabel,
  placeholder,
  onChange,
  style,
  minWidth = 160,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayLabel =
    value === "all"
      ? (allLabel ?? "All")
      : (labels?.[value] ?? value).length > 20
        ? (labels?.[value] ?? value).slice(0, 18) + "…"
        : (labels?.[value] ?? value);

  const isPlaceholder = value === "all" || !value;

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q) || (labels?.[o] ?? "").toLowerCase().includes(q));
  }, [labels, options, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Element)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const allOption = allLabel ? [{ id: "all", label: allLabel }] : [];
  const optionItems = [
    ...allOption,
    ...filtered.map((o) => ({ id: o, label: labels?.[o] ?? o })),
  ];

  const handleSelect = useCallback(
    (id: string) => {
      onChange(id);
      setOpen(false);
    },
    [onChange]
  );

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 text-sm"
        style={{ ...style, minWidth, justifyContent: "space-between" }}
      >
        <span
          style={{
            color: isPlaceholder
              ? "var(--color-text-muted)"
              : "var(--color-text)",
          }}
        >
          {displayLabel}
        </span>
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0"
          style={{
            color: "var(--color-text-muted)",
            transform: open ? "rotate(180deg)" : undefined,
            transition: "transform 0.15s",
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 100,
            minWidth: 240,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(27,59,107,0.12)",
            overflow: "hidden",
          }}
        >
          {/* Search input */}
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <Search
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: "var(--color-text-muted)" }}
            />
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-transparent text-sm outline-none flex-1"
              style={{
                color: "var(--color-text)",
                caretColor: "var(--color-accent)",
              }}
            />
          </div>

          {/* Options list */}
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {optionItems.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => handleSelect(id)}
                className="w-full text-left px-3 py-2 text-sm"
                style={{
                  background:
                    value === id ? "rgba(200,137,42,0.1)" : "transparent",
                  color:
                    value === id
                      ? "var(--color-accent)"
                      : "var(--color-text)",
                  fontFamily: id !== "all" ? "monospace" : undefined,
                  fontSize: id !== "all" ? "0.75rem" : undefined,
                }}
                onMouseEnter={(e) => {
                  if (value !== id)
                    (
                      e.currentTarget as HTMLButtonElement
                    ).style.background = "var(--color-sidebar-hover)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    value === id ? "rgba(200,137,42,0.1)" : "transparent";
                }}
              >
                {label}
              </button>
            ))}
            {filtered.length === 0 && (
              <p
                className="px-3 py-2 text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                No results
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
