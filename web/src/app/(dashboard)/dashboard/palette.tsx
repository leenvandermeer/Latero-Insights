"use client";

import { ChevronLeft, ChevronRight, Hash, BarChart2, Star, Search, Activity, XCircle, CheckCircle, ClipboardCheck, TrendingUp, PieChart, Timer, Check, Table2, Layers, Trash2, Globe, Upload } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { WIDGET_REGISTRY } from "./registry";
import { useDashboards } from "@/contexts/dashboard-context";
import { useSharedWidgets, useWithdrawWidget } from "@/hooks/use-shared-widgets";
import { PublishWidgetDialog } from "@/components/dashboard/publish-widget-dialog";
import type { CustomWidget } from "@/types/dashboard";

interface LibraryPanelProps {
  onAdd: (type: string, customWidgetId?: string, size?: { w: number; h: number; minW?: number; minH?: number }) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onDragStart?: (type: string, size: { w: number; h: number }, customWidgetId?: string) => void;
  onDragEnd?: () => void;
}

const COUNTER_TYPES = ["total-runs", "failed-runs", "pass-rate", "bcbs239-score"];
const CHART_TYPES = ["pipeline-status", "dq-trend", "severity-category", "step-duration", "event-log"];
const TABLE_TYPES = ["pipeline-runs-table", "dq-checks-table"];
const OVERVIEW_TYPES = ["dataset-overview"];

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

