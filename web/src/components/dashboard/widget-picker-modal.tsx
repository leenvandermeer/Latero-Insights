"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Search, Sparkles, Check, Globe, Star,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { useDashboards } from "@/contexts/dashboard-context";
import { useSharedWidgets } from "@/hooks/use-shared-widgets";
import { useFieldValues } from "@/hooks";
import { executeQuery, DATA_SOURCE_LABELS, DATA_SOURCE_FIELDS, FIELD_LABELS, NUMERIC_FIELDS } from "@/lib/query-engine";
import { WidgetRenderer } from "@/app/(tenant)/(dashboard)/dashboard/widgets/widget-renderer";
import type { WidgetCategory } from "@/types/dashboard";
import type { DataSource, GroupBy, MeasureType, QueryConfig, QueryFilter, VisualType } from "@/types/dashboard";

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  onAdd: (type: string, customWidgetId?: string, size?: { w: number; h: number; minW?: number; minH?: number }) => void;
  onCreateCustom: () => void;
  onClose: () => void;
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId = "all" | WidgetCategory | "mine";

const TABS: { id: TabId; label: string }[] = [
  { id: "all",      label: "All" },
  { id: "counter",  label: "Counters" },
  { id: "charts",   label: "Charts" },
  { id: "tables",   label: "Tables" },
  { id: "overview", label: "Overview" },
  { id: "mine",     label: "Mine" },
];

// ─── Widget Picker Modal ──────────────────────────────────────────────────────

