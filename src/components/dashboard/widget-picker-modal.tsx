"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Search, Sparkles, Check, Globe, Star,
  ChevronLeft, ChevronRight,
  Activity, XCircle, CheckCircle, ClipboardCheck,
  BarChart2, TrendingUp, PieChart, Timer, Table2, Layers,
} from "lucide-react";
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
  "total-runs":          Activity,
  "failed-runs":         XCircle,
  "pass-rate":           CheckCircle,
  "bcbs239-score":       ClipboardCheck,
  "pipeline-status":     BarChart2,
  "dq-trend":            TrendingUp,
  "severity-category":   PieChart,
  "step-duration":       Timer,
  "event-log":           Activity,
  "pipeline-runs-table": Table2,
  "dq-checks-table":     Table2,
  "dataset-overview":    Layers,
};

// ─── Category definitions — driven by registry, no hardcoded lists ───────────

type TabId = "all" | "counters" | "charts" | "tables" | "overview" | "shared" | "mine";

interface Tab { id: TabId; label: string; icon?: React.ReactNode; }

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

  const filteredRegistry = WIDGET_REGISTRY.filter(
    (d) => d.label.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)
  );
  const filteredShared = sharedWidgets.filter(
    (w) => w.label.toLowerCase().includes(q) || (w.description ?? "").toLowerCase().includes(q)
  );
  const filteredCustom = customWidgets.filter(
    (w) => w.label.toLowerCase().includes(q) || (w.description ?? "").toLowerCase().includes(q)
  );

  const counters  = filteredRegistry.filter((d) => d.category === "counter");
  const charts    = filteredRegistry.filter((d) => d.category === "chart");
  const tables    = filteredRegistry.filter((d) => d.category === "table");
  const overviews = filteredRegistry.filter((d) => d.category === "overview");

  // Tabs — only show Shared/Mine if there are entries
  const tabs: Tab[] = [
    { id: "all",      label: "All" },
    { id: "counters", label: "Counters" },
    { id: "charts",   label: "Charts" },
    { id: "tables",   label: "Tables" },
    { id: "overview", label: "Overview" },
    ...(sharedWidgets.length > 0  ? [{ id: "shared" as TabId, label: "Shared",     icon: <Globe className="h-3 w-3" /> }] : []),
    ...(customWidgets.length > 0  ? [{ id: "mine"   as TabId, label: "My Widgets", icon: <Star  className="h-3 w-3" /> }] : []),
  ];

  // When user types, always show "all" so results aren't hidden behind a tab
  useEffect(() => { if (q) setActiveTab("all"); }, [q]);

  const handleAdd = (type: string, customWidgetId?: string, size?: { w: number; h: number; minW?: number; minH?: number }) => {
    const key = customWidgetId ?? type;
    onAdd(type, customWidgetId, size);
    setJustAdded((prev) => new Set(prev).add(key));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setJustAdded((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }, 1400);
  };

  const showCounters  = (activeTab === "all" || activeTab === "counters")  && counters.length > 0;
  const showCharts    = (activeTab === "all" || activeTab === "charts")    && charts.length > 0;
  const showTables    = (activeTab === "all" || activeTab === "tables")    && tables.length > 0;
  const showOverviews = (activeTab === "all" || activeTab === "overview")  && overviews.length > 0;
  const showShared    = (activeTab === "all" || activeTab === "shared")    && filteredShared.length > 0;
  const showMine      = (activeTab === "all" || activeTab === "mine")      && filteredCustom.length > 0;
  const noResults     = !showCounters && !showCharts && !showTables && !showOverviews && !showShared && !showMine;

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
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="shrink-0 px-5 pt-5 pb-0">
          <div className="flex items-center gap-3 mb-4">
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
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 transition-colors"
              style={{ color: "var(--color-text-muted)" }}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Tabs ──────────────────────────────────────────────────── */}
          {!q && (
            <div className="flex gap-1 overflow-x-auto pb-0 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: activeTab === tab.id ? "var(--color-accent)" : "transparent",
                    color: activeTab === tab.id ? "#fff" : "var(--color-text-muted)",
                    border: activeTab === tab.id ? "1px solid transparent" : "1px solid var(--color-border)",
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 -mx-5" style={{ borderTop: "1px solid var(--color-border)" }} />
        </div>

        {/* ── Scrollable body ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 min-h-0">
          {noResults && (
            <div className="py-12 text-center" style={{ color: "var(--color-text-muted)" }}>
              <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">{q ? <>No widgets match <strong>"{search}"</strong></> : "No widgets in this category."}</p>
              {q && (
                <button
                  onClick={onCreateCustom}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
                  style={{ background: "var(--color-accent)", color: "#fff" }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Build a custom widget for &ldquo;{search}&rdquo;
                </button>
              )}
            </div>
          )}

          {/* Shared widgets */}
          {showShared && (
            <Section label="Shared" icon={<Globe className="h-3.5 w-3.5" />}>
              <WidgetGrid cols={2}>
                {filteredShared.map((sw) => (
                  <WidgetCard
                    key={sw.id}
                    label={sw.label}
                    description={sw.description ?? ""}
                    badge="Shared"
                    added={justAdded.has(sw.id)}
                    onAdd={() => handleAdd("shared", sw.id, sw.defaultSize)}
                  />
                ))}
              </WidgetGrid>
            </Section>
          )}

          {/* My widgets */}
          {showMine && (
            <Section label="My Widgets" icon={<Star className="h-3.5 w-3.5" />}>
              <WidgetGrid cols={2}>
                {filteredCustom.map((cw) => (
                  <WidgetCard
                    key={cw.id}
                    label={cw.label}
                    description={cw.description ?? ""}
                    added={justAdded.has(cw.id)}
                    onAdd={() => handleAdd("custom", cw.id)}
                  />
                ))}
              </WidgetGrid>
            </Section>
          )}

          {/* Counters */}
          {showCounters && (
            <Section label="Counters">
              <WidgetGrid cols={4}>
                {counters.map((def) => (
                  <SystemWidgetCard
                    key={def.type}
                    type={def.type}
                    label={def.label}
                    description={def.description}
                    added={justAdded.has(def.type)}
                    onAdd={() => handleAdd(def.type, undefined, def.defaultSize)}
                  />
                ))}
              </WidgetGrid>
            </Section>
          )}

          {/* Charts */}
          {showCharts && (
            <Section label="Charts">
              <WidgetGrid cols={3}>
                {charts.map((def) => (
                  <SystemWidgetCard
                    key={def.type}
                    type={def.type}
                    label={def.label}
                    description={def.description}
                    added={justAdded.has(def.type)}
                    onAdd={() => handleAdd(def.type, undefined, def.defaultSize)}
                  />
                ))}
              </WidgetGrid>
            </Section>
          )}

          {/* Tables */}
          {showTables && (
            <Section label="Tables">
              <WidgetGrid cols={3}>
                {tables.map((def) => (
                  <SystemWidgetCard
                    key={def.type}
                    type={def.type}
                    label={def.label}
                    description={def.description}
                    added={justAdded.has(def.type)}
                    onAdd={() => handleAdd(def.type, undefined, def.defaultSize)}
                  />
                ))}
              </WidgetGrid>
            </Section>
          )}

          {/* Overview */}
          {showOverviews && (
            <Section label="Overview">
              <WidgetGrid cols={2}>
                {overviews.map((def) => (
                  <SystemWidgetCard
                    key={def.type}
                    type={def.type}
                    label={def.label}
                    description={def.description}
                    added={justAdded.has(def.type)}
                    onAdd={() => handleAdd(def.type, undefined, def.defaultSize)}
                  />
                ))}
              </WidgetGrid>
            </Section>
          )}
        </div>

        {/* ── Footer CTA ────────────────────────────────────────────────── */}
        <div
          className="shrink-0 px-5 py-4 flex items-center justify-between gap-3"
          style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-surface)" }}
        >
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Need something specific? Build a widget with your own query.
          </p>
          <button
            onClick={onCreateCustom}
            className="shrink-0 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            <Sparkles className="h-4 w-4" />
            Build custom widget
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Section({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        {icon && <span style={{ color: "var(--color-text-muted)" }}>{icon}</span>}
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
          {label}
        </p>
      </div>
      {children}
    </section>
  );
}

function WidgetGrid({ cols, children }: { cols: number; children: React.ReactNode }) {
  const colClass =
    cols === 4 ? "grid-cols-2 sm:grid-cols-4"
    : cols === 3 ? "grid-cols-2 sm:grid-cols-3"
    : "grid-cols-1 sm:grid-cols-2";
  return <div className={`grid ${colClass} gap-2`}>{children}</div>;
}

// ─── Unified widget card ──────────────────────────────────────────────────────

interface CardProps {
  label: string;
  description: string;
  badge?: string;
  added: boolean;
  onAdd: () => void;
  icon?: React.ReactNode;
}

function WidgetCard({ label, description, badge, added, onAdd, icon }: CardProps) {
  return (
    <button
      onClick={onAdd}
      className="group flex flex-col items-start gap-2 rounded-xl p-3 text-left w-full transition-all"
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
      <div className="flex items-start justify-between w-full gap-2">
        {icon ? (
          <div className="rounded-lg p-1.5 shrink-0" style={{ background: "var(--color-sidebar-active-bg)" }}>
            {icon}
          </div>
        ) : (
          <div className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0" style={{ background: "var(--color-accent)", opacity: 0.5 }} />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-tight truncate" style={{ color: "var(--color-text)" }}>
            {label}
          </p>
          <p className="text-[10px] mt-0.5 leading-relaxed line-clamp-2" style={{ color: "var(--color-text-muted)" }}>
            {description}
          </p>
        </div>
        <div className="shrink-0">
          {added ? (
            <Check className="h-3.5 w-3.5" style={{ color: "var(--color-success, #22c55e)" }} />
          ) : badge ? (
            <span
              className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
              style={{ background: "rgba(200,137,42,0.12)", color: "var(--color-accent)" }}
            >
              {badge}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function SystemWidgetCard({
  type, label, description, added, onAdd,
}: {
  type: string; label: string; description: string; added: boolean; onAdd: () => void;
}) {
  const Icon = WIDGET_ICONS[type];
  return (
    <WidgetCard
      label={label}
      description={description}
      added={added}
      onAdd={onAdd}
      icon={Icon && <Icon className="h-3.5 w-3.5" style={{ color: "var(--color-accent)" }} />}
    />
  );
}

// ─── Widget Picker Drawer (side panel, auto-opens in edit mode) ───────────────

interface DrawerProps extends Props {
  open: boolean;
}

export function WidgetPickerDrawer({ open, onAdd, onCreateCustom, onClose }: DrawerProps) {
  const { customWidgets } = useDashboards();
  const { data: sharedWidgets = [] } = useSharedWidgets();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus search when drawer opens
  useEffect(() => {
    if (open && !collapsed) {
      setTimeout(() => searchRef.current?.focus(), 150);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [open, collapsed]);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setSearch("");
      setActiveTab("all");
      setCollapsed(false);
    }
  }, [open]);

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

  const counters  = filteredRegistry.filter((d) => d.category === "counter");
  const charts    = filteredRegistry.filter((d) => d.category === "chart");
  const tables    = filteredRegistry.filter((d) => d.category === "table");
  const overviews = filteredRegistry.filter((d) => d.category === "overview");

  const tabs: Tab[] = [
    { id: "all",      label: "All" },
    { id: "counters", label: "Counters" },
    { id: "charts",   label: "Charts" },
    { id: "tables",   label: "Tables" },
    { id: "overview", label: "Overview" },
    ...(sharedWidgets.length > 0 ? [{ id: "shared" as TabId, label: "Shared", icon: <Globe className="h-3 w-3" /> }] : []),
    ...(customWidgets.length > 0 ? [{ id: "mine"   as TabId, label: "My Widgets", icon: <Star className="h-3 w-3" /> }] : []),
  ];

  useEffect(() => { if (q) setActiveTab("all"); }, [q]);

  const handleAdd = useCallback((type: string, customWidgetId?: string, size?: { w: number; h: number; minW?: number; minH?: number }) => {
    const key = customWidgetId ?? type;
    onAdd(type, customWidgetId, size);
    setJustAdded((prev) => new Set(prev).add(key));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setJustAdded((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }, 1400);
  }, [onAdd]);

  const showCounters  = (activeTab === "all" || activeTab === "counters")  && counters.length > 0;
  const showCharts    = (activeTab === "all" || activeTab === "charts")    && charts.length > 0;
  const showTables    = (activeTab === "all" || activeTab === "tables")    && tables.length > 0;
  const showOverviews = (activeTab === "all" || activeTab === "overview")  && overviews.length > 0;
  const showShared    = (activeTab === "all" || activeTab === "shared")    && filteredShared.length > 0;
  const showMine      = (activeTab === "all" || activeTab === "mine")      && filteredCustom.length > 0;
  const noResults     = !showCounters && !showCharts && !showTables && !showOverviews && !showShared && !showMine;

  return (
    <div
      className="flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden"
      style={{
        width: open ? (collapsed ? 40 : 280) : 0,
        opacity: open ? 1 : 0,
        borderLeft: open ? "1px solid var(--color-border)" : "none",
        background: "var(--color-surface)",
        position: "sticky",
        top: "1rem",
        height: "calc(100vh - 2rem)",
        alignSelf: "flex-start",
      }}
    >
      {/* Collapsed state — icon strip to expand */}
      {open && collapsed && (
        <div className="flex flex-col h-full items-center py-3">
          <button
            onClick={() => setCollapsed(false)}
            className="flex items-center justify-center w-8 h-8 rounded-md transition-colors"
            style={{ color: "var(--color-text-muted)" }}
            title="Open widget panel"
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)"; }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Content — hidden when collapsed */}
      {open && !collapsed && (
        <div className="flex flex-col h-full min-h-0">
          {/* Header */}
          <div className="shrink-0 px-3 pt-3 pb-0">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 relative">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
                  style={{ color: "var(--color-text-muted)" }}
                />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search widgets…"
                  className="w-full rounded-lg border pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1"
                  style={{
                    background: "var(--color-card)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className="shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-colors"
                style={{ color: "var(--color-text-muted)" }}
                title="Collapse widget panel"
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)"; }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            {!q && (
              <div className="flex flex-wrap gap-1 pb-0">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all"
                    style={{
                      background: activeTab === tab.id ? "var(--color-accent)" : "transparent",
                      color: activeTab === tab.id ? "#fff" : "var(--color-text-muted)",
                      border: activeTab === tab.id ? "1px solid transparent" : "1px solid var(--color-border)",
                    }}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 -mx-3" style={{ borderTop: "1px solid var(--color-border)" }} />
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 min-h-0">
            {noResults && (
              <div className="py-8 text-center" style={{ color: "var(--color-text-muted)" }}>
                <Search className="h-6 w-6 mx-auto mb-2 opacity-40" />
                <p className="text-xs">{q ? <>No results for <strong>"{search}"</strong></> : "No widgets."}</p>
              </div>
            )}

            {showShared && (
              <DrawerSection label="Shared" icon={<Globe className="h-3 w-3" />}>
                {filteredShared.map((sw) => (
                  <DrawerWidgetRow
                    key={sw.id}
                    label={sw.label}
                    description={sw.description ?? ""}
                    badge="Shared"
                    added={justAdded.has(sw.id)}
                    onAdd={() => handleAdd("shared", sw.id, sw.defaultSize)}
                  />
                ))}
              </DrawerSection>
            )}

            {showMine && (
              <DrawerSection label="My Widgets" icon={<Star className="h-3 w-3" />}>
                {filteredCustom.map((cw) => (
                  <DrawerWidgetRow
                    key={cw.id}
                    label={cw.label}
                    description={cw.description ?? ""}
                    added={justAdded.has(cw.id)}
                    onAdd={() => handleAdd("custom", cw.id)}
                  />
                ))}
              </DrawerSection>
            )}

            {showCounters && (
              <DrawerSection label="Counters">
                {counters.map((def) => (
                  <DrawerWidgetRow
                    key={def.type}
                    label={def.label}
                    description={def.description}
                    type={def.type}
                    added={justAdded.has(def.type)}
                    onAdd={() => handleAdd(def.type, undefined, def.defaultSize)}
                  />
                ))}
              </DrawerSection>
            )}

            {showCharts && (
              <DrawerSection label="Charts">
                {charts.map((def) => (
                  <DrawerWidgetRow
                    key={def.type}
                    label={def.label}
                    description={def.description}
                    type={def.type}
                    added={justAdded.has(def.type)}
                    onAdd={() => handleAdd(def.type, undefined, def.defaultSize)}
                  />
                ))}
              </DrawerSection>
            )}

            {showTables && (
              <DrawerSection label="Tables">
                {tables.map((def) => (
                  <DrawerWidgetRow
                    key={def.type}
                    label={def.label}
                    description={def.description}
                    type={def.type}
                    added={justAdded.has(def.type)}
                    onAdd={() => handleAdd(def.type, undefined, def.defaultSize)}
                  />
                ))}
              </DrawerSection>
            )}

            {showOverviews && (
              <DrawerSection label="Overview">
                {overviews.map((def) => (
                  <DrawerWidgetRow
                    key={def.type}
                    label={def.label}
                    description={def.description}
                    type={def.type}
                    added={justAdded.has(def.type)}
                    onAdd={() => handleAdd(def.type, undefined, def.defaultSize)}
                  />
                ))}
              </DrawerSection>
            )}
          </div>

          {/* Footer */}
          <div
            className="shrink-0 px-3 py-3"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            <button
              onClick={onCreateCustom}
              className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
              style={{ background: "var(--color-accent)", color: "#fff" }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Custom widget bouwen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Drawer sub-components ────────────────────────────────────────────────────

function DrawerSection({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <div className="flex items-center gap-1.5">
        {icon && <span style={{ color: "var(--color-text-muted)" }}>{icon}</span>}
        <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
          {label}
        </p>
      </div>
      {children}
    </section>
  );
}

function DrawerWidgetRow({
  label, description, type, badge, added, onAdd,
}: {
  label: string; description: string; type?: string; badge?: string; added: boolean; onAdd: () => void;
}) {
  const Icon = type ? WIDGET_ICONS[type] : undefined;
  return (
    <button
      onClick={onAdd}
      className="group w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all"
      style={{
        border: `1px solid ${added ? "var(--color-success, #22c55e)" : "transparent"}`,
        background: added ? "rgba(34,197,94,0.06)" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!added) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)";
      }}
      onMouseLeave={(e) => {
        if (!added) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      {Icon ? (
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-accent)" }} />
      ) : (
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--color-accent)", opacity: 0.5 }} />
      )}
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
