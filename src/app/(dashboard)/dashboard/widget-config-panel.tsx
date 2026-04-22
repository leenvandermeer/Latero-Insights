"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui";
import type { CustomWidget, QueryFilter, WidgetSlot } from "@/types/dashboard";

type EditableWidgetDraft = {
  label: string;
  description?: string;
  queryConfig: CustomWidget["queryConfig"];
  visualType: CustomWidget["visualType"];
};

const DATA_SOURCES = ["pipeline_runs", "data_quality_checks", "data_lineage"];
const MEASURE_TYPES = ["count", "count_where", "percentage", "avg"];
const VISUAL_TYPES = ["counter", "bar", "line", "area", "donut", "table"];
const FILTER_OPERATORS: QueryFilter["operator"][] = ["eq", "neq", "contains", "gt", "lt"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseEditableWidgetDraft(input: string): { data?: EditableWidgetDraft; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return { error: "Invalid JSON syntax." };
  }
  if (!isRecord(parsed)) return { error: "Top-level JSON must be an object." };

  const { label, description, visualType, queryConfig } = parsed;
  if (typeof label !== "string" || !label.trim()) return { error: "Field 'label' is required." };
  if (description !== undefined && typeof description !== "string") return { error: "Field 'description' must be a string." };
  if (typeof visualType !== "string" || !VISUAL_TYPES.includes(visualType)) return { error: "Field 'visualType' is invalid." };
  if (!isRecord(queryConfig)) return { error: "Field 'queryConfig' must be an object." };

  if (typeof queryConfig.dataSource !== "string" || !DATA_SOURCES.includes(queryConfig.dataSource)) {
    return { error: "Field 'queryConfig.dataSource' is invalid." };
  }
  if (!isRecord(queryConfig.measure)) return { error: "Field 'queryConfig.measure' must be an object." };
  if (typeof queryConfig.measure.type !== "string" || !MEASURE_TYPES.includes(queryConfig.measure.type)) {
    return { error: "Field 'queryConfig.measure.type' is invalid." };
  }
  if (queryConfig.measure.type === "avg" && (typeof queryConfig.measure.field !== "string" || !queryConfig.measure.field.trim())) {
    return { error: "Field 'queryConfig.measure.field' is required for avg." };
  }
  if ((queryConfig.measure.type === "count_where" || queryConfig.measure.type === "percentage") && (
    typeof queryConfig.measure.whereField !== "string" || !queryConfig.measure.whereField.trim() ||
    typeof queryConfig.measure.whereValue !== "string" || !queryConfig.measure.whereValue.trim()
  )) {
    return { error: "Fields 'queryConfig.measure.whereField' and 'whereValue' are required for conditional measures." };
  }

  if (queryConfig.groupBy !== undefined) {
    if (!isRecord(queryConfig.groupBy) || typeof queryConfig.groupBy.field !== "string" || !queryConfig.groupBy.field.trim()) {
      return { error: "Field 'queryConfig.groupBy.field' must be a non-empty string." };
    }
    if (queryConfig.groupBy.timeGrain !== undefined && !["day", "week", "month"].includes(String(queryConfig.groupBy.timeGrain))) {
      return { error: "Field 'queryConfig.groupBy.timeGrain' must be one of: day, week, month." };
    }
  }

  if (!Array.isArray(queryConfig.filters)) return { error: "Field 'queryConfig.filters' must be an array." };
  for (let i = 0; i < queryConfig.filters.length; i += 1) {
    const f = queryConfig.filters[i];
    if (!isRecord(f)) return { error: `Filter ${i + 1} must be an object.` };
    if (typeof f.field !== "string" || !f.field.trim()) return { error: `Filter ${i + 1} field is required.` };
    if (typeof f.value !== "string") return { error: `Filter ${i + 1} value must be a string.` };
    if (typeof f.operator !== "string" || !FILTER_OPERATORS.includes(f.operator as QueryFilter["operator"])) {
      return { error: `Filter ${i + 1} operator is invalid.` };
    }
  }

  return { data: parsed as EditableWidgetDraft };
}

interface WidgetConfigPanelProps {
  widget: WidgetSlot | null;
  currentSize?: { w: number; h: number };
  customWidget?: CustomWidget;
  impactCount?: number;
  onClose: () => void;
  onSave: (instanceId: string, patch: Partial<Pick<WidgetSlot, "titleOverride" | "dateFrom" | "dateTo">>, size?: { w: number; h: number }) => void;
  onUpdateCustomWidget?: (id: string, patch: Partial<Pick<CustomWidget, "label" | "description" | "queryConfig" | "visualType">>) => void;
}