export function LeftLibraryPanel({ onAdd, collapsed, onToggleCollapse, onDragStart, onDragEnd }: LibraryPanelProps) {
  const { customWidgets, deleteCustomWidget, withdrawSharedWidget, dashboards } = useDashboards();
  const { data: sharedWidgets = [] } = useSharedWidgets();
  const { mutateAsync: withdrawFromServer } = useWithdrawWidget();
  const [search, setSearch] = useState("");
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
  const [publishTarget, setPublishTarget] = useState<CustomWidget | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAdd = (type: string, customWidgetId?: string) => {
    onAdd(type, customWidgetId);
    if (type !== "custom") {
      setJustAdded((prev) => new Set(prev).add(type));
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setJustAdded((prev) => {
          const next = new Set(prev);
          next.delete(type);
          return next;
        });
      }, 600);
    }
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const filteredRegistry = WIDGET_REGISTRY.filter((d) =>
    d.label.toLowerCase().includes(search.toLowerCase()) ||
    d.description.toLowerCase().includes(search.toLowerCase())
  );
  const filteredCustom = customWidgets.filter((cw) =>
    cw.label.toLowerCase().includes(search.toLowerCase())
  );
  const filteredShared = sharedWidgets.filter((sw) =>
    sw.label.toLowerCase().includes(search.toLowerCase()) ||
    (sw.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleWithdraw = async (id: string) => {
    const sw = sharedWidgets.find((w) => w.id === id);
    if (!sw) return;
    await withdrawFromServer(id);
    withdrawSharedWidget(sw);
  };

  const counters = filteredRegistry.filter((d) => COUNTER_TYPES.includes(d.type));
  const charts = filteredRegistry.filter((d) => CHART_TYPES.includes(d.type));

  /** Count how many dashboards (user + system overrides) use a given custom widget */
  function impactCount(customWidgetId: string): number {
    return dashboards.filter((d) =>
      d.widgets.some((w) => w.type === "custom" && w.customWidgetId === customWidgetId)
    ).length;
  }

  if (collapsed) {
    return (
      <div
        className="flex flex-col h-full transition-all duration-200"
        style={{
          width: 52,
          borderRight: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-full py-3"
          style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}
          aria-label="Expand library"
          title="Expand widget library"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Category icon buttons */}
        {customWidgets.length > 0 && (
          <button
            onClick={onToggleCollapse}
            className="flex items-center justify-center w-full py-3"
            style={{ color: "var(--color-text-muted)" }}
            title="My Widgets"
          >
            <Star className="h-4 w-4" />
          </button>
        )}
        {sharedWidgets.length > 0 && (
          <button
            onClick={onToggleCollapse}
            className="flex items-center justify-center w-full py-3"
            style={{ color: "var(--color-text-muted)" }}
            title="Shared"
          >
            <Globe className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-full py-3"
          style={{ color: "var(--color-text-muted)" }}
          title="Counters"
        >
          <Hash className="h-4 w-4" />
        </button>
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-full py-3"
          style={{ color: "var(--color-text-muted)" }}
          title="Charts"
        >
          <BarChart2 className="h-4 w-4" />
        </button>
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-full py-3"
          style={{ color: "var(--color-text-muted)" }}
          title="Tables"
        >
          <Table2 className="h-4 w-4" />
        </button>
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-full py-3"
          style={{ color: "var(--color-text-muted)" }}
          title="Overview"
        >
          <Layers className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full transition-all duration-200"
      style={{
        width: 260,
        borderRight: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <h2 className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>Widget Library</h2>
        <button
          onClick={onToggleCollapse}
          className="rounded-md p-1.5 transition-colors"
          style={{ color: "var(--color-text-muted)" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
          aria-label="Collapse library"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search widgets…"
            aria-label="Search widget library"
            className="w-full rounded-lg border pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
          />
        </div>
      </div>

      {/* Scrollable content — order: System → Shared → Personal (LADR-012) */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-5">
        {/* Counters */}
          {counters.length > 0 && (
            <section>
              <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
                Counters
              </p>
              <div className="grid grid-cols-2 gap-2">
                {counters.map((def) => {
                  const Icon = WIDGET_ICONS[def.type];
                  return (
                    <button
                      key={def.type}
                      onClick={() => handleAdd(def.type)}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", def.type); onDragStart?.(def.type, def.defaultSize); }}
                      onDragEnd={() => onDragEnd?.()}
                      className="flex flex-col items-start gap-2 rounded-xl p-3 text-left w-full transition-all relative cursor-grab active:cursor-grabbing"
                      style={{
                        border: `1px solid ${justAdded.has(def.type) ? "var(--color-success, #22c55e)" : "var(--color-border)"}`,
                        background: justAdded.has(def.type) ? "rgba(34,197,94,0.06)" : "var(--color-card)",
                      }}
                      onMouseEnter={(e) => { if (!justAdded.has(def.type)) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-accent)"; }}
                      onMouseLeave={(e) => { if (!justAdded.has(def.type)) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border)"; }}
                    >
                      <div className="rounded-lg p-2" style={{ background: "var(--color-sidebar-active-bg)" }}>
                        {Icon && <Icon className="h-4 w-4" style={{ color: "var(--color-accent)" }} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold leading-tight" style={{ color: "var(--color-text)" }}>{def.label}</p>
                        <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{def.description}</p>
                      </div>
                      {justAdded.has(def.type) && (
                        <div className="absolute top-2 right-2">
                          <Check className="h-3.5 w-3.5" style={{ color: "var(--color-success, #22c55e)" }} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Charts */}
          {charts.length > 0 && (
            <section>
              <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
                Charts
              </p>
              <div className="grid grid-cols-2 gap-2">
                {charts.map((def) => {
                  const Icon = WIDGET_ICONS[def.type];
                  return (
                    <button
                      key={def.type}
                      onClick={() => handleAdd(def.type)}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", def.type); onDragStart?.(def.type, def.defaultSize); }}
                      onDragEnd={() => onDragEnd?.()}
                      className="flex flex-col items-start gap-2 rounded-xl p-3 text-left w-full transition-all relative cursor-grab active:cursor-grabbing"
                      style={{
                        border: `1px solid ${justAdded.has(def.type) ? "var(--color-success, #22c55e)" : "var(--color-border)"}`,
                        background: justAdded.has(def.type) ? "rgba(34,197,94,0.06)" : "var(--color-card)",
                      }}
                      onMouseEnter={(e) => { if (!justAdded.has(def.type)) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-accent)"; }}
                      onMouseLeave={(e) => { if (!justAdded.has(def.type)) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border)"; }}
                    >
                      <div className="rounded-lg p-2" style={{ background: "var(--color-sidebar-active-bg)" }}>
                        {Icon && <Icon className="h-4 w-4" style={{ color: "var(--color-accent)" }} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold leading-tight" style={{ color: "var(--color-text)" }}>{def.label}</p>
                        <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{def.description}</p>
                      </div>
                      {justAdded.has(def.type) && (
                        <div className="absolute top-2 right-2">
                          <Check className="h-3.5 w-3.5" style={{ color: "var(--color-success, #22c55e)" }} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Tables */}
          {filteredRegistry.filter((d) => TABLE_TYPES.includes(d.type)).length > 0 && (
            <section>
              <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
                Tables
              </p>
              <div className="grid grid-cols-2 gap-2">
                {filteredRegistry
                  .filter((d) => TABLE_TYPES.includes(d.type))
                  .map((def) => {
                    const Icon = WIDGET_ICONS[def.type];
                    return (
                      <button
                        key={def.type}
                        onClick={() => handleAdd(def.type)}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData("text/plain", def.type); onDragStart?.(def.type, def.defaultSize); }}
                        onDragEnd={() => onDragEnd?.()}
                        className="flex flex-col items-start gap-2 rounded-xl p-3 text-left w-full transition-all relative cursor-grab active:cursor-grabbing"
                        style={{
                          border: `1px solid ${justAdded.has(def.type) ? "var(--color-success, #22c55e)" : "var(--color-border)"}`,
                          background: justAdded.has(def.type) ? "rgba(34,197,94,0.06)" : "var(--color-card)",
                        }}
                        onMouseEnter={(e) => { if (!justAdded.has(def.type)) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-accent)"; }}
                        onMouseLeave={(e) => { if (!justAdded.has(def.type)) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border)"; }}
                      >
                        <div className="rounded-lg p-2" style={{ background: "var(--color-sidebar-active-bg)" }}>
                          {Icon && <Icon className="h-4 w-4" style={{ color: "var(--color-accent)" }} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold leading-tight" style={{ color: "var(--color-text)" }}>{def.label}</p>
                          <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{def.description}</p>
                        </div>
                        {justAdded.has(def.type) && (
                          <div className="absolute top-2 right-2">
                            <Check className="h-3.5 w-3.5" style={{ color: "var(--color-success, #22c55e)" }} />
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>
            </section>
          )}

          {/* Overview */}
          {filteredRegistry.filter((d) => OVERVIEW_TYPES.includes(d.type)).length > 0 && (
            <section>
              <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
                Overview
              </p>
              <div className="space-y-2">
                {filteredRegistry
                  .filter((d) => OVERVIEW_TYPES.includes(d.type))
                  .map((def) => {
                    const Icon = WIDGET_ICONS[def.type];
                    return (
                      <button
                        key={def.type}
                        onClick={() => handleAdd(def.type)}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData("text/plain", def.type); onDragStart?.(def.type, def.defaultSize); }}
                        onDragEnd={() => onDragEnd?.()}
                        className="flex items-start gap-3 rounded-xl p-3 text-left w-full transition-all relative cursor-grab active:cursor-grabbing"
                        style={{
                          border: `1px solid ${justAdded.has(def.type) ? "var(--color-success, #22c55e)" : "var(--color-border)"}`,
                          background: justAdded.has(def.type) ? "rgba(34,197,94,0.06)" : "var(--color-card)",
                        }}
                        onMouseEnter={(e) => { if (!justAdded.has(def.type)) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-accent)"; }}
                        onMouseLeave={(e) => { if (!justAdded.has(def.type)) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border)"; }}
                      >
                        <div className="rounded-lg p-2 shrink-0" style={{ background: "var(--color-sidebar-active-bg)" }}>
                          {Icon && <Icon className="h-4 w-4" style={{ color: "var(--color-accent)" }} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold leading-tight" style={{ color: "var(--color-text)" }}>{def.label}</p>
                          <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{def.description}</p>
                        </div>
                        {justAdded.has(def.type) && (
                          <div className="absolute top-2 right-2">
                            <Check className="h-3.5 w-3.5" style={{ color: "var(--color-success, #22c55e)" }} />
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>
            </section>
          )}

          {/* Shared */}
          {filteredShared.length > 0 && (
            <section>
              <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
                Shared
              </p>
              <div className="space-y-2">
                {filteredShared.map((sw) => (
                  <div
                    key={sw.id}
                    className="flex items-start gap-3 rounded-xl p-3 cursor-grab active:cursor-grabbing"
                    style={{ border: "1px solid var(--color-border)" }}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", "shared"); onDragStart?.("shared", sw.defaultSize, sw.id); }}
                    onDragEnd={() => onDragEnd?.()}
                    onClick={() => handleAdd("shared", sw.id)}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "var(--color-sidebar-hover)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>{sw.label}</p>
                        <span
                          className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: "rgba(200,137,42,0.12)", color: "var(--color-accent)" }}
                        >
                          Shared
                        </span>
                      </div>
                      {sw.description && (
                        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{sw.description}</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Withdraw "${sw.label}" from the shared library?`)) {
                          void handleWithdraw(sw.id);
                        }
                      }}
                      className="rounded-md p-1 transition-colors shrink-0"
                      style={{ color: "var(--color-text-muted)" }}
                      onMouseEnter={(e) => { e.stopPropagation(); (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                      title="Withdraw from shared library"
                      aria-label={`Withdraw ${sw.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* My Widgets (Personal) */}
          {filteredCustom.length > 0 && (
            <section>
              <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
                My Widgets
              </p>
              <div className="space-y-2">
                {filteredCustom.map((cw) => (
                  <div
                    key={cw.id}
                    className="flex items-start gap-3 rounded-xl p-3 cursor-grab active:cursor-grabbing"
                    style={{ border: "1px solid var(--color-border)" }}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", "custom"); onDragStart?.("custom", { w: 3, h: 2 }, cw.id); }}
                    onDragEnd={() => onDragEnd?.()}
                    onClick={() => handleAdd("custom", cw.id)}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "var(--color-sidebar-hover)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>{cw.label}</p>
                      {cw.description && (
                        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{cw.description}</p>
                      )}
                      {impactCount(cw.id) > 0 && (
                        <p className="text-[10px] mt-1" style={{ color: "var(--color-text-muted)" }}>
                          Used in {impactCount(cw.id)} dashboard{impactCount(cw.id) !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setPublishTarget(cw); }}
                        className="rounded-md p-1 transition-colors"
                        style={{ color: "var(--color-text-muted)" }}
                        onMouseEnter={(e) => { e.stopPropagation(); (e.currentTarget as HTMLButtonElement).style.color = "var(--color-accent)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(200,137,42,0.08)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                        title="Publish to shared library"
                        aria-label={`Publish ${cw.label}`}
                      >
                        <Upload className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const count = impactCount(cw.id);
                          const msg = count > 0
                            ? `"${cw.label}" is used in ${count} dashboard${count !== 1 ? "s" : ""}. Removing it will also remove those widget instances. Continue?`
                            : `Remove "${cw.label}" from your widget library?`;
                          if (window.confirm(msg)) deleteCustomWidget(cw.id);
                        }}
                        className="rounded-md p-1 transition-colors"
                        style={{ color: "var(--color-text-muted)" }}
                        onMouseEnter={(e) => { e.stopPropagation(); (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                        title="Remove widget from library"
                        aria-label={`Remove ${cw.label}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
      </div>

      <PublishWidgetDialog
        widget={publishTarget}
        onClose={() => setPublishTarget(null)}
      />
    </div>
  );
}
