"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Database, BarChart2, Eye, Tag, Layers, X } from "lucide-react";
import { useFieldValues } from "@/hooks";
import { usePublishWidget } from "@/hooks/use-shared-widgets";
import { WIDGET_REGISTRY } from "@/app/(tenant)/(dashboard)/dashboard/registry";
import {
  DATA_SOURCE_LABELS,
  DATA_SOURCE_FIELDS,
  FIELD_LABELS,
  NUMERIC_FIELDS,
} from "@/lib/query-engine";
import { WidgetRenderer } from "../widgets/widget-renderer";
import { executeQuery } from "@/lib/query-engine";
import type {
  DataSource,
  MeasureType,
  VisualType,
  QueryConfig,
  QueryFilter,
  GroupBy,
  WidgetCategory,
} from "@/types/dashboard";

// ─── Shared constants ─────────────────────────────────────────────────────────

type BuilderMode = "template" | "custom";
type TemplateCategory = "all" | WidgetCategory;
type Step = 0 | 1 | 2 | 3;

const DATA_SOURCES: DataSource[] = ["pipeline_runs", "data_quality_checks", "data_lineage"];
const MEASURE_TYPES: MeasureType[] = ["count", "count_where", "percentage", "avg"];
const VISUAL_TYPES: VisualType[] = ["counter", "bar", "line", "area", "donut", "table"];
const FILTER_OPERATORS: QueryFilter["operator"][] = ["eq", "neq", "contains", "gt", "lt"];

type WidgetDraft = {
  label: string;
  description?: string;
  queryConfig: QueryConfig;
  visualType: VisualType;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseWidgetDraftJson(input: string): { data?: WidgetDraft; error?: string } {
  let parsed: unknown;
  try { parsed = JSON.parse(input); } catch { return { error: "Invalid JSON syntax." }; }
  if (!isRecord(parsed)) return { error: "Top-level JSON value must be an object." };
  const { label, description, visualType, queryConfig } = parsed;
  if (typeof label !== "string" || !label.trim()) return { error: "Field 'label' is required." };
  if (description !== undefined && typeof description !== "string") return { error: "Field 'description' must be a string when provided." };
  if (typeof visualType !== "string" || !VISUAL_TYPES.includes(visualType as VisualType)) return { error: "Field 'visualType' is invalid." };
  if (!isRecord(queryConfig)) return { error: "Field 'queryConfig' is required and must be an object." };
  const dataSource = queryConfig.dataSource;
  if (typeof dataSource !== "string" || !DATA_SOURCES.includes(dataSource as DataSource)) return { error: "Field 'queryConfig.dataSource' is invalid." };
  const measure = queryConfig.measure;
  if (!isRecord(measure)) return { error: "Field 'queryConfig.measure' must be an object." };
  const measureType = measure.type;
  if (typeof measureType !== "string" || !MEASURE_TYPES.includes(measureType as MeasureType)) return { error: "Field 'queryConfig.measure.type' is invalid." };
  if (measureType === "avg" && (typeof measure.field !== "string" || !measure.field.trim())) return { error: "Field 'queryConfig.measure.field' is required for avg." };
  if ((measureType === "count_where" || measureType === "percentage") && (
    typeof measure.whereField !== "string" || !measure.whereField.trim() ||
    typeof measure.whereValue !== "string" || !measure.whereValue.trim()
  )) return { error: "Fields 'queryConfig.measure.whereField' and 'whereValue' are required for conditional measures." };
  const groupBy = queryConfig.groupBy;
  if (groupBy !== undefined) {
    if (!isRecord(groupBy) || typeof groupBy.field !== "string" || !groupBy.field.trim()) return { error: "Field 'queryConfig.groupBy.field' must be a non-empty string when groupBy is used." };
    if (groupBy.timeGrain !== undefined && !["day", "week", "month"].includes(String(groupBy.timeGrain))) return { error: "Field 'queryConfig.groupBy.timeGrain' must be one of: day, week, month." };
  }
  const rawFilters = queryConfig.filters;
  if (!Array.isArray(rawFilters)) return { error: "Field 'queryConfig.filters' must be an array." };
  for (let i = 0; i < rawFilters.length; i++) {
    const f = rawFilters[i];
    if (!isRecord(f)) return { error: `Filter ${i + 1} must be an object.` };
    if (typeof f.field !== "string" || !f.field.trim()) return { error: `Filter ${i + 1} field is required.` };
    if (typeof f.value !== "string") return { error: `Filter ${i + 1} value must be a string.` };
    if (typeof f.operator !== "string" || !FILTER_OPERATORS.includes(f.operator as QueryFilter["operator"])) return { error: `Filter ${i + 1} operator is invalid.` };
  }
  return { data: parsed as WidgetDraft };
}

const CUSTOM_STEPS = [
  { label: "Data", icon: Database },
  { label: "Measure", icon: BarChart2 },
  { label: "Visualize", icon: Eye },
  { label: "Publish", icon: Tag },
];

const VISUAL_OPTIONS: { type: VisualType; label: string; description: string }[] = [
  { type: "counter", label: "Counter", description: "Single large number" },
  { type: "bar", label: "Bar chart", description: "Grouped bars by category" },
  { type: "line", label: "Line chart", description: "Trend over time" },
  { type: "area", label: "Area chart", description: "Filled line for volume trends" },
  { type: "donut", label: "Donut chart", description: "Proportional breakdown" },
  { type: "table", label: "Table", description: "Row-by-row data view" },
];

const MEASURE_OPTIONS: { type: MeasureType; label: string; description: string; needsField: boolean; needsWhere: boolean }[] = [
  { type: "count", label: "Count", description: "Total number of records", needsField: false, needsWhere: false },
  { type: "count_where", label: "Count where", description: "Records matching a condition", needsField: false, needsWhere: true },
  { type: "percentage", label: "Percentage", description: "Share of records matching a condition", needsField: false, needsWhere: true },
  { type: "avg", label: "Average", description: "Mean value of a numeric field", needsField: true, needsWhere: false },
];

const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "counter", label: "Counters" },
  { id: "charts", label: "Charts" },
  { id: "tables", label: "Tables" },
  { id: "overview", label: "Overview" },
];

