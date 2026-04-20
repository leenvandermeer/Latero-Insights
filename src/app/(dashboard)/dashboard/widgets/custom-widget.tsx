"use client";

import { useQuery } from "@tanstack/react-query";
import { useDashboards } from "@/contexts/dashboard-context";
import { useSharedWidgets } from "@/hooks/use-shared-widgets";
import { executeQuery, getApiEndpoint } from "@/lib/query-engine";
import { WidgetRenderer } from "./widget-renderer";
import type { QueryConfig, VisualType } from "@/types/dashboard";

interface Props {
  customWidgetId: string;
  from: string;
  to: string;
  titleOverride?: string;
}

type AnyWidgetDef = { id: string; label: string; queryConfig: QueryConfig; visualType: VisualType };

export function CustomWidgetRenderer({ customWidgetId, from, to, titleOverride }: Props) {
  const { customWidgets } = useDashboards();
  const { data: sharedWidgets = [] } = useSharedWidgets();
  const widget: AnyWidgetDef | undefined =
    customWidgets.find((w) => w.id === customWidgetId) ??
    sharedWidgets.find((w) => w.id === customWidgetId);
  const endpoint = widget ? getApiEndpoint(widget.queryConfig.dataSource) : null;

  const { data: rawData, isLoading, error } = useQuery<Record<string, unknown>[]>({
    queryKey: ["custom-widget", customWidgetId, from, to],
    queryFn: async () => {
      const res = await fetch(`${endpoint}?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json() as { data?: Record<string, unknown>[] };
      return json.data ?? (json as unknown as Record<string, unknown>[]);
    },
    enabled: !!endpoint,
  });

  if (!widget) {
    return (
      <div className="h-full flex items-center justify-center text-sm" style={{ color: "var(--color-text-muted)" }}>
        Widget not found
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full rounded-xl animate-pulse" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
    );
  }

  if (error || !rawData) {
    return (
      <div className="h-full flex items-center justify-center text-sm" style={{ color: "var(--color-error, #EF4444)" }}>
        Error loading data
      </div>
    );
  }

  const result = executeQuery(rawData, widget.queryConfig);

  return (
    <WidgetRenderer
      label={titleOverride ?? widget.label}
      visualType={widget.visualType}
      result={result}
    />
  );
}
