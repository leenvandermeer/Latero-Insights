"use client";

interface SuggestedQueriesProps {
  queries: string[];
  onSelect: (q: string) => void;
}

export function SuggestedQueries({ queries, onSelect }: SuggestedQueriesProps) {
  return (
    <div className="flex flex-col gap-1">
      {queries.map((q, i) => (
        <button
          key={i}
          onClick={() => onSelect(q)}
          className="text-left text-xs px-3 py-2 rounded-lg hover:opacity-80 transition-opacity"
          style={{
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          {q}
        </button>
      ))}
    </div>
  );
}