// Map registry category names to WidgetCategory
const REGISTRY_CATEGORY_MAP: Record<string, WidgetCategory> = {
  counter: "counter",
  chart: "charts",
  table: "tables",
  overview: "overview",
};

// ─── Field selector ───────────────────────────────────────────────────────────

function FieldSelect({ fields, value, onChange, placeholder }: {
  fields: string[]; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
      style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}>
      {placeholder && <option value="">{placeholder}</option>}
      {fields.map((f) => <option key={f} value={f}>{FIELD_LABELS[f] ?? f}</option>)}
    </select>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WidgetBuilderPage() {
  const router = useRouter();
  const { mutateAsync: publishWidget, isPending: publishing } = usePublishWidget();
  const { getValues } = useFieldValues();

  // ── Mode: template vs custom ───────────────────────────────────────────────
  const [mode, setMode] = useState<BuilderMode>("template");

  // ── Template state ─────────────────────────────────────────────────────────
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateLabel, setTemplateLabel] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateNaming, setTemplateNaming] = useState(false);

  // ── Custom wizard state ────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(0);
  const [dataSource, setDataSource] = useState<DataSource>("pipeline_runs");
  const [filters, setFilters] = useState<QueryFilter[]>([]);
  const [measureType, setMeasureType] = useState<MeasureType>("count");
  const [measureField, setMeasureField] = useState("");
  const [whereField, setWhereField] = useState("");
  const [whereValue, setWhereValue] = useState("");
  const [groupByField, setGroupByField] = useState("");
  const [timeGrain, setTimeGrain] = useState<GroupBy["timeGrain"]>("day");
  const [visualType, setVisualType] = useState<VisualType>("bar");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fields = DATA_SOURCE_FIELDS[dataSource] ?? [];
  const numericFields = NUMERIC_FIELDS[dataSource] ?? [];
  const selectedMeasure = MEASURE_OPTIONS.find((m) => m.type === measureType)!;

  const queryConfig: QueryConfig = {
    dataSource,
    measure: {
      type: measureType,
      ...(selectedMeasure.needsField && measureField ? { field: measureField } : {}),
      ...(selectedMeasure.needsWhere && whereField ? { whereField, whereValue } : {}),
    },
    groupBy: groupByField ? { field: groupByField, ...(groupByField === "event_date" ? { timeGrain } : {}) } : undefined,
    filters,
  };

  const formDraft: WidgetDraft = useMemo(() => ({
    label: label.trim(),
    ...(description.trim() ? { description: description.trim() } : {}),
    visualType,
    queryConfig,
  }), [description, label, queryConfig, visualType]);

  const jsonParseResult = useMemo(
    () => (jsonEditorOpen && jsonDraft.trim() ? parseWidgetDraftJson(jsonDraft) : undefined),
    [jsonDraft, jsonEditorOpen]
  );

  const effectiveDraft = jsonParseResult?.data ?? formDraft;

  const applyDraftToForm = (draft: WidgetDraft) => {
    setLabel(draft.label);
    setDescription(draft.description ?? "");
    setDataSource(draft.queryConfig.dataSource);
    setFilters(draft.queryConfig.filters);
    setMeasureType(draft.queryConfig.measure.type);
    setMeasureField(draft.queryConfig.measure.field ?? "");
    setWhereField(draft.queryConfig.measure.whereField ?? "");
    setWhereValue(draft.queryConfig.measure.whereValue ?? "");
    setGroupByField(draft.queryConfig.groupBy?.field ?? "");
    setTimeGrain(draft.queryConfig.groupBy?.timeGrain ?? "day");
    setVisualType(draft.visualType);
  };

  const addFilter = () => setFilters((prev) => [...prev, { field: fields[0] ?? "", operator: "eq", value: "" }]);
  const updateFilter = (i: number, patch: Partial<QueryFilter>) =>
    setFilters((prev) => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  const removeFilter = (i: number) => setFilters((prev) => prev.filter((_, idx) => idx !== i));

  // ── Save handlers ──────────────────────────────────────────────────────────

  const handleSaveTemplate = async () => {
    if (!selectedTemplate || !templateLabel.trim()) return;
    const regDef = WIDGET_REGISTRY.find((w) => w.type === selectedTemplate);
    if (!regDef) return;
    setSaveError(null);
    try {
      await publishWidget({
        label: templateLabel.trim(),
        description: templateDescription.trim() || undefined,
        templateType: selectedTemplate,
        category: REGISTRY_CATEGORY_MAP[regDef.category] ?? "charts",
        defaultSize: regDef.defaultSize,
      });
      router.back();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Publish failed");
    }
  };

  const handleSaveCustom = async () => {
    setSaveError(null);
    let draftToSave = formDraft;
    if (jsonEditorOpen && jsonDraft.trim()) {
      const parsed = parseWidgetDraftJson(jsonDraft);
      if (!parsed.data) { setJsonError(parsed.error ?? "Invalid JSON configuration."); return; }
      draftToSave = parsed.data;
      setJsonError(null);
    }
    if (!draftToSave.label.trim()) return;
    const category: WidgetCategory =
      draftToSave.visualType === "counter" ? "counter"
      : draftToSave.visualType === "table" ? "tables"
      : "charts";
    try {
      await publishWidget({
        label: draftToSave.label.trim(),
        description: draftToSave.description?.trim() || undefined,
        queryConfig: draftToSave.queryConfig,
        visualType: draftToSave.visualType,
        category,
        defaultSize: { w: 3, h: draftToSave.visualType === "counter" ? 2 : 4, minW: 2, minH: 2 },
      });
      router.back();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Publish failed");
    }
  };

  const canNext = () => {
    if (step === 0) return true;
    if (step === 1) {
      if (selectedMeasure.needsField && !measureField) return false;
      if (selectedMeasure.needsWhere && (!whereField || !whereValue)) return false;
      return true;
    }
    if (step === 2) return true;
    if (jsonEditorOpen && jsonDraft.trim()) return Boolean(parseWidgetDraftJson(jsonDraft).data?.label.trim());
    return label.trim().length > 0;
  };

  // ── Filtered templates ─────────────────────────────────────────────────────
  const filteredTemplates = WIDGET_REGISTRY.filter((w) =>
    templateCategory === "all" || REGISTRY_CATEGORY_MAP[w.category] === templateCategory
  );

  const selectedTemplateReg = selectedTemplate ? WIDGET_REGISTRY.find((w) => w.type === selectedTemplate) : null;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { if (templateNaming) { setTemplateNaming(false); } else { router.back(); } }}
          className="p-2 rounded-lg border"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="font-display font-light italic text-2xl" style={{ color: "var(--color-text)" }}>
            {templateNaming ? "Name your widget" : "Create Widget"}
          </h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {templateNaming
              ? `Publishing "${selectedTemplateReg?.label}" as an organization widget`
              : "Build a custom widget or choose a template"}
          </p>
        </div>
      </div>

      {/* Mode tabs — hidden when in naming step */}
      {!templateNaming && (
        <div
          className="flex rounded-xl p-1 gap-1"
          style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
        >
          {([["template", "From template", Layers], ["custom", "Custom (data-driven)", Database]] as const).map(([m, mLabel, Icon]) => (
            <button
              key={m}
              onClick={() => { setMode(m); setStep(0); setSaveError(null); }}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors"
              style={{
                background: mode === m ? "var(--color-surface)" : "transparent",
                color: mode === m ? "var(--color-text)" : "var(--color-text-muted)",
                boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              <Icon className="h-4 w-4" />
              {mLabel}
            </button>
          ))}
        </div>
      )}

      {/* ── TEMPLATE MODE ────────────────────────────────────────────────── */}
      {mode === "template" && !templateNaming && (
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <h2 className="font-semibold text-base" style={{ color: "var(--color-text)" }}>Choose a template</h2>

          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            {TEMPLATE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setTemplateCategory(cat.id)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors"
                style={{
                  borderColor: templateCategory === cat.id ? "var(--color-accent)" : "var(--color-border)",
                  background: templateCategory === cat.id ? "var(--color-brand-subtle, rgba(200,137,42,0.06))" : "var(--color-card)",
                  color: templateCategory === cat.id ? "var(--color-accent)" : "var(--color-text)",
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Template grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredTemplates.map((w) => {
              const isSelected = selectedTemplate === w.type;
              return (
                <button
                  key={w.type}
                  onClick={() => setSelectedTemplate(isSelected ? null : w.type)}
                  className="rounded-xl p-4 text-left border-2 transition-colors"
                  style={{
                    borderColor: isSelected ? "var(--color-accent)" : "var(--color-border)",
                    background: isSelected ? "var(--color-brand-subtle, rgba(200,137,42,0.06))" : "var(--color-card)",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm" style={{ color: "var(--color-text)" }}>{w.label}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{w.description}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase"
                      style={{
                        background: "var(--color-sidebar-active-bg)",
                        color: "var(--color-sidebar-active-text)",
                      }}
                    >
                      {REGISTRY_CATEGORY_MAP[w.category] ?? w.category}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: "var(--color-accent)" }}>
                      <Check className="h-3 w-3" />
                      Selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {selectedTemplate && (
            <button
              onClick={() => {
                setTemplateLabel(selectedTemplateReg?.label ?? "");
                setTemplateDescription(selectedTemplateReg?.description ?? "");
                setTemplateNaming(true);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium"
              style={{ background: "var(--color-accent)", color: "#fff" }}
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* ── TEMPLATE NAMING STEP ─────────────────────────────────────────── */}
      {mode === "template" && templateNaming && (
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              Name <span style={{ color: "var(--color-error, #EF4444)" }}>*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={templateLabel}
              onChange={(e) => setTemplateLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && templateLabel.trim()) handleSaveTemplate(); }}
              placeholder={selectedTemplateReg?.label ?? "Widget name"}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Description</label>
            <input
              type="text"
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
            />
          </div>
          {saveError && (
            <p className="text-xs" style={{ color: "var(--color-error, #EF4444)" }}>{saveError}</p>
          )}
          <button
            onClick={handleSaveTemplate}
            disabled={!templateLabel.trim() || publishing}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-opacity disabled:opacity-40"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            <Check className="h-4 w-4" />
            {publishing ? "Publishing…" : "Publish to organization library"}
          </button>
        </div>
      )}

      {/* ── CUSTOM MODE: step indicator ───────────────────────────────────── */}
      {mode === "custom" && (
        <>
          <div className="flex items-center gap-0">
            {CUSTOM_STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = step === i;
              const done = step > i;
              return (
                <div key={i} className="flex items-center flex-1">
                  <div
                    className="flex items-center gap-2 py-2 px-3 rounded-lg"
                    style={{
                      background: active ? "var(--color-accent)" : done ? "var(--color-sidebar-active-bg)" : "transparent",
                      color: active ? "#fff" : done ? "var(--color-sidebar-active-text)" : "var(--color-text-muted)",
                    }}
                  >
                    {done ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Icon className="h-3.5 w-3.5 shrink-0" />}
                    <span className="text-xs font-medium hidden sm:block">{s.label}</span>
                  </div>
                  {i < CUSTOM_STEPS.length - 1 && (
                    <div className="flex-1 h-px mx-1" style={{ background: "var(--color-border)" }} />
                  )}
                </div>
              );
            })}
          </div>

          <div
            className="rounded-2xl p-6 space-y-5"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            {/* Step 0: Data source + filters */}
            {step === 0 && (
              <div className="space-y-5">
                <h2 className="font-semibold text-base" style={{ color: "var(--color-text)" }}>Choose data source</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(Object.entries(DATA_SOURCE_LABELS) as [DataSource, string][]).map(([ds, dsLabel]) => (
                    <button
                      key={ds}
                      onClick={() => setDataSource(ds)}
                      className="rounded-xl p-4 text-left border-2 transition-colors"
                      style={{
                        borderColor: dataSource === ds ? "var(--color-accent)" : "var(--color-border)",
                        background: dataSource === ds ? "var(--color-brand-subtle, rgba(200,137,42,0.06))" : "var(--color-card)",
                        color: "var(--color-text)",
                      }}
                    >
                      <p className="font-medium text-sm">{dsLabel}</p>
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>Filters</p>
                    <button onClick={addFilter} className="text-xs rounded-lg px-2.5 py-1.5"
                      style={{ background: "var(--color-sidebar-active-bg)", color: "var(--color-sidebar-active-text)" }}>
                      + Add filter
                    </button>
                  </div>
                  {filters.length === 0 && (
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>No filters — all records will be included</p>
                  )}
                  {filters.map((filter, i) => {
                    const filterHints = getValues(filter.field);
                    return (
                      <div key={i} className="flex items-center gap-2 flex-wrap">
                        <div className="flex-1 min-w-[100px]">
                          <FieldSelect fields={fields} value={filter.field} onChange={(v) => updateFilter(i, { field: v, value: "" })} />
                        </div>
                        <select value={filter.operator} onChange={(e) => updateFilter(i, { operator: e.target.value as QueryFilter["operator"] })}
                          className="rounded-lg border px-2 py-2 text-sm focus:outline-none"
                          style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}>
                          <option value="eq">is</option>
                          <option value="neq">is not</option>
                          <option value="contains">contains</option>
                          <option value="gt">greater than</option>
                          <option value="lt">less than</option>
                        </select>
                        {filterHints.length > 0 ? (
                          <select value={filter.value} onChange={(e) => updateFilter(i, { value: e.target.value })}
                            className="flex-1 min-w-[80px] rounded-lg border px-3 py-2 text-sm focus:outline-none"
                            style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}>
                            <option value="">Select…</option>
                            {filterHints.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                          </select>
                        ) : (
                          <input type="text"
                            value={filter.value} onChange={(e) => updateFilter(i, { value: e.target.value })}
                            placeholder="value"
                            className="flex-1 min-w-[80px] rounded-lg border px-3 py-2 text-sm focus:outline-none"
                            style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
                        )}
                        <button onClick={() => removeFilter(i)} className="text-xs rounded px-2 py-1" style={{ color: "var(--color-error, #EF4444)" }}>×</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 1: Measure */}
            {step === 1 && (
              <div className="space-y-5">
                <h2 className="font-semibold text-base" style={{ color: "var(--color-text)" }}>Choose measure</h2>
                <div className="space-y-2">
                  {MEASURE_OPTIONS.map((m) => (
                    <button key={m.type} onClick={() => setMeasureType(m.type)}
                      className="w-full rounded-xl p-3 text-left border-2 transition-colors"
                      style={{
                        borderColor: measureType === m.type ? "var(--color-accent)" : "var(--color-border)",
                        background: measureType === m.type ? "var(--color-brand-subtle, rgba(200,137,42,0.06))" : "var(--color-card)",
                      }}>
                      <p className="font-medium text-sm" style={{ color: "var(--color-text)" }}>{m.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{m.description}</p>
                    </button>
                  ))}
                </div>
                {selectedMeasure.needsField && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Field to average</label>
                    <FieldSelect fields={numericFields} value={measureField} onChange={setMeasureField} placeholder="Select numeric field" />
                  </div>
                )}
                {selectedMeasure.needsWhere && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Match field</label>
                      <FieldSelect fields={fields} value={whereField} onChange={(v) => { setWhereField(v); setWhereValue(""); }} placeholder="Select field" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Match value</label>
                      {(() => {
                        const hints = getValues(whereField);
                        if (hints.length > 0) {
                          return (
                            <select value={whereValue} onChange={(e) => setWhereValue(e.target.value)}
                              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                              style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}>
                              <option value="">Select…</option>
                              {hints.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                            </select>
                          );
                        }
                        return (
                          <input type="text"
                            value={whereValue} onChange={(e) => setWhereValue(e.target.value)}
                            placeholder="e.g. SUCCESS"
                            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                            style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Group-by + visual */}
            {step === 2 && (
              <div className="space-y-5">
                <h2 className="font-semibold text-base" style={{ color: "var(--color-text)" }}>Visualization</h2>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Group by (optional)</label>
                    <FieldSelect fields={["", ...fields]} value={groupByField} onChange={setGroupByField} placeholder="No grouping (single value)" />
                  </div>
                  {groupByField === "event_date" && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Time grain</label>
                      <select value={timeGrain} onChange={(e) => setTimeGrain(e.target.value as GroupBy["timeGrain"])}
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                        style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}>
                        <option value="day">Daily</option>
                        <option value="week">Weekly</option>
                        <option value="month">Monthly</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Chart type</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {VISUAL_OPTIONS.map((v) => (
                      <button key={v.type} onClick={() => setVisualType(v.type)}
                        className="rounded-xl p-3 text-left border-2 transition-colors"
                        style={{
                          borderColor: visualType === v.type ? "var(--color-accent)" : "var(--color-border)",
                          background: visualType === v.type ? "var(--color-brand-subtle, rgba(200,137,42,0.06))" : "var(--color-card)",
                        }}>
                        <p className="font-medium text-xs" style={{ color: "var(--color-text)" }}>{v.label}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>{v.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <PreviewPanel queryConfig={queryConfig} visualType={visualType} label="Preview" />
              </div>
            )}

            {/* Step 3: Name + publish */}
            {step === 3 && (
              <div className="space-y-5">
                <h2 className="font-semibold text-base" style={{ color: "var(--color-text)" }}>Name your widget</h2>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                    Name <span style={{ color: "var(--color-error, #EF4444)" }}>*</span>
                  </label>
                  <input autoFocus type="text" value={label} onChange={(e) => setLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && canNext()) handleSaveCustom(); }}
                    placeholder="My custom widget"
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Description</label>
                  <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
                </div>

                {/* JSON advanced */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Advanced JSON configuration</p>
                    <button type="button"
                      onClick={() => { if (!jsonEditorOpen) setJsonDraft(JSON.stringify(formDraft, null, 2)); setJsonError(null); setJsonEditorOpen((v) => !v); }}
                      className="text-xs rounded-lg px-2.5 py-1.5 border"
                      style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
                      {jsonEditorOpen ? "Hide JSON editor" : "Edit as JSON"}
                    </button>
                  </div>
                  {jsonEditorOpen && (
                    <div className="space-y-2">
                      <textarea value={jsonDraft} onChange={(e) => { setJsonDraft(e.target.value); setJsonError(null); }}
                        rows={12} spellCheck={false}
                        className="w-full rounded-lg border px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2"
                        style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => { setJsonDraft(JSON.stringify(formDraft, null, 2)); setJsonError(null); }}
                          className="text-xs rounded-lg px-2.5 py-1.5 border"
                          style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
                          Reload from form
                        </button>
                        <button type="button" onClick={() => { const p = parseWidgetDraftJson(jsonDraft); if (!p.data) { setJsonError(p.error ?? "Invalid JSON."); return; } applyDraftToForm(p.data); setJsonError(null); }}
                          className="text-xs rounded-lg px-2.5 py-1.5"
                          style={{ background: "var(--color-sidebar-active-bg)", color: "var(--color-sidebar-active-text)" }}>
                          Apply JSON to form
                        </button>
                      </div>
                      {(jsonError || jsonParseResult?.error) && (
                        <p className="text-xs" style={{ color: "var(--color-error, #EF4444)" }}>{jsonError ?? jsonParseResult?.error}</p>
                      )}
                      {!jsonParseResult?.error && jsonDraft.trim() && (
                        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>JSON is valid. Saving will use this JSON definition.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Summary */}
                <div className="rounded-xl p-4 space-y-2 text-xs"
                  style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
                  <p className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>Summary</p>
                  <SummaryRow label="Data source" value={DATA_SOURCE_LABELS[effectiveDraft.queryConfig.dataSource]} />
                  <SummaryRow label="Measure" value={MEASURE_OPTIONS.find((m) => m.type === effectiveDraft.queryConfig.measure.type)?.label ?? ""} />
                  <SummaryRow label="Group by" value={effectiveDraft.queryConfig.groupBy ? (FIELD_LABELS[effectiveDraft.queryConfig.groupBy.field] ?? effectiveDraft.queryConfig.groupBy.field) : "None"} />
                  <SummaryRow label="Chart type" value={VISUAL_OPTIONS.find((v) => v.type === effectiveDraft.visualType)?.label ?? ""} />
                  <SummaryRow label="Filters" value={effectiveDraft.queryConfig.filters.length === 0 ? "None" : `${effectiveDraft.queryConfig.filters.length} filter(s)`} />
                </div>

                {saveError && (
                  <p className="text-xs" style={{ color: "var(--color-error, #EF4444)" }}>{saveError}</p>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            {step > 0 && (
              <button onClick={() => setStep((s) => (s - 1) as Step)}
                className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium border"
                style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            )}
            <div className="flex-1" />
            {step < 3 ? (
              <button onClick={() => setStep((s) => (s + 1) as Step)} disabled={!canNext()}
                className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-40"
                style={{ background: "var(--color-accent)", color: "#fff" }}>
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button onClick={handleSaveCustom} disabled={!canNext() || publishing}
                className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-40"
                style={{ background: "var(--color-accent)", color: "#fff" }}>
                <Check className="h-4 w-4" />
                {publishing ? "Publishing…" : "Publish to organization library"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <span className="font-medium" style={{ color: "var(--color-text)" }}>{value}</span>
    </div>
  );
}

function PreviewPanel({ queryConfig, visualType, label }: { queryConfig: QueryConfig; visualType: VisualType; label: string }) {
  const SAMPLE: Record<string, Record<string, unknown>[]> = {
    pipeline_runs: [
      { dataset_id: "cbsenergie", step: "bronze", run_status: "SUCCESS", source_system: "cbs", event_date: "2026-04-10", duration_ms: 1200 },
      { dataset_id: "eponline",   step: "silver", run_status: "FAILED",  source_system: "epo", event_date: "2026-04-11", duration_ms: 980 },
      { dataset_id: "rvosde",     step: "gold",   run_status: "SUCCESS", source_system: "rvo", event_date: "2026-04-12", duration_ms: 540 },
      { dataset_id: "cbsenergie", step: "silver", run_status: "WARNING", source_system: "cbs", event_date: "2026-04-12", duration_ms: 1800 },
      { dataset_id: "eponline",   step: "bronze", run_status: "SUCCESS", source_system: "epo", event_date: "2026-04-13", duration_ms: 670 },
    ],
    data_quality_checks: [
      { dataset_id: "cbsenergie", check_id: "null_check", check_category: "completeness", check_status: "PASS", step: "bronze", event_date: "2026-04-10" },
      { dataset_id: "eponline",   check_id: "range_check", check_category: "validity",      check_status: "FAIL", step: "silver", event_date: "2026-04-11" },
      { dataset_id: "rvosde",     check_id: "uniq_check",  check_category: "uniqueness",    check_status: "PASS", step: "gold",   event_date: "2026-04-12" },
    ],
    data_lineage: [
      { dataset_id: "cbsenergie", source_ref: "workspace.raw.cbsenergie_raw", target_ref: "workspace.bronze.cbsenergie_raw", source_type: "raw_file", target_type: "bronze_table", hop_kind: "data_flow", step: "raw_to_bronze", event_date: "2026-04-10" },
    ],
  };
  const raw = SAMPLE[queryConfig.dataSource] ?? [];
  try {
    const result = executeQuery(raw, queryConfig);
    return (
      <div>
        <p className="text-xs font-medium mb-2" style={{ color: "var(--color-text-muted)" }}>Preview (sample data)</p>
        <div style={{ height: 180 }}>
          <WidgetRenderer label={label} visualType={visualType} result={result} />
        </div>
      </div>
    );
  } catch { return null; }
}
