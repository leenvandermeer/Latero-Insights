"use client";

import { useState, useEffect } from "react";
import { X, Code } from "lucide-react";
import { Button } from "@/components/ui";
import { useFieldValues } from "@/hooks";
import {
  DATA_SOURCE_LABELS,
  DATA_SOURCE_FIELDS,
  FIELD_LABELS,
  NUMERIC_FIELDS,
} from "@/lib/query-engine";
import { getWidgetDef } from "./registry";
import type {
  CustomWidget,
  SharedWidgetDef,
  QueryFilter,
  WidgetSlot,
  DataSource,
  MeasureType,
  VisualType,
  GroupBy,
} from "@/types/dashboard";

// Unified shape for anything that can be edited in the panel
type AnyEditableWidget = Pick<CustomWidget | SharedWidgetDef,
  "id" | "label" | "description" | "templateType" | "category"
> & {
  queryConfig?: CustomWidget["queryConfig"];
  visualType?: VisualType;
};

const DATA_SOURCES: DataSource[] = ["pipeline_runs", "data_quality_checks", "data_lineage"];
const MEASURE_TYPES: MeasureType[] = ["count", "count_where", "percentage", "avg"];
const VISUAL_TYPES: VisualType[] = ["counter", "bar", "line", "area", "donut", "table"];
const VISUAL_LABELS: Record<VisualType, string> = {
  counter: "Counter",
  bar: "Bar chart",
  line: "Line chart",
  area: "Area chart",
  donut: "Donut chart",
  table: "Table",
};
const MEASURE_LABELS: Record<MeasureType, string> = {
  count: "Count",
  count_where: "Count where",
  percentage: "Percentage",
  avg: "Average",
};
const FILTER_OPERATORS: QueryFilter["operator"][] = ["eq", "neq", "contains", "gt", "lt"];
const OPERATOR_LABELS: Record<QueryFilter["operator"], string> = {
  eq: "is",
  neq: "is not",
  contains: "contains",
  gt: "greater than",
  lt: "less than",
};

type EditableWidgetDraft = {
  label: string;
  description?: string;
  queryConfig: CustomWidget["queryConfig"];
  visualType: CustomWidget["visualType"];
};

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
  if (typeof visualType !== "string" || !VISUAL_TYPES.includes(visualType as VisualType)) return { error: "Field 'visualType' is invalid." };
  if (!isRecord(queryConfig)) return { error: "Field 'queryConfig' must be an object." };

  if (typeof queryConfig.dataSource !== "string" || !DATA_SOURCES.includes(queryConfig.dataSource as DataSource)) {
    return { error: "Field 'queryConfig.dataSource' is invalid." };
  }
  if (!isRecord(queryConfig.measure)) return { error: "Field 'queryConfig.measure' must be an object." };
  if (typeof queryConfig.measure.type !== "string" || !MEASURE_TYPES.includes(queryConfig.measure.type as MeasureType)) {
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
      {children}
    </label>
  );
}

