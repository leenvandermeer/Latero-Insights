import { CalendarX, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  from?: string;
  to?: string;
  onRetry?: () => void;
  className?: string;
}

export function EmptyState({ from, to, onRetry, className }: EmptyStateProps) {
  const range =
    from && to
      ? from === to
        ? formatDate(from)
        : `${formatDate(from)} – ${formatDate(to)}`
      : null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border p-10 text-center",
        className
      )}
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      <div
        className="flex items-center justify-center w-12 h-12 rounded-xl"
        style={{ background: "var(--color-accent-subtle, #FDF5E4)", color: "var(--color-accent)" }}
      >
        <CalendarX className="h-6 w-6" />
      </div>

      <div className="space-y-1.5 max-w-sm">
        <p className="font-semibold text-base" style={{ color: "var(--color-text)" }}>
          No data for {range ? `this period` : "this date range"}
        </p>
        {range && (
          <p className="text-sm font-medium" style={{ color: "var(--color-accent)" }}>
            {range}
          </p>
        )}
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          No cached data was found for this period. Try selecting a different date range.
        </p>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all hover:-translate-y-px"
          style={{
            background: "var(--color-brand, #1B3B6B)",
            color: "#fff",
            boxShadow: "0 2px 8px rgba(27,59,107,0.20)",
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
