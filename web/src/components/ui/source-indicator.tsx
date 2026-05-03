import { Database, HardDrive, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type KnownSource = "insights-saas" | "databricks" | "cache" | "fallback" | "databricks-fallback";

interface SourceIndicatorProps {
  source: KnownSource | string;
  cachedAt?: string;
  className?: string;
}

export function SourceIndicator({ source, cachedAt, className }: SourceIndicatorProps) {
  const configs: Record<KnownSource, { icon: typeof Database; label: string; bg: string; color: string; title: string }> = {
    "insights-saas": {
      icon: Database,
      label: "Connected",
      bg: "color-mix(in srgb, var(--color-success-light) 72%, white)",
      color: "var(--color-success)",
      title: "Live data from the Insights store",
    },
    databricks: {
      icon: Database,
      label: "Live",
      bg: "var(--color-success-light)",
      color: "var(--color-success)",
      title: "Live data from Databricks",
    },
    cache: {
      icon: HardDrive,
      label: "Cache",
      bg: "var(--color-warning-light)",
      color: "var(--color-warning)",
      title: "Cached data",
    },
    fallback: {
      icon: AlertTriangle,
      label: "Fallback",
      bg: "var(--color-error-light)",
      color: "var(--color-error)",
      title: "Live source unavailable, using cached data",
    },
    "databricks-fallback": {
      icon: AlertTriangle,
      label: "Fallback",
      bg: "var(--color-error-light)",
      color: "var(--color-error)",
      title: "Databricks live read fallback",
    },
  };

  const config = configs[source as KnownSource] ?? {
    icon: AlertTriangle,
    label: source ? `Source: ${source}` : "Source unknown",
    bg: "var(--color-surface-muted)",
    color: "var(--color-text-muted)",
    title: "Unknown data source",
  };

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
          : source === "databricks-fallback"
            ? `Fallback data path${cachedAt ? ` with cache snapshot from ${cachedAt}` : ""}`
          : cachedAt
            ? `Cached at ${cachedAt}`
            : config.title
      }
    >
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
    </div>
  );
}