export function WidgetConfigPanel({ widget, customWidget, impactCount = 1, onClose, onSave, onUpdateCustomWidget }: WidgetConfigPanelProps) {
  const open = widget !== null;

  const [title, setTitle] = useState("");
  const [overrideDate, setOverrideDate] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (widget) {
      setTitle(widget.titleOverride ?? "");
      setOverrideDate(Boolean(widget.dateFrom));
      setDateFrom(widget.dateFrom ?? "");
      setDateTo(widget.dateTo ?? "");
    }
  }, [widget]);

  useEffect(() => {
    if (!customWidget) {
      setJsonEditorOpen(false);
      setJsonDraft("");
      setJsonError(null);
      return;
    }
    const initial = {
      label: customWidget.label,
      ...(customWidget.description ? { description: customWidget.description } : {}),
      queryConfig: customWidget.queryConfig,
      visualType: customWidget.visualType,
    };
    setJsonDraft(JSON.stringify(initial, null, 2));
    setJsonError(null);
  }, [customWidget]);

  const handleSave = () => {
    if (!widget) return;
    if (customWidget && jsonEditorOpen && onUpdateCustomWidget) {
      const parsed = parseEditableWidgetDraft(jsonDraft);
      if (!parsed.data) {
        setJsonError(parsed.error ?? "Invalid JSON configuration.");
        return;
      }
      onUpdateCustomWidget(customWidget.id, {
        label: parsed.data.label.trim(),
        description: parsed.data.description?.trim() || undefined,
        queryConfig: parsed.data.queryConfig,
        visualType: parsed.data.visualType,
      });
      setJsonError(null);
    }

    onSave(widget.instanceId, {
      titleOverride: title.trim() || undefined,
      dateFrom: overrideDate && dateFrom ? dateFrom : undefined,
      dateTo: overrideDate && dateTo ? dateTo : undefined,
    });
    onClose();
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden="true" />
      )}

      <div
        className="fixed top-0 right-0 h-full w-72 z-50 flex flex-col"
        style={{
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-drawer, -4px 0 24px rgba(27,59,107,0.12))",
          transition: "transform 0.2s ease-out",
          transform: open ? "translateX(0)" : "translateX(100%)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <h2 className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>Widget Settings</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 transition-colors"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              Custom title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Leave blank to use default"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                id="override-date"
                type="checkbox"
                checked={overrideDate}
                onChange={(e) => setOverrideDate(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="override-date" className="text-xs font-medium cursor-pointer" style={{ color: "var(--color-text-muted)" }}>
                Override date range
              </label>
            </div>

            {overrideDate && (
              <div className="space-y-2 pl-5">
                <div className="space-y-1">
                  <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    max={dateTo}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
                    style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>To</label>
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
                    style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                  />
                </div>
              </div>
            )}
          </div>

          {customWidget && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Custom widget definition
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setJsonEditorOpen((v) => !v);
                    setJsonError(null);
                  }}
                  className="text-xs rounded-md px-2 py-1 border"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
                >
                  {jsonEditorOpen ? "Hide JSON" : "Edit as JSON"}
                </button>
              </div>

              {impactCount > 1 && (
                <p className="text-xs rounded-md px-2.5 py-2" style={{ background: "rgba(200,137,42,0.12)", color: "var(--color-accent)" }}>
                  Impact: this custom widget is used in {impactCount} dashboards. Saving updates all usages.
                </p>
              )}

              {jsonEditorOpen && (
                <>
                  <textarea
                    value={jsonDraft}
                    onChange={(e) => {
                      setJsonDraft(e.target.value);
                      setJsonError(null);
                    }}
                    rows={10}
                    spellCheck={false}
                    className="w-full rounded-lg border px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2"
                    style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                  />
                  {(jsonError || (jsonDraft.trim() && parseEditableWidgetDraft(jsonDraft).error)) && (
                    <p className="text-xs" style={{ color: "var(--color-error, #EF4444)" }}>
                      {jsonError ?? parseEditableWidgetDraft(jsonDraft).error}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div
          className="px-5 py-4 flex gap-2 shrink-0"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <Button variant="primary" className="flex-1 justify-center py-2" onClick={handleSave}>
            Save
          </Button>
          <Button variant="secondary" className="flex-1 justify-center py-2" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
}
