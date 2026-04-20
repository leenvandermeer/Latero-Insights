"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Database, BarChart2, Eye, Tag } from "lucide-react";
import { useDashboards } from "@/contexts/dashboard-context";
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
} from "@/types/dashboard";

// ─── Step types ───────────────────────────────────────────────────────────────

type Step = 0 | 1 | 2 | 3;

const STEPS = [
  { label: "Data", icon: Database },
  { label: "Measure", icon: BarChart2 },
  { label: "Visualize", icon: Eye },
  { label: "Finish", icon: Tag },
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

// ─── Field selector ────────────────────────────────────────────────────────────

function FieldSelect({ fields, value, onChange, placeholder }: {
  fields: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
      style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {fields.map((f) => (
        <option key={f} value={f}>{FIELD_LABELS[f] ?? f}</option>
      ))}
    </select>
  );
}

// ─── Main wizard ───────────────────────────────────────────────────────────────

export default function WidgetBuilderPage() {
  const router = useRouter();
  const { saveCustomWidget } = useDashboards();

  // Step state
  const [step, setStep] = useState<Step>(0);

  // Step 0: Data source + filters
  const [dataSource, setDataSource] = useState<DataSource>("pipeline_runs");
  const [filters, setFilters] = useState<QueryFilter[]>([]);

  // Step 1: Measure
  const [measureType, setMeasureType] = useState<MeasureType>("count");
  const [measureField, setMeasureField] = useState("");
  const [whereField, setWhereField] = useState("");
  const [whereValue, setWhereValue] = useState("");

  // Step 2: Group-by + visual type
  const [groupByField, setGroupByField] = useState("");
  const [timeGrain, setTimeGrain] = useState<GroupBy["timeGrain"]>("day");
  const [visualType, setVisualType] = useState<VisualType>("bar");

  // Step 3: Label + description
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");

  const fields = DATA_SOURCE_FIELDS[dataSource] ?? [];
  const numericFields = NUMERIC_FIELDS[dataSource] ?? [];
  const selectedMeasure = MEASURE_OPTIONS.find((m) => m.type === measureType)!;

  // Build config preview
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

  const addFilter = () => {
    setFilters((prev) => [...prev, { field: fields[0] ?? "", operator: "eq", value: "" }]);
  };

  const updateFilter = (i: number, patch: Partial<QueryFilter>) => {
    setFilters((prev) => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  };

  const removeFilter = (i: number) => {
    setFilters((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSave = () => {
    if (!label.trim()) return;
    saveCustomWidget({ label: label.trim(), description: description.trim() || undefined, queryConfig, visualType });
    router.back();
  };

  const canNext = () => {
    if (step === 0) return true;
    if (step === 1) {
      if (selectedMeasure.needsField && !measureField) return false;
      if (selectedMeasure.needsWhere && (!whereField || !whereValue)) return false;
      return true;
    }
    if (step === 2) return true;
    return label.trim().length > 0;
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg border"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="font-display font-light italic text-2xl" style={{ color: "var(--color-text)" }}>
            Create Widget
          </h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Build a custom data widget for your dashboards</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
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
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px mx-1" style={{ background: "var(--color-border)" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div
        className="rounded-2xl p-6 space-y-5"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        {/* Step 0: Data source */}
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
                <button
                  onClick={addFilter}
                  className="text-xs rounded-lg px-2.5 py-1.5"
                  style={{ background: "var(--color-sidebar-active-bg)", color: "var(--color-sidebar-active-text)" }}
                >
                  + Add filter
                </button>
              </div>

              {filters.length === 0 && (
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>No filters — all records will be included</p>
              )}

              {filters.map((filter, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <div className="flex-1 min-w-[100px]">
                    <FieldSelect fields={fields} value={filter.field} onChange={(v) => updateFilter(i, { field: v })} />
                  </div>
                  <select
                    value={filter.operator}
                    onChange={(e) => updateFilter(i, { operator: e.target.value as QueryFilter["operator"] })}
                    className="rounded-lg border px-2 py-2 text-sm focus:outline-none"
                    style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                  >
                    <option value="eq">is</option>
                    <option value="neq">is not</option>
                    <option value="contains">contains</option>
                    <option value="gt">greater than</option>
                    <option value="lt">less than</option>
                  </select>
                  <input
                    type="text"
                    value={filter.value}
                    onChange={(e) => updateFilter(i, { value: e.target.value })}
                    placeholder="value"
                    className="flex-1 min-w-[80px] rounded-lg border px-3 py-2 text-sm focus:outline-none"
                    style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                  />
                  <button
                    onClick={() => removeFilter(i)}
                    className="text-xs rounded px-2 py-1"
                    style={{ color: "var(--color-error, #EF4444)" }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Measure */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="font-semibold text-base" style={{ color: "var(--color-text)" }}>Choose measure</h2>

            <div className="space-y-2">
              {MEASURE_OPTIONS.map((m) => (
                <button
                  key={m.type}
                  onClick={() => setMeasureType(m.type)}
                  className="w-full rounded-xl p-3 text-left border-2 transition-colors"
                  style={{
                    borderColor: measureType === m.type ? "var(--color-accent)" : "var(--color-border)",
                    background: measureType === m.type ? "var(--color-brand-subtle, rgba(200,137,42,0.06))" : "var(--color-card)",
                  }}
                >
                  <p className="font-medium text-sm" style={{ color: "var(--color-text)" }}>{m.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{m.description}</p>
                </button>
              ))}
            </div>

            {selectedMeasure.needsField && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Field to average</label>
                <FieldSelect
                  fields={numericFields}
                  value={measureField}
                  onChange={setMeasureField}
                  placeholder="Select numeric field"
                />
              </div>
            )}

            {selectedMeasure.needsWhere && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Match field</label>
                  <FieldSelect fields={fields} value={whereField} onChange={setWhereField} placeholder="Select field" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Match value</label>
                  <input
                    type="text"
                    value={whereValue}
                    onChange={(e) => setWhereValue(e.target.value)}
                    placeholder="e.g. SUCCESS"
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Group-by + Visual */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="font-semibold text-base" style={{ color: "var(--color-text)" }}>Visualization</h2>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Group by (optional)</label>
                <FieldSelect
                  fields={["", ...fields]}
                  value={groupByField}
                  onChange={setGroupByField}
                  placeholder="No grouping (single value)"
                />
              </div>

              {groupByField === "event_date" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Time grain</label>
                  <select
                    value={timeGrain}
                    onChange={(e) => setTimeGrain(e.target.value as GroupBy["timeGrain"])}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                    style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                  >
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
                  <button
                    key={v.type}
                    onClick={() => setVisualType(v.type)}
                    className="rounded-xl p-3 text-left border-2 transition-colors"
                    style={{
                      borderColor: visualType === v.type ? "var(--color-accent)" : "var(--color-border)",
                      background: visualType === v.type ? "var(--color-brand-subtle, rgba(200,137,42,0.06))" : "var(--color-card)",
                    }}
                  >
                    <p className="font-medium text-xs" style={{ color: "var(--color-text)" }}>{v.label}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>{v.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Live preview with placeholder data */}
            <PreviewPanel queryConfig={queryConfig} visualType={visualType} label="Preview" />
          </div>
        )}

        {/* Step 3: Label + save */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="font-semibold text-base" style={{ color: "var(--color-text)" }}>Name your widget</h2>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                Name <span style={{ color: "var(--color-error, #EF4444)" }}>*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && canNext()) handleSave(); }}
                placeholder="My custom widget"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
              />
            </div>

            {/* Summary */}
            <div
              className="rounded-xl p-4 space-y-2 text-xs"
              style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
            >
              <p className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>Summary</p>
              <SummaryRow label="Data source" value={DATA_SOURCE_LABELS[queryConfig.dataSource]} />
              <SummaryRow label="Measure" value={MEASURE_OPTIONS.find((m) => m.type === queryConfig.measure.type)?.label ?? ""} />
              <SummaryRow label="Group by" value={queryConfig.groupBy ? (FIELD_LABELS[queryConfig.groupBy.field] ?? queryConfig.groupBy.field) : "None"} />
              <SummaryRow label="Chart type" value={VISUAL_OPTIONS.find((v) => v.type === visualType)?.label ?? ""} />
              <SummaryRow label="Filters" value={filters.length === 0 ? "None" : `${filters.length} filter(s)`} />
            </div>
          </div>
        )}
      </div>

      {/* Nav buttons */}
      <div className="flex gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => (s - 1) as Step)}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium border"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}
        <div className="flex-1" />
        {step < 3 ? (
          <button
            onClick={() => setStep((s) => (s + 1) as Step)}
            disabled={!canNext()}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-40"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={!canNext()}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-40"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            <Check className="h-4 w-4" />
            Save widget
          </button>
        )}
      </div>
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
      { source_entity: "cbsenergie_raw", target_entity: "cbsenergie_bronze", step: "bronze", event_date: "2026-04-10" },
      { source_entity: "eponline_raw",   target_entity: "eponline_bronze",   step: "bronze", event_date: "2026-04-11" },
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
  } catch {
    return null;
  }
}