export function WidgetPickerModal({ onAdd, onCreateCustom, onClose }: Props) {
  const { customWidgets } = useDashboards();
  const { data: sharedWidgets = [] } = useSharedWidgets();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    searchRef.current?.focus();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const q = search.toLowerCase();
  useEffect(() => { if (q) setActiveTab("all"); }, [q]);

  const filteredShared = sharedWidgets.filter(
    (w) => w.label.toLowerCase().includes(q) || (w.description ?? "").toLowerCase().includes(q)
  );
  const filteredCustom = customWidgets.filter(
    (w) => w.label.toLowerCase().includes(q) || (w.description ?? "").toLowerCase().includes(q)
  );

  const CATEGORIES: WidgetCategory[] = ["counter", "charts", "tables", "overview"];
  const sharedByCategory = (cat: WidgetCategory) => filteredShared.filter((w) => w.category === cat);

  const showSharedAll    = activeTab === "all" && filteredShared.length > 0;
  const showMine         = (activeTab === "all" || activeTab === "mine") && filteredCustom.length > 0;
  const showCat = (cat: WidgetCategory) =>
    (activeTab === "all" || activeTab === cat) && sharedByCategory(cat).length > 0;

  const noResults = !filteredShared.length && !filteredCustom.length;

  const handleAdd = (type: string, customWidgetId?: string, size?: { w: number; h: number; minW?: number; minH?: number }) => {
    const key = customWidgetId ?? type;
    onAdd(type, customWidgetId, size);
    setJustAdded((prev) => new Set(prev).add(key));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setJustAdded((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }, 1400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-2xl flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-elevated, 0 24px 48px rgba(27,59,107,0.18))",
          maxHeight: "88vh",
        }}
      >
        {/* Header */}
        <div className="shrink-0 px-5 pt-5 pb-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && onClose()}
                placeholder="Search widgets…"
                className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
              />
            </div>
            <button onClick={onClose} className="shrink-0 rounded-lg p-2" style={{ color: "var(--color-text-muted)" }} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          {!q && (
            <div className="flex gap-1 overflow-x-auto pb-0 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
              {TABS.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: activeTab === tab.id ? "var(--color-accent)" : "transparent",
                    color: activeTab === tab.id ? "#fff" : "var(--color-text-muted)",
                    border: activeTab === tab.id ? "1px solid transparent" : "1px solid var(--color-border)",
                  }}>
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 -mx-5" style={{ borderTop: "1px solid var(--color-border)" }} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 min-h-0">
          {noResults && (
            <div className="py-12 text-center" style={{ color: "var(--color-text-muted)" }}>
              <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">{q ? <>No widgets match <strong>&ldquo;{search}&rdquo;</strong></> : "No widgets yet. Create one via the widget builder."}</p>
              <button onClick={onCreateCustom}
                className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
                style={{ background: "var(--color-accent)", color: "#fff" }}>
                <Sparkles className="h-3.5 w-3.5" />
                Create widget
              </button>
            </div>
          )}

          {/* Show all shared when on "all" tab and no category active */}
          {showSharedAll && !CATEGORIES.some(showCat) && (
            <Section label="Shared" icon={<Globe className="h-3.5 w-3.5" />}>
              <WidgetGrid cols={2}>
                {filteredShared.map((sw) => (
                  <WidgetCard key={sw.id} label={sw.label} description={sw.description ?? ""}
                    badge={sw.category} added={justAdded.has(sw.id)}
                    onAdd={() => handleAdd("shared", sw.id, sw.defaultSize)} />
                ))}
              </WidgetGrid>
            </Section>
          )}

          {/* Categorised shared */}
          {CATEGORIES.map((cat) => showCat(cat) && (
            <Section key={cat} label={cat === "counter" ? "Counters" : cat === "charts" ? "Charts" : cat === "tables" ? "Tables" : "Overview"}>
              <WidgetGrid cols={cat === "counter" ? 3 : 2}>
                {sharedByCategory(cat).map((sw) => (
                  <WidgetCard key={sw.id} label={sw.label} description={sw.description ?? ""}
                    added={justAdded.has(sw.id)}
                    onAdd={() => handleAdd("shared", sw.id, sw.defaultSize)} />
                ))}
              </WidgetGrid>
            </Section>
          ))}

          {/* Personal widgets */}
          {showMine && (
            <Section label="My Widgets" icon={<Star className="h-3.5 w-3.5" />}>
              <WidgetGrid cols={2}>
                {filteredCustom.map((cw) => (
                  <WidgetCard key={cw.id} label={cw.label} description={cw.description ?? ""}
                    added={justAdded.has(cw.id)}
                    onAdd={() => handleAdd("custom", cw.id)} />
                ))}
              </WidgetGrid>
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 flex items-center justify-between gap-3"
          style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Create widgets with the builder and publish them to the shared library when they are ready.
          </p>
          <button onClick={onCreateCustom}
            className="shrink-0 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: "var(--color-accent)", color: "#fff" }}>
            <Sparkles className="h-4 w-4" />
            Create widget
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

interface DrawerProps extends Props { open: boolean; }

type DrawerView = "library" | "builder";
type BuilderStep = 0 | 1 | 2;

const BUILDER_STEPS = ["Data", "Visual", "Save"] as const;
const MEASURE_OPTIONS: { type: MeasureType; label: string; description: string; needsField: boolean; needsWhere: boolean }[] = [
  { type: "count", label: "Count", description: "Total records", needsField: false, needsWhere: false },
  { type: "count_where", label: "Count where", description: "Records matching one condition", needsField: false, needsWhere: true },
  { type: "percentage", label: "Percentage", description: "Share of records matching one condition", needsField: false, needsWhere: true },
  { type: "avg", label: "Average", description: "Mean value of a numeric field", needsField: true, needsWhere: false },
];
const VISUAL_OPTIONS: { type: VisualType; label: string }[] = [
  { type: "counter", label: "Counter" },
  { type: "bar", label: "Bar" },
  { type: "line", label: "Line" },
  { type: "area", label: "Area" },
  { type: "donut", label: "Donut" },
  { type: "table", label: "Table" },
];
const FILTER_OPERATORS: QueryFilter["operator"][] = ["eq", "neq", "contains", "gt", "lt"];
const FILTER_OPERATOR_LABELS: Record<QueryFilter["operator"], string> = {
  eq: "is",
  neq: "is not",
  contains: "contains",
  gt: "greater than",
  lt: "less than",
};

export function WidgetPickerDrawer({ open, onAdd, onCreateCustom, onClose }: DrawerProps) {
  const { customWidgets, saveCustomWidget } = useDashboards();
  const { data: sharedWidgets = [] } = useSharedWidgets();
  const { getValues } = useFieldValues();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [view, setView] = useState<DrawerView>("library");
  const [builderStep, setBuilderStep] = useState<BuilderStep>(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [dataSource, setDataSource] = useState<DataSource>("pipeline_runs");
  const [filters, setFilters] = useState<QueryFilter[]>([]);
  const [measureType, setMeasureType] = useState<MeasureType>("count");
  const [measureField, setMeasureField] = useState("");
  const [whereField, setWhereField] = useState("");
  const [whereValue, setWhereValue] = useState("");
  const [groupByField, setGroupByField] = useState("");
  const [timeGrain, setTimeGrain] = useState<GroupBy["timeGrain"]>("day");
  const [visualType, setVisualType] = useState<VisualType>("bar");
  const searchRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open && !collapsed && view === "library") setTimeout(() => searchRef.current?.focus(), 150);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [open, collapsed, view]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setActiveTab("all");
      setCollapsed(false);
      setView("library");
      setBuilderStep(0);
      setSaveError(null);
    }
  }, [open]);

  const q = search.toLowerCase();
  useEffect(() => { if (q) setActiveTab("all"); }, [q]);

  const filteredShared = sharedWidgets.filter(
    (w) => w.label.toLowerCase().includes(q) || (w.description ?? "").toLowerCase().includes(q)
  );
  const filteredCustom = customWidgets.filter(
    (w) => w.label.toLowerCase().includes(q) || (w.description ?? "").toLowerCase().includes(q)
  );

  const CATEGORIES: WidgetCategory[] = ["counter", "charts", "tables", "overview"];
  const sharedByCategory = (cat: WidgetCategory) => filteredShared.filter((w) => w.category === cat);

  const noResults = !filteredShared.length && !filteredCustom.length;
  const fields = DATA_SOURCE_FIELDS[dataSource] ?? [];
  const numericFields = NUMERIC_FIELDS[dataSource] ?? [];
  const selectedMeasure = MEASURE_OPTIONS.find((option) => option.type === measureType)!;

  const handleAdd = useCallback((type: string, customWidgetId?: string, size?: { w: number; h: number; minW?: number; minH?: number }) => {
    const key = customWidgetId ?? type;
    onAdd(type, customWidgetId, size);
    setJustAdded((prev) => new Set(prev).add(key));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setJustAdded((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }, 1400);
  }, [onAdd]);

  const resetBuilder = useCallback(() => {
    setBuilderStep(0);
    setSaveError(null);
    setLabel("");
    setDescription("");
    setDataSource("pipeline_runs");
    setFilters([]);
    setMeasureType("count");
    setMeasureField("");
    setWhereField("");
    setWhereValue("");
    setGroupByField("");
    setTimeGrain("day");
    setVisualType("bar");
  }, []);

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

  const canContinue = () => {
    if (builderStep === 0) return true;
    if (builderStep === 1) {
      if (selectedMeasure.needsField && !measureField) return false;
      if (selectedMeasure.needsWhere && (!whereField || !whereValue)) return false;
      return true;
    }
    return label.trim().length > 0;
  };

  const addFilter = () => setFilters((prev) => [...prev, { field: fields[0] ?? "", operator: "eq", value: "" }]);
  const updateFilter = (index: number, patch: Partial<QueryFilter>) =>
    setFilters((prev) => prev.map((filter, currentIndex) => currentIndex === index ? { ...filter, ...patch } : filter));
  const removeFilter = (index: number) =>
    setFilters((prev) => prev.filter((_, currentIndex) => currentIndex !== index));

  const handleSaveAndPlace = () => {
    if (!label.trim()) return;
    setSaveError(null);
    try {
      const widget = saveCustomWidget({
        label: label.trim(),
        description: description.trim() || undefined,
        queryConfig,
        visualType,
        category: visualType === "counter" ? "counter" : visualType === "table" ? "tables" : "charts",
      });
      handleAdd("custom", widget.id, { w: 3, h: visualType === "counter" ? 2 : 4, minW: 2, minH: 2 });
      setActiveTab("mine");
      setView("library");
      resetBuilder();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save widget");
    }
  };

  return (
    <div
      className="flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden"
      style={{
        width: open ? (collapsed ? 40 : view === "builder" ? 420 : 280) : 0,
        opacity: open ? 1 : 0,
        borderLeft: open ? "1px solid var(--color-border)" : "none",
        background: "var(--color-surface)",
        position: "sticky",
        top: "1rem",
        height: "calc(100vh - 2rem)",
        alignSelf: "flex-start",
      }}
    >
      {open && collapsed && (
        <div className="flex flex-col h-full items-center py-3">
          <button onClick={() => setCollapsed(false)} title="Open widget panel"
            className="flex items-center justify-center w-8 h-8 rounded-md transition-colors"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)"; }}>
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}

      {open && !collapsed && (
        <div className="flex flex-col h-full min-h-0">
          {/* Header */}
          <div className="shrink-0 px-3 pt-3 pb-0">
            <div className="flex items-center gap-2 mb-3">
              {view === "library" ? (
                <div className="flex-1 relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
                  <input ref={searchRef} type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    className="w-full rounded-lg border pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1"
                    style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => { setView("library"); setSaveError(null); }}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium"
                    style={{ color: "var(--color-text-muted)", background: "var(--color-card)" }}
                  >
                    <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                    Back to library
                  </button>
                </div>
              )}
              <button onClick={() => setCollapsed(true)} title="Collapse"
                className="shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-colors"
                style={{ color: "var(--color-text-muted)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)"; }}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {view === "library" && !q && (
              <div className="flex flex-wrap gap-1 pb-0">
                {TABS.map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all"
                    style={{
                      background: activeTab === tab.id ? "var(--color-accent)" : "transparent",
                      color: activeTab === tab.id ? "#fff" : "var(--color-text-muted)",
                      border: activeTab === tab.id ? "1px solid transparent" : "1px solid var(--color-border)",
                    }}>
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 -mx-3" style={{ borderTop: "1px solid var(--color-border)" }} />
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 min-h-0">
            {view === "library" && noResults && (
              <div className="py-8 text-center" style={{ color: "var(--color-text-muted)" }}>
                <Search className="h-6 w-6 mx-auto mb-2 opacity-40" />
                <p className="text-xs">{q ? <>No results for <strong>&ldquo;{search}&rdquo;</strong></> : "No widgets yet."}</p>
              </div>
            )}

            {view === "library" ? (
              <>
                {CATEGORIES.map((cat) => {
                  const items = sharedByCategory(cat);
                  if (!items.length || (activeTab !== "all" && activeTab !== cat)) return null;
                  const catLabel = cat === "counter" ? "Counters" : cat === "charts" ? "Charts" : cat === "tables" ? "Tables" : "Overview";
                  return (
                    <DrawerSection key={cat} label={catLabel}>
                      {items.map((sw) => (
                        <DrawerWidgetRow key={sw.id} label={sw.label} description={sw.description ?? ""}
                          badge="Shared" added={justAdded.has(sw.id)}
                          onAdd={() => handleAdd("shared", sw.id, sw.defaultSize)} />
                      ))}
                    </DrawerSection>
                  );
                })}

                {(activeTab === "all" || activeTab === "mine") && filteredCustom.length > 0 && (
                  <DrawerSection label="Mine">
                    {filteredCustom.map((cw) => (
                      <DrawerWidgetRow key={cw.id} label={cw.label} description={cw.description ?? ""}
                        added={justAdded.has(cw.id)} onAdd={() => handleAdd("custom", cw.id)} />
                    ))}
                  </DrawerSection>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Create and place a custom widget</p>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                    Build the widget on the right, then place it directly on the dashboard without leaving this page.
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  {BUILDER_STEPS.map((stepLabel, index) => {
                    const active = builderStep === index;
                    const done = builderStep > index;
                    return (
                      <div key={stepLabel} className="flex items-center flex-1 gap-1">
                        <div
                          className="flex-1 rounded-md px-2 py-1 text-[10px] font-semibold text-center"
                          style={{
                            background: active ? "var(--color-accent)" : done ? "var(--color-sidebar-active-bg)" : "var(--color-card)",
                            color: active ? "#fff" : done ? "var(--color-sidebar-active-text)" : "var(--color-text-muted)",
                          }}
                        >
                          {stepLabel}
                        </div>
                        {index < BUILDER_STEPS.length - 1 && (
                          <div className="h-px w-2" style={{ background: "var(--color-border)" }} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {builderStep === 0 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>Data source</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {(Object.entries(DATA_SOURCE_LABELS) as [DataSource, string][]).map(([source, sourceLabel]) => (
                          <button
                            key={source}
                            onClick={() => setDataSource(source)}
                            className="rounded-xl p-3 text-left border transition-colors"
                            style={{
                              borderColor: dataSource === source ? "var(--color-accent)" : "var(--color-border)",
                              background: dataSource === source ? "var(--color-brand-subtle, rgba(200,137,42,0.06))" : "var(--color-card)",
                              color: "var(--color-text)",
                            }}
                          >
                            <p className="text-xs font-medium">{sourceLabel}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>Filters</p>
                        <button
                          onClick={addFilter}
                          className="rounded-md px-2 py-1 text-[11px] font-medium"
                          style={{ background: "var(--color-sidebar-active-bg)", color: "var(--color-sidebar-active-text)" }}
                        >
                          Add filter
                        </button>
                      </div>
                      {filters.length === 0 ? (
                        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>No filters. The widget will use all matching records.</p>
                      ) : filters.map((filter, index) => {
                        const filterHints = getValues(filter.field);
                        return (
                          <div key={`${filter.field}-${index}`} className="rounded-xl border p-2 space-y-2" style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}>
                            <select
                              value={filter.field}
                              onChange={(event) => updateFilter(index, { field: event.target.value, value: "" })}
                              className="w-full rounded-lg border px-2.5 py-2 text-xs"
                              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                            >
                              {fields.map((field) => <option key={field} value={field}>{FIELD_LABELS[field] ?? field}</option>)}
                            </select>
                            <div className="grid grid-cols-[1fr_auto] gap-2">
                              <select
                                value={filter.operator}
                                onChange={(event) => updateFilter(index, { operator: event.target.value as QueryFilter["operator"] })}
                                className="rounded-lg border px-2.5 py-2 text-xs"
                                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                              >
                                {FILTER_OPERATORS.map((operator) => (
                                  <option key={operator} value={operator}>{FILTER_OPERATOR_LABELS[operator]}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => removeFilter(index)}
                                className="rounded-lg px-2 py-2 text-xs font-medium"
                                style={{ background: "transparent", color: "var(--color-error, #EF4444)" }}
                              >
                                Remove
                              </button>
                            </div>
                            {filterHints.length > 0 ? (
                              <select
                                value={filter.value}
                                onChange={(event) => updateFilter(index, { value: event.target.value })}
                                className="w-full rounded-lg border px-2.5 py-2 text-xs"
                                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                              >
                                <option value="">Select…</option>
                                {filterHints.map((hint) => <option key={hint.value} value={hint.value}>{hint.label}</option>)}
                              </select>
                            ) : (
                              <input
                                value={filter.value}
                                onChange={(event) => updateFilter(index, { value: event.target.value })}
                                placeholder="Value"
                                className="w-full rounded-lg border px-2.5 py-2 text-xs"
                                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {builderStep === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>Measure</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {MEASURE_OPTIONS.map((option) => (
                          <button
                            key={option.type}
                            onClick={() => setMeasureType(option.type)}
                            className="rounded-xl border p-3 text-left transition-colors"
                            style={{
                              borderColor: measureType === option.type ? "var(--color-accent)" : "var(--color-border)",
                              background: measureType === option.type ? "var(--color-brand-subtle, rgba(200,137,42,0.06))" : "var(--color-card)",
                            }}
                          >
                            <p className="text-xs font-medium" style={{ color: "var(--color-text)" }}>{option.label}</p>
                            <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>{option.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {selectedMeasure.needsField && (
                      <select
                        value={measureField}
                        onChange={(event) => setMeasureField(event.target.value)}
                        className="w-full rounded-lg border px-2.5 py-2 text-xs"
                        style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                      >
                        <option value="">Select numeric field</option>
                        {numericFields.map((field) => <option key={field} value={field}>{FIELD_LABELS[field] ?? field}</option>)}
                      </select>
                    )}

                    {selectedMeasure.needsWhere && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          value={whereField}
                          onChange={(event) => { setWhereField(event.target.value); setWhereValue(""); }}
                          className="rounded-lg border px-2.5 py-2 text-xs"
                          style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                        >
                          <option value="">Select field</option>
                          {fields.map((field) => <option key={field} value={field}>{FIELD_LABELS[field] ?? field}</option>)}
                        </select>
                        {getValues(whereField).length > 0 ? (
                          <select
                            value={whereValue}
                            onChange={(event) => setWhereValue(event.target.value)}
                            className="rounded-lg border px-2.5 py-2 text-xs"
                            style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                          >
                            <option value="">Select value</option>
                            {getValues(whereField).map((hint) => <option key={hint.value} value={hint.value}>{hint.label}</option>)}
                          </select>
                        ) : (
                          <input
                            value={whereValue}
                            onChange={(event) => setWhereValue(event.target.value)}
                            placeholder="Match value"
                            className="rounded-lg border px-2.5 py-2 text-xs"
                            style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                          />
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={groupByField}
                        onChange={(event) => setGroupByField(event.target.value)}
                        className="rounded-lg border px-2.5 py-2 text-xs"
                        style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                      >
                        <option value="">No grouping</option>
                        {fields.map((field) => <option key={field} value={field}>{FIELD_LABELS[field] ?? field}</option>)}
                      </select>
                      {groupByField === "event_date" && (
                        <select
                          value={timeGrain}
                          onChange={(event) => setTimeGrain(event.target.value as GroupBy["timeGrain"])}
                          className="rounded-lg border px-2.5 py-2 text-xs"
                          style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                        >
                          <option value="day">Daily</option>
                          <option value="week">Weekly</option>
                          <option value="month">Monthly</option>
                        </select>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>Visual</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {VISUAL_OPTIONS.map((option) => (
                          <button
                            key={option.type}
                            onClick={() => setVisualType(option.type)}
                            className="rounded-lg border px-2 py-2 text-xs font-medium"
                            style={{
                              borderColor: visualType === option.type ? "var(--color-accent)" : "var(--color-border)",
                              background: visualType === option.type ? "var(--color-brand-subtle, rgba(200,137,42,0.06))" : "var(--color-card)",
                              color: "var(--color-text)",
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border p-3" style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}>
                      <DrawerPreviewPanel queryConfig={queryConfig} visualType={visualType} label={label.trim() || "Preview"} />
                    </div>
                  </div>
                )}

                {builderStep === 2 && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>Placement summary</p>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                        This widget will be saved to <strong>My Widgets</strong> and placed on the current dashboard immediately.
                      </p>
                    </div>
                    <input
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      placeholder="Widget name"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                    />
                    <input
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Optional description"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                    />
                    <div className="rounded-xl border p-3 text-xs space-y-1" style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}>
                      <SummaryItem label="Data source" value={DATA_SOURCE_LABELS[dataSource]} />
                      <SummaryItem label="Measure" value={selectedMeasure.label} />
                      <SummaryItem label="Grouping" value={groupByField ? (FIELD_LABELS[groupByField] ?? groupByField) : "None"} />
                      <SummaryItem label="Visual" value={VISUAL_OPTIONS.find((option) => option.type === visualType)?.label ?? visualType} />
                      <SummaryItem label="Filters" value={filters.length ? `${filters.length} active` : "None"} />
                    </div>
                    {saveError && (
                      <p className="text-xs" style={{ color: "var(--color-error, #EF4444)" }}>{saveError}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-3 py-3" style={{ borderTop: "1px solid var(--color-border)" }}>
            {view === "library" ? (
              <button
                onClick={() => { setView("builder"); setBuilderStep(0); setSaveError(null); }}
                className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
                style={{ background: "var(--color-accent)", color: "#fff" }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Create widget
              </button>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    if (builderStep === 0) {
                      setView("library");
                      setSaveError(null);
                    } else {
                      setBuilderStep((current) => (current - 1) as BuilderStep);
                    }
                  }}
                  className="rounded-lg px-3 py-2 text-xs font-medium"
                  style={{ background: "var(--color-sidebar-hover)", color: "var(--color-text-muted)" }}
                >
                  {builderStep === 0 ? "Cancel" : "Back"}
                </button>
                <div className="flex items-center gap-2">
                  {builderStep < 2 ? (
                    <button
                      onClick={() => setBuilderStep((current) => (current + 1) as BuilderStep)}
                      disabled={!canContinue()}
                      className="rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40"
                      style={{ background: "var(--color-accent)", color: "#fff" }}
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={handleSaveAndPlace}
                      disabled={!canContinue()}
                      className="rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40"
                      style={{ background: "var(--color-accent)", color: "#fff" }}
                    >
                      Save and place
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        {icon && <span style={{ color: "var(--color-text-muted)" }}>{icon}</span>}
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>{label}</p>
      </div>
      {children}
    </section>
  );
}

function WidgetGrid({ cols, children }: { cols: number; children: React.ReactNode }) {
  const colClass = cols === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2";
  return <div className={`grid ${colClass} gap-2`}>{children}</div>;
}

function WidgetCard({ label, description, badge, added, onAdd }: {
  label: string; description: string; badge?: string; added: boolean; onAdd: () => void;
}) {
  return (
    <button onClick={onAdd}
      className="group flex flex-col items-start gap-2 rounded-xl p-3 text-left w-full transition-all"
      style={{
        border: `1px solid ${added ? "var(--color-success, #22c55e)" : "var(--color-border)"}`,
        background: added ? "rgba(34,197,94,0.06)" : "var(--color-card)",
      }}
      onMouseEnter={(e) => { if (!added) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-accent)"; }}
      onMouseLeave={(e) => { if (!added) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border)"; }}>
      <div className="flex items-start justify-between w-full gap-2">
        <div className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0" style={{ background: "var(--color-accent)", opacity: 0.5 }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-tight truncate" style={{ color: "var(--color-text)" }}>{label}</p>
          <p className="text-[10px] mt-0.5 leading-relaxed line-clamp-2" style={{ color: "var(--color-text-muted)" }}>{description}</p>
        </div>
        <div className="shrink-0">
          {added ? (
            <Check className="h-3.5 w-3.5" style={{ color: "var(--color-success, #22c55e)" }} />
          ) : badge ? (
            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
              style={{ background: "rgba(200,137,42,0.12)", color: "var(--color-accent)" }}>
              {badge}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function DrawerSection({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <div className="flex items-center gap-1.5">
        {icon && <span style={{ color: "var(--color-text-muted)" }}>{icon}</span>}
        <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>{label}</p>
      </div>
      {children}
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <span className="font-medium text-right" style={{ color: "var(--color-text)" }}>{value}</span>
    </div>
  );
}

function DrawerPreviewPanel({ queryConfig, visualType, label }: { queryConfig: QueryConfig; visualType: VisualType; label: string }) {
  const sample: Record<string, Record<string, unknown>[]> = {
    pipeline_runs: [
      { dataset_id: "cbsemissies", step: "bronze", run_status: "SUCCESS", source_system: "cbs", event_date: "2026-04-10", duration_ms: 1200 },
      { dataset_id: "cbsenergie", step: "silver", run_status: "WARNING", source_system: "cbs", event_date: "2026-04-11", duration_ms: 1400 },
      { dataset_id: "cbsarbeid", step: "gold", run_status: "FAILED", source_system: "cbs", event_date: "2026-04-12", duration_ms: 980 },
    ],
    data_quality_checks: [
      { dataset_id: "cbsemissies", check_id: "null_check", check_category: "completeness", check_status: "PASS", step: "bronze", event_date: "2026-04-10" },
      { dataset_id: "cbsenergie", check_id: "range_check", check_category: "validity", check_status: "FAIL", step: "silver", event_date: "2026-04-11" },
    ],
    data_lineage: [
      { dataset_id: "cbsemissies", source_ref: "workspace.raw.cbsemissies_raw", target_ref: "workspace.bronze.cbsemissies_raw", source_type: "raw_file", target_type: "bronze_table", hop_kind: "data_flow", step: "raw_to_bronze", event_date: "2026-04-10" },
    ],
  };

  try {
    const result = executeQuery(sample[queryConfig.dataSource] ?? [], queryConfig);
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>Preview</p>
        <div style={{ height: 180 }}>
          <WidgetRenderer label={label} visualType={visualType} result={result} />
        </div>
      </div>
    );
  } catch {
    return (
      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        Adjust the configuration to see a preview.
      </p>
    );
  }
}

function DrawerWidgetRow({ label, description, badge, added, onAdd }: {
  label: string; description: string; badge?: string; added: boolean; onAdd: () => void;
}) {
  return (
    <button onClick={onAdd}
      className="group w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all"
      style={{
        border: `1px solid ${added ? "var(--color-success, #22c55e)" : "transparent"}`,
        background: added ? "rgba(34,197,94,0.06)" : "transparent",
      }}
      onMouseEnter={(e) => { if (!added) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)"; }}
      onMouseLeave={(e) => { if (!added) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--color-accent)", opacity: 0.5 }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate leading-tight" style={{ color: "var(--color-text)" }}>{label}</p>
      </div>
      {added && <Check className="h-3 w-3 shrink-0" style={{ color: "var(--color-success, #22c55e)" }} />}
      {!added && badge && (
        <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded shrink-0"
          style={{ background: "rgba(200,137,42,0.12)", color: "var(--color-accent)" }}>
          {badge}
        </span>
      )}
    </button>
  );
}
