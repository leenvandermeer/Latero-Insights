import { Database, HardDrive, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SourceIndicatorProps {
  source: "databricks" | "cache" | "fallback";
  cachedAt?: string;
  className?: string;
}

export function SourceIndicator({ source, cachedAt, className }: SourceIndicatorProps) {
  const config = {
    databricks: {
      icon: Database,
      label: "Live",
      bg: "var(--color-success-light)",
      color: "var(--color-success)",
    },
    cache: {
      icon: HardDrive,
      label: "Cache",
      bg: "var(--color-warning-light)",
      color: "var(--color-warning)",
    },
    fallback: {
      icon: AlertTriangle,
      label: "Fallback",
      bg: "var(--color-error-light)",
      color: "var(--color-error)",
    },
  }[source];

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
        className
      )}
      style={{ backgroundColor: config.bg, color: config.color }}
      title={
        source === "fallback"
          ? `Databricks unavailable, using cached data${cachedAt ? ` from ${cachedAt}` : ""}`
          : cachedAt
            ? `Cached at ${cachedAt}`
            : undefined
      }
    >
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
    </div>
  );
}