function PanelSelect({ value, onChange, children }: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
      style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
    >
      {children}
    </select>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface WidgetConfigPanelProps {
  widget: WidgetSlot | null;
  currentSize?: { w: number; h: number };
  editableWidget?: AnyEditableWidget;
  isSharedWidget?: boolean;
  impactCount?: number;
  onClose: () => void;
  onSave: (instanceId: string, patch: Partial<Pick<WidgetSlot, "titleOverride" | "dateFrom" | "dateTo">>, size?: { w: number; h: number }) => void;
  onUpdateWidget?: (id: string, patch: Partial<Pick<AnyEditableWidget, "label" | "description" | "queryConfig" | "visualType">>) => Promise<void> | void;
}

export function WidgetConfigPanel({ widget, editableWidget, isSharedWidget = false, impactCount = 1, onClose, onSave, onUpdateWidget }: WidgetConfigPanelProps) {
  const customWidget = editableWidget;
  const open = widget !== null;
  const { getValues } = useFieldValues();

  // ── Instance settings ──────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [overrideDate, setOverrideDate] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ── Form editing state for custom widget ───────────────────────────────────
  const [formLabel, setFormLabel] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDataSource, setFormDataSource] = useState<DataSource>("pipeline_runs");
  const [formMeasureType, setFormMeasureType] = useState<MeasureType>("count");
  const [formMeasureField, setFormMeasureField] = useState("");
  const [formWhereField, setFormWhereField] = useState("");
  const [formWhereValue, setFormWhereValue] = useState("");
  const [formGroupByField, setFormGroupByField] = useState("");
  const [formTimeGrain, setFormTimeGrain] = useState<GroupBy["timeGrain"]>("day");
  const [formVisualType, setFormVisualType] = useState<VisualType>("counter");
  const [formFilters, setFormFilters] = useState<QueryFilter[]>([]);

  // ── JSON mode ──────────────────────────────────────────────────────────────
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const fields = DATA_SOURCE_FIELDS[formDataSource] ?? [];
  const numericFields = NUMERIC_FIELDS[formDataSource] ?? [];

  const needsField = formMeasureType === "avg";
  const needsWhere = formMeasureType === "count_where" || formMeasureType === "percentage";

  // ── Populate from widget slot ──────────────────────────────────────────────
  useEffect(() => {
    if (widget) {
      setTitle(widget.titleOverride ?? "");
      setOverrideDate(Boolean(widget.dateFrom));
      setDateFrom(widget.dateFrom ?? "");
      setDateTo(widget.dateTo ?? "");
    }
  }, [widget]);

  // ── Populate form from customWidget ────────────────────────────────────────
  useEffect(() => {
    if (!customWidget) {
      setJsonMode(false);
      setJsonDraft("");
      setJsonError(null);
      return;
    }
    setFormLabel(customWidget.label);
    setFormDescription(customWidget.description ?? "");
    if (customWidget.queryConfig) {
      setFormDataSource(customWidget.queryConfig.dataSource);
      setFormMeasureType(customWidget.queryConfig.measure.type);
      setFormMeasureField(customWidget.queryConfig.measure.field ?? "");
      setFormWhereField(customWidget.queryConfig.measure.whereField ?? "");
      setFormWhereValue(customWidget.queryConfig.measure.whereValue ?? "");
      setFormGroupByField(customWidget.queryConfig.groupBy?.field ?? "");
      setFormTimeGrain(customWidget.queryConfig.groupBy?.timeGrain ?? "day");
      setFormFilters(customWidget.queryConfig.filters ?? []);
    }
    setFormVisualType(customWidget.visualType ?? "counter");
    setJsonMode(false);
    setJsonDraft(buildJsonDraft(customWidget));
    setJsonError(null);
  }, [customWidget]);

  // ── JSON draft helpers ─────────────────────────────────────────────────────
  function buildJsonDraft(cw: AnyEditableWidget): string {
    return JSON.stringify({
      label: cw.label,
      ...(cw.description ? { description: cw.description } : {}),
      queryConfig: cw.queryConfig,
      visualType: cw.visualType,
    }, null, 2);
  }

  function buildFormDraft(): EditableWidgetDraft {
    return {
      label: formLabel.trim(),
      ...(formDescription.trim() ? { description: formDescription.trim() } : {}),
      visualType: formVisualType,
      queryConfig: {
        dataSource: formDataSource,
        measure: {
          type: formMeasureType,
          ...(needsField && formMeasureField ? { field: formMeasureField } : {}),
          ...(needsWhere && formWhereField ? { whereField: formWhereField, whereValue: formWhereValue } : {}),
        },
        groupBy: formGroupByField ? { field: formGroupByField, ...(formGroupByField === "event_date" ? { timeGrain: formTimeGrain } : {}) } : undefined,
        filters: formFilters,
      },
    };
  }

  // ── Sync JSON editor from form ─────────────────────────────────────────────
  const syncJsonFromForm = () => {
    setJsonDraft(JSON.stringify(buildFormDraft(), null, 2));
    setJsonError(null);
  };

  const applyJsonToForm = () => {
    const parsed = parseEditableWidgetDraft(jsonDraft);
    if (!parsed.data) { setJsonError(parsed.error ?? "Invalid JSON."); return; }
    const d = parsed.data;
    setFormLabel(d.label);
    setFormDescription(d.description ?? "");
    setFormDataSource(d.queryConfig.dataSource);
    setFormMeasureType(d.queryConfig.measure.type);
    setFormMeasureField(d.queryConfig.measure.field ?? "");
    setFormWhereField(d.queryConfig.measure.whereField ?? "");
    setFormWhereValue(d.queryConfig.measure.whereValue ?? "");
    setFormGroupByField(d.queryConfig.groupBy?.field ?? "");
    setFormTimeGrain(d.queryConfig.groupBy?.timeGrain ?? "day");
    setFormVisualType(d.visualType);
    setFormFilters(d.queryConfig.filters);
    setJsonError(null);
  };

  // ── Filter helpers ─────────────────────────────────────────────────────────
  const addFilter = () => setFormFilters((prev) => [...prev, { field: fields[0] ?? "", operator: "eq", value: "" }]);
  const updateFilter = (i: number, patch: Partial<QueryFilter>) =>
    setFormFilters((prev) => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  const removeFilter = (i: number) => setFormFilters((prev) => prev.filter((_, idx) => idx !== i));

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!widget) return;

    if (customWidget && onUpdateWidget) {
      if (customWidget.templateType) {
        // Template widgets: only label + description are configurable
        const label = formLabel.trim();
        if (label) {
          await onUpdateWidget(customWidget.id, {
            label,
            description: formDescription.trim() || undefined,
          });
        }
      } else if (customWidget.queryConfig) {
        // Data-driven widgets: update full definition
        let draft: EditableWidgetDraft;
        if (jsonMode) {
          const parsed = parseEditableWidgetDraft(jsonDraft);
          if (!parsed.data) { setJsonError(parsed.error ?? "Invalid JSON configuration."); return; }
          draft = parsed.data;
        } else {
          draft = buildFormDraft();
          if (!draft.label) return;
        }
        await onUpdateWidget(customWidget.id, {
          label: draft.label,
          description: draft.description,
          queryConfig: draft.queryConfig,
          visualType: draft.visualType,
        });
        setJsonError(null);
      }
    }

    onSave(widget.instanceId, {
      titleOverride: title.trim() || undefined,
      dateFrom: overrideDate && dateFrom ? dateFrom : undefined,
      dateTo: overrideDate && dateTo ? dateTo : undefined,
    });
    onClose();
  };

  // ── Derived value hints ────────────────────────────────────────────────────
  const whereValueHints = getValues(formWhereField);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden="true" />
      )}

      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width: customWidget ? "22rem" : "18rem",
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-drawer, -4px 0 24px rgba(27,59,107,0.12))",
          transition: "transform 0.2s ease-out",
          transform: open ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* Header */}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* ── Instance: title override ─────────────────────────────────── */}
          <div className="space-y-1.5">
            <PanelLabel>Custom title</PanelLabel>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Leave blank to use default"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
            />
          </div>

          {/* ── Instance: date override ──────────────────────────────────── */}
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
                  <PanelLabel>From</PanelLabel>
                  <input type="date" value={dateFrom} max={dateTo} onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
                    style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
                </div>
                <div className="space-y-1">
                  <PanelLabel>To</PanelLabel>
                  <input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)}
                    className="w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
                    style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
                </div>
              </div>
            )}
          </div>

          {/* ── Widget editing ───────────────────────────────────────────── */}
          {customWidget && (
            <div className="space-y-4">
              <div className="h-px w-full" style={{ background: "var(--color-border)" }} />

              {/* ── TEMPLATE WIDGET: editable name + type info ─────────── */}
              {customWidget.templateType && (() => {
                const regDef = getWidgetDef(customWidget.templateType!);
                return (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                      Widget
                    </p>

                    {/* Editable label */}
                    <div className="space-y-1.5">
                      <PanelLabel>Name</PanelLabel>
                      <input
                        type="text"
                        value={formLabel}
                        onChange={(e) => setFormLabel(e.target.value)}
                        placeholder="Widget name"
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                        style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                      />
                    </div>

                    {/* Editable description */}
                    <div className="space-y-1.5">
                      <PanelLabel>Description</PanelLabel>
                      <input
                        type="text"
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="Optional"
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                        style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                      />
                    </div>

                    {/* Type info card */}
                    <div
                      className="rounded-xl p-3 space-y-1.5"
                      style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
                    >
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: "var(--color-sidebar-active-bg)", color: "var(--color-sidebar-active-text)" }}>
                          {customWidget.category ?? regDef?.category ?? "template"}
                        </span>
                        {isSharedWidget && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "rgba(200,137,42,0.12)", color: "var(--color-accent)" }}>
                            shared
                          </span>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                        {regDef?.description ?? "Prebuilt template widget"}
                      </p>
                    </div>

                    {impactCount > 1 && (
                      <p className="text-xs rounded-md px-2.5 py-2" style={{ background: "rgba(200,137,42,0.12)", color: "var(--color-accent)" }}>
                        {isSharedWidget
                          ? `Shared widget — saving updates all ${impactCount} dashboards.`
                          : `Used in ${impactCount} dashboards — saving updates all usages.`}
                      </p>
                    )}

                    <p className="text-xs rounded-md px-2.5 py-2" style={{ background: "var(--color-card)", color: "var(--color-text-muted)", border: "1px dashed var(--color-border)" }}>
                      Data and logic are fixed for this widget type. Create a variant with the widget builder.
                    </p>
                  </div>
                );
              })()}

              {/* ── DATA-DRIVEN WIDGET: full form/JSON ─────────────────── */}
              {!customWidget.templateType && (
                <>
                  {/* Section header + JSON toggle */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                      Widget definition
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (!jsonMode) syncJsonFromForm();
                        setJsonMode((v) => !v);
                        setJsonError(null);
                      }}
                      className="flex items-center gap-1.5 text-xs rounded-md px-2 py-1 border"
                      style={{
                        borderColor: jsonMode ? "var(--color-accent)" : "var(--color-border)",
                        color: jsonMode ? "var(--color-accent)" : "var(--color-text-muted)",
                        background: jsonMode ? "var(--color-brand-subtle, rgba(200,137,42,0.06))" : "transparent",
                      }}
                    >
                      <Code className="h-3 w-3" />
                      {jsonMode ? "Form" : "JSON"}
                    </button>
                  </div>

                  {impactCount > 1 && (
                    <p className="text-xs rounded-md px-2.5 py-2" style={{ background: "rgba(200,137,42,0.12)", color: "var(--color-accent)" }}>
                      {isSharedWidget
                        ? `Shared widget — saving updates all ${impactCount} dashboards.`
                        : `Used in ${impactCount} dashboards — saving updates all usages.`}
                    </p>
                  )}

              {/* ── Form mode ─────────────────────────────────────────── */}
              {!jsonMode && (
                <div className="space-y-4">

                  {/* Label */}
                  <div className="space-y-1.5">
                    <PanelLabel>Name</PanelLabel>
                    <input
                      type="text"
                      value={formLabel}
                      onChange={(e) => setFormLabel(e.target.value)}
                      placeholder="Widget name"
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <PanelLabel>Description</PanelLabel>
                    <input
                      type="text"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                    />
                  </div>

                  {/* Data source */}
                  <div className="space-y-1.5">
                    <PanelLabel>Data source</PanelLabel>
                    <PanelSelect value={formDataSource} onChange={(v) => {
                      setFormDataSource(v as DataSource);
                      setFormFilters([]);
                      setFormGroupByField("");
                      setFormMeasureField("");
                      setFormWhereField("");
                      setFormWhereValue("");
                    }}>
                      {DATA_SOURCES.map((ds) => (
                        <option key={ds} value={ds}>{DATA_SOURCE_LABELS[ds] ?? ds}</option>
                      ))}
                    </PanelSelect>
                  </div>

                  {/* Measure */}
                  <div className="space-y-1.5">
                    <PanelLabel>Measure</PanelLabel>
                    <PanelSelect value={formMeasureType} onChange={(v) => setFormMeasureType(v as MeasureType)}>
                      {MEASURE_TYPES.map((m) => (
                        <option key={m} value={m}>{MEASURE_LABELS[m]}</option>
                      ))}
                    </PanelSelect>
                  </div>

                  {needsField && (
                    <div className="space-y-1.5">
                      <PanelLabel>Field to average</PanelLabel>
                      <PanelSelect value={formMeasureField} onChange={setFormMeasureField}>
                        <option value="">Select field</option>
                        {numericFields.map((f) => (
                          <option key={f} value={f}>{FIELD_LABELS[f] ?? f}</option>
                        ))}
                      </PanelSelect>
                    </div>
                  )}

                  {needsWhere && (
                    <>
                      <div className="space-y-1.5">
                        <PanelLabel>Match field</PanelLabel>
                        <PanelSelect value={formWhereField} onChange={(v) => { setFormWhereField(v); setFormWhereValue(""); }}>
                          <option value="">Select field</option>
                          {fields.map((f) => (
                            <option key={f} value={f}>{FIELD_LABELS[f] ?? f}</option>
                          ))}
                        </PanelSelect>
                      </div>
                      <div className="space-y-1.5">
                        <PanelLabel>Match value</PanelLabel>
                        {whereValueHints.length > 0 ? (
                          <select
                            value={formWhereValue}
                            onChange={(e) => setFormWhereValue(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                            style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                          >
                            <option value="">Select…</option>
                            {whereValueHints.map((h) => (
                              <option key={h.value} value={h.value}>{h.label}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={formWhereValue}
                            onChange={(e) => setFormWhereValue(e.target.value)}
                            placeholder="e.g. SUCCESS"
                            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                            style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                          />
                        )}
                      </div>
                    </>
                  )}

                  {/* Group by */}
                  <div className="space-y-1.5">
                    <PanelLabel>Group by</PanelLabel>
                    <PanelSelect value={formGroupByField} onChange={setFormGroupByField}>
                      <option value="">No grouping</option>
                      {fields.map((f) => (
                        <option key={f} value={f}>{FIELD_LABELS[f] ?? f}</option>
                      ))}
                    </PanelSelect>
                  </div>

                  {formGroupByField === "event_date" && (
                    <div className="space-y-1.5">
                      <PanelLabel>Time grain</PanelLabel>
                      <PanelSelect value={formTimeGrain ?? "day"} onChange={(v) => setFormTimeGrain(v as GroupBy["timeGrain"])}>
                        <option value="day">Daily</option>
                        <option value="week">Weekly</option>
                        <option value="month">Monthly</option>
                      </PanelSelect>
                    </div>
                  )}

                  {/* Visual type */}
                  <div className="space-y-1.5">
                    <PanelLabel>Chart type</PanelLabel>
                    <PanelSelect value={formVisualType} onChange={(v) => setFormVisualType(v as VisualType)}>
                      {VISUAL_TYPES.map((v) => (
                        <option key={v} value={v}>{VISUAL_LABELS[v]}</option>
                      ))}
                    </PanelSelect>
                  </div>

                  {/* Filters */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <PanelLabel>Filters</PanelLabel>
                      <button
                        onClick={addFilter}
                        className="text-xs rounded-lg px-2 py-1"
                        style={{ background: "var(--color-sidebar-active-bg)", color: "var(--color-sidebar-active-text)" }}
                      >
                        + Add
                      </button>
                    </div>
                    {formFilters.length === 0 && (
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>No filters</p>
                    )}
                    {formFilters.map((filter, i) => {
                      const filterHints = getValues(filter.field);
                      return (
                        <div key={i} className="space-y-1.5 rounded-lg p-2" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
                          <div className="flex items-center gap-1">
                            <select
                              value={filter.field}
                              onChange={(e) => updateFilter(i, { field: e.target.value, value: "" })}
                              className="flex-1 rounded border px-2 py-1 text-xs focus:outline-none"
                              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                            >
                              {fields.map((f) => <option key={f} value={f}>{FIELD_LABELS[f] ?? f}</option>)}
                            </select>
                            <button
                              onClick={() => removeFilter(i)}
                              className="text-xs px-1.5 py-1 rounded"
                              style={{ color: "var(--color-error, #EF4444)" }}
                            >
                              ×
                            </button>
                          </div>
                          <select
                            value={filter.operator}
                            onChange={(e) => updateFilter(i, { operator: e.target.value as QueryFilter["operator"] })}
                            className="w-full rounded border px-2 py-1 text-xs focus:outline-none"
                            style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                          >
                            {FILTER_OPERATORS.map((op) => (
                              <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                            ))}
                          </select>
                          {filterHints.length > 0 ? (
                            <select
                              value={filter.value}
                              onChange={(e) => updateFilter(i, { value: e.target.value })}
                              className="w-full rounded border px-2 py-1 text-xs focus:outline-none"
                              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                            >
                              <option value="">Select…</option>
                              {filterHints.map((h) => (
                                <option key={h.value} value={h.value}>{h.label}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={filter.value}
                              onChange={(e) => updateFilter(i, { value: e.target.value })}
                              placeholder="value"
                              className="w-full rounded border px-2 py-1 text-xs focus:outline-none"
                              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── JSON mode ──────────────────────────────────────────── */}
              {jsonMode && (
                <div className="space-y-2">
                  <textarea
                    value={jsonDraft}
                    onChange={(e) => { setJsonDraft(e.target.value); setJsonError(null); }}
                    rows={14}
                    spellCheck={false}
                    className="w-full rounded-lg border px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2"
                    style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={applyJsonToForm}
                      className="text-xs rounded-lg px-2.5 py-1.5"
                      style={{ background: "var(--color-sidebar-active-bg)", color: "var(--color-sidebar-active-text)" }}
                    >
                      Apply to form
                    </button>
                    <button
                      type="button"
                      onClick={syncJsonFromForm}
                      className="text-xs rounded-lg px-2.5 py-1.5 border"
                      style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
                    >
                      Reset from form
                    </button>
                  </div>
                  {jsonError && (
                    <p className="text-xs" style={{ color: "var(--color-error, #EF4444)" }}>{jsonError}</p>
                  )}
                  {!jsonError && jsonDraft.trim() && (() => {
                    const r = parseEditableWidgetDraft(jsonDraft);
                    return r.error
                      ? <p className="text-xs" style={{ color: "var(--color-error, #EF4444)" }}>{r.error}</p>
                      : <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>JSON is valid.</p>;
                  })()}
                </div>
              )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
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
