"use client";

import { useState, useRef, useEffect } from "react";
import { X, Search, Sparkles, Check, Globe, Star, Activity, XCircle, CheckCircle, ClipboardCheck, BarChart2, TrendingUp, PieChart, Timer, Table2, Layers } from "lucide-react";
import { WIDGET_REGISTRY } from "@/app/(dashboard)/dashboard/registry";
import { useDashboards } from "@/contexts/dashboard-context";
import { useSharedWidgets } from "@/hooks/use-shared-widgets";
import type { SharedWidgetDef, CustomWidget } from "@/types/dashboard";

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  onAdd: (type: string, customWidgetId?: string, size?: { w: number; h: number; minW?: number; minH?: number }) => void;
  onCreateCustom: () => void;
  onClose: () => void;
}

// ─── Icons per system widget type ────────────────────────────────────────────

const WIDGET_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  "total-runs": Activity,
  "failed-runs": XCircle,
  "pass-rate": CheckCircle,
  "bcbs239-score": ClipboardCheck,
  "pipeline-status": BarChart2,
  "dq-trend": TrendingUp,
  "severity-category": PieChart,
  "step-duration": Timer,
  "event-log": Activity,
  "pipeline-runs-table": Table2,
  "dq-checks-table": Table2,
  "dataset-overview": Layers,
};

const COUNTER_TYPES = ["total-runs", "failed-runs", "pass-rate", "bcbs239-score"];
const CHART_TYPES  = ["pipeline-status", "dq-trend", "severity-category", "step-duration", "event-log"];
const TABLE_TYPES  = ["pipeline-runs-table", "dq-checks-table"];
const OVERVIEW_TYPES = ["dataset-overview"];

const CATEGORY_LABELS: Record<string, string> = {
  counter: "Counters",
  chart: "Charts",
  table: "Tables",
  overview: "Overview",
};

function widgetCategory(type: string): string {
  if (COUNTER_TYPES.includes(type)) return "counter";
  if (CHART_TYPES.includes(type))   return "chart";
  if (TABLE_TYPES.includes(type))   return "table";
  return "overview";
}

// ─── Widget Picker Modal ──────────────────────────────────────────────────────

export function WidgetPickerModal({ onAdd, onCreateCustom, onClose }: Props) {
  const { customWidgets } = useDashboards();
  const { data: sharedWidgets = [] } = useSharedWidgets();
  const [search, setSearch] = useState("");
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    searchRef.current?.focus();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const q = search.toLowerCase();

  const filteredRegistry = WIDGET_REGISTRY.filter(
    (d) => d.label.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)
  );
  const filteredShared = sharedWidgets.filter(
    (w) => w.label.toLowerCase().includes(q) || (w.description ?? "").toLowerCase().includes(q)
  );
  const filteredCustom = customWidgets.filter(
    (w) => w.label.toLowerCase().includes(q) || (w.description ?? "").toLowerCase().includes(q)
  );

  const counters  = filteredRegistry.filter((d) => COUNTER_TYPES.includes(d.type));
  const charts    = filteredRegistry.filter((d) => CHART_TYPES.includes(d.type));
  const tables    = filteredRegistry.filter((d) => TABLE_TYPES.includes(d.type));
  const overviews = filteredRegistry.filter((d) => OVERVIEW_TYPES.includes(d.type));

  const handleAdd = (type: string, customWidgetId?: string, size?: { w: number; h: number; minW?: number; minH?: number }) => {
    const key = customWidgetId ?? type;
    onAdd(type, customWidgetId, size);
    setJustAdded((prev) => new Set(prev).add(key));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setJustAdded((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 1200);
  };

  const noResults = filteredRegistry.length === 0 && filteredShared.length === 0 && filteredCustom.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-2xl flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-elevated, 0 24px 48px rgba(27,59,107,0.18))",
          maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 pt-5 pb-4 shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
              style={{ color: "var(--color-text-muted)" }}
            />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && onClose()}
              placeholder="Search widgets…"
              className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{
                background: "var(--color-card)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>
          <button
            onClick={onCreateCustom}
            className="shrink-0 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium border"
            style={{ borderColor: "var(--color-accent)", color: "var(--color-accent)" }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Create widget</span>
            <span className="sm:hidden">New</span>
          </button>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-2"
            style={{ color: "var(--color-text-muted)" }}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {noResults && (
            <div className="py-12 text-center" style={{ color: "var(--color-text-muted)" }}>
              <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No widgets match <strong>"{search}"</strong></p>
              <button
                onClick={onCreateCustom}
                className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
                style={{ background: "var(--color-accent)", color: "#fff" }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Build a custom widget
              </button>
            </div>
          )}

          {/* Shared widgets */}
          {filteredShared.length > 0 && (
            <Section label="Shared" icon={<Globe className="h-3.5 w-3.5" />}>
              <div className="space-y-2">
                {filteredShared.map((sw) => (
                  <SharedCard
                    key={sw.id}
                    widget={sw}
                    added={justAdded.has(sw.id)}
                    onAdd={() => handleAdd("shared", sw.id, sw.defaultSize)}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* My widgets */}
          {filteredCustom.length > 0 && (
            <Section label="My Widgets" icon={<Star className="h-3.5 w-3.5" />}>
              <div className="space-y-2">
                {filteredCustom.map((cw) => (
                  <PersonalCard
                    key={cw.id}
                    widget={cw}
                    added={justAdded.has(cw.id)}
                    onAdd={() => handleAdd("custom", cw.id)}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* System — counters */}
          {counters.length > 0 && (
            <Section label="Counters">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {counters.map((def) => (
                  <SystemCard
                    key={def.type}
                    type={def.type}
                    label={def.label}
                    description={def.description}
                    added={justAdded.has(def.type)}
                    onAdd={() => handleAdd(def.type, undefined, def.defaultSize)}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Charts */}
          {charts.length > 0 && (
            <Section label="Charts">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {charts.map((def) => (
                  <SystemCard
                    key={def.type}
                    type={def.type}
                    label={def.label}
                    description={def.description}
                    added={justAdded.has(def.type)}
                    onAdd={() => handleAdd(def.type, undefined, def.defaultSize)}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Tables */}
          {tables.length > 0 && (
            <Section label="Tables">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {tables.map((def) => (
                  <SystemCard
                    key={def.type}
                    type={def.type}
                    label={def.label}
                    description={def.description}
                    added={justAdded.has(def.type)}
                    onAdd={() => handleAdd(def.type, undefined, def.defaultSize)}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Overview */}
          {overviews.length > 0 && (
            <Section label="Overview">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {overviews.map((def) => (
                  <SystemCard
                    key={def.type}
                    type={def.type}
                    label={def.label}
                    description={def.description}
                    added={justAdded.has(def.type)}
                    onAdd={() => handleAdd(def.type, undefined, def.defaultSize)}
                  />
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5">
        {icon && <span style={{ color: "var(--color-text-muted)" }}>{icon}</span>}
        <p
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "var(--color-text-muted)" }}
        >
          {label}
        </p>
      </div>
      {children}
    </section>
  );
}

function SystemCard({
  type, label, description, added, onAdd,
}: {
  type: string; label: string; description: string; added: boolean; onAdd: () => void;
}) {
  const Icon = WIDGET_ICONS[type];
  return (
    <button
      onClick={onAdd}
      className="flex flex-col items-start gap-2 rounded-xl p-3 text-left w-full transition-all"
      style={{
        border: `1px solid ${added ? "var(--color-success, #22c55e)" : "var(--color-border)"}`,
        background: added ? "rgba(34,197,94,0.06)" : "var(--color-card)",
      }}
      onMouseEnter={(e) => {
        if (!added) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-accent)";
      }}
      onMouseLeave={(e) => {
        if (!added) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border)";
      }}
    >
      <div className="flex items-center justify-between w-full">
        <div className="rounded-lg p-1.5" style={{ background: "var(--color-sidebar-active-bg)" }}>
          {Icon && <Icon className="h-3.5 w-3.5" style={{ color: "var(--color-accent)" }} />}
        </div>
        {added && <Check className="h-3.5 w-3.5" style={{ color: "var(--color-success, #22c55e)" }} />}
      </div>
      <div className="min-w-0 w-full">
        <p className="text-xs font-semibold leading-tight truncate" style={{ color: "var(--color-text)" }}>
          {label}
        </p>
        <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          {description}
        </p>
      </div>
    </button>
  );
}

function SharedCard({ widget, added, onAdd }: { widget: SharedWidgetDef; added: boolean; onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left w-full transition-all"
      style={{
        border: `1px solid ${added ? "var(--color-success, #22c55e)" : "var(--color-border)"}`,
        background: added ? "rgba(34,197,94,0.06)" : "var(--color-card)",
      }}
      onMouseEnter={(e) => {
        if (!added) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-accent)";
      }}
      onMouseLeave={(e) => {
        if (!added) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border)";
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>{widget.label}</p>
        {widget.description && (
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{widget.description}</p>
        )}
      </div>
      {added
        ? <Check className="h-4 w-4 shrink-0" style={{ color: "var(--color-success, #22c55e)" }} />
        : <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0" style={{ background: "rgba(200,137,42,0.12)", color: "var(--color-accent)" }}>Shared</span>
      }
    </button>
  );
}

function PersonalCard({ widget, added, onAdd }: { widget: CustomWidget; added: boolean; onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left w-full transition-all"
      style={{
        border: `1px solid ${added ? "var(--color-success, #22c55e)" : "var(--color-border)"}`,
        background: added ? "rgba(34,197,94,0.06)" : "var(--color-card)",
      }}
      onMouseEnter={(e) => {
        if (!added) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-accent)";
      }}
      onMouseLeave={(e) => {
        if (!added) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border)";
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>{widget.label}</p>
        {widget.description && (
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{widget.description}</p>
        )}
      </div>
      {added && <Check className="h-4 w-4 shrink-0" style={{ color: "var(--color-success, #22c55e)" }} />}
    </button>
  );
}
