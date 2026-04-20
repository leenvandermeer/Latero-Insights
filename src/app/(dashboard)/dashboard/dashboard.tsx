"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { ResponsiveGridLayout, useContainerWidth, verticalCompactor, type LayoutItem, type ResponsiveLayouts } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { Settings2, X, GripVertical, LayoutGrid, Pencil, RotateCcw, Copy, Trash2, Check, MoreHorizontal, Sparkles, ChevronDown, Plus } from "lucide-react";
import { useDateRange } from "@/hooks";
import { DateRangePicker, Button } from "@/components/ui";
import { useDashboards } from "@/contexts/dashboard-context";
import { NewDashboardModal } from "@/components/dashboard/new-dashboard-modal";
import { DashboardSettingsDialog } from "@/components/dashboard/dashboard-settings-dialog";
import { WidgetPickerModal } from "@/components/dashboard/widget-picker-modal";
import { getWidgetDef, WIDGET_REGISTRY } from "./registry";
import { WidgetConfigPanel } from "./widget-config-panel";
import { CustomWidgetRenderer } from "./widgets/custom-widget";
import type { WidgetSlot } from "@/types/dashboard";

interface Props {
  dashboardId: string;
}

function layoutsEqual(a: ResponsiveLayouts, b: ResponsiveLayouts): boolean {
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every((bp) => {
    const ia = a[bp] ?? [];
    const ib = b[bp] ?? [];
    if (ia.length !== ib.length) return false;
    const ibMap = new Map(ib.map((item) => [item.i, item]));
    return ia.every((item) => {
      const o = ibMap.get(item.i);
      return o !== undefined &&
        item.x === o.x && item.y === o.y &&
        item.w === o.w && item.h === o.h;
    });
  });
}

export function DashboardCanvas({ dashboardId }: Props) {
  const { getDashboardById, updateDashboardContent, renameDash, deleteDash, resetDash, duplicateDash, systemDashboards, userDashboards } = useDashboards();
  const { from, to, setRange } = useDateRange();
  const [editMode, setEditMode] = useState(false);
  const [configTarget, setConfigTarget] = useState<WidgetSlot | null>(null);
  const [draggingWidget, setDraggingWidget] = useState<{ type: string; size: { w: number; h: number }; customWidgetId?: string } | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [dashPickerOpen, setDashPickerOpen] = useState(false);
  const [newDashOpen, setNewDashOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const router = useRouter();
  const { width, containerRef } = useContainerWidth();
  const layoutsRef = useRef<ResponsiveLayouts>({});
  const widgetsRef = useRef<WidgetSlot[]>([]);

  useEffect(() => { setMounted(true); }, []);

  const dashboard = getDashboardById(dashboardId);

  useEffect(() => {
    if (dashboard) {
      setNameInput(dashboard.name);
      setDescInput(dashboard.description ?? "");
      layoutsRef.current = dashboard.layout;
    }
    setEditMode(false);

    setPendingRemove(null);
    setConfigTarget(null);
    setMenuOpen(false);
    setDashPickerOpen(false);
    setEditingName(false);
  }, [dashboardId]);

  const widgets: WidgetSlot[] = useMemo(() => dashboard?.widgets ?? [], [dashboard]);
  // Filter orphaned layout items — items with no corresponding widget slot
  // cause empty ghost gaps in the grid. This can happen when widget types
  // are removed from the registry or after manual edits.
  const validIds = useMemo(() => new Set(widgets.map((w) => w.instanceId)), [widgets]);
  const layouts: ResponsiveLayouts = useMemo(() => {
    const raw = dashboard?.layout ?? {};
    return Object.fromEntries(
      Object.entries(raw).map(([bp, items]) => [
        bp,
        (items ?? []).filter((item) => validIds.has(item.i)),
      ])
    );
  }, [dashboard?.layout, validIds]);
  widgetsRef.current = widgets; // keep ref in sync on every render

  const saveContent = useCallback((nextWidgets: WidgetSlot[], nextLayouts: ResponsiveLayouts) => {
    layoutsRef.current = nextLayouts;
    updateDashboardContent(dashboardId, nextWidgets, nextLayouts);
  }, [dashboardId, updateDashboardContent]);

  const handleLayoutChange = useCallback((_current: readonly LayoutItem[], all: ResponsiveLayouts) => {
    if (layoutsEqual(all, layoutsRef.current)) return;
    saveContent(widgetsRef.current, all);
  }, [saveContent]);

  const addWidget = useCallback((type: string, customWidgetId?: string, sizeOverride?: { w: number; h: number; minW?: number; minH?: number }) => {
    const def = type === "custom" || type === "shared" ? null : getWidgetDef(type);
    const defaultSize = sizeOverride ?? def?.defaultSize ?? { w: 3, h: 2, minW: 2, minH: 2 };
    const instanceId = `${type}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;  
    const newSlot: WidgetSlot = { instanceId, type, ...(customWidgetId && { customWidgetId }) };

    const lgItems = [...(layouts.lg ?? [])];
    const mdItems = [...(layouts.md ?? layouts.lg ?? [])];
    const smItems = [...(layouts.sm ?? layouts.lg ?? [])];

    const lgW = defaultSize.w;
    const mdW = Math.min(defaultSize.w, 8);
    const smW = Math.min(defaultSize.w, 4);

    const lgPos = findPlacement(12, lgItems, lgW, defaultSize.h);
    const mdPos = findPlacement(8, mdItems, mdW, defaultSize.h);
    const smPos = findPlacement(4, smItems, smW, defaultSize.h);

    const newItem: LayoutItem = { i: instanceId, ...lgPos, w: lgW, h: defaultSize.h, minW: defaultSize.minW ?? 2, minH: defaultSize.minH ?? 2 };
    const mdItem: LayoutItem = { ...newItem, ...mdPos, w: mdW, minW: Math.min(defaultSize.minW ?? 2, 8) };
    const smItem: LayoutItem = { ...newItem, ...smPos, w: smW, minW: Math.min(defaultSize.minW ?? 2, 4) };

    const nextLayouts: ResponsiveLayouts = {
      lg: [...lgItems, newItem],
      md: [...mdItems, mdItem],
      sm: [...smItems, smItem],
    };
    saveContent([...widgets, newSlot], nextLayouts);
  }, [widgets, layouts, saveContent]);

  const removeWidget = useCallback((instanceId: string) => {
    const nextWidgets = widgets.filter((w) => w.instanceId !== instanceId);
    const nextLayouts: ResponsiveLayouts = {};
    for (const bp of Object.keys(layouts)) {
      nextLayouts[bp] = (layouts[bp] ?? []).filter((item) => item.i !== instanceId);
    }
    saveContent(nextWidgets, nextLayouts);
  }, [widgets, layouts, saveContent]);

  const updateSlotConfig = useCallback((instanceId: string, patch: Partial<WidgetSlot>, size?: { w: number; h: number }) => {
    const nextWidgets = widgets.map((w) => w.instanceId === instanceId ? { ...w, ...patch } : w);
    const nextLayouts = size
      ? Object.fromEntries(
          Object.entries(layoutsRef.current).map(([bp, items]) => [
            bp,
            (items ?? []).map((item) =>
              item.i === instanceId ? { ...item, w: size.w, h: size.h } : item
            ),
          ])
        )
      : layoutsRef.current;
    if (size) layoutsRef.current = nextLayouts;
    updateDashboardContent(dashboardId, nextWidgets, nextLayouts);
  }, [widgets, dashboardId, updateDashboardContent]);

  const saveName = () => {
    if (nameInput.trim()) renameDash(dashboardId, nameInput.trim(), descInput.trim() || undefined);
    setEditingName(false);
  };

  if (!mounted || !dashboard) return null;

  const isSystem = dashboard.isSystem;

  return (
    <>
      <div className="flex h-full" style={{ alignItems: "flex-start" }}>


        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4 p-0">
        {/* Dashboard header */}
        <div
          className="relative rounded-2xl mb-2 px-8 py-6"
          style={{
            background: "linear-gradient(135deg, var(--color-surface) 60%, var(--color-brand-subtle) 100%)",
            border: editMode ? "1px solid var(--color-accent)" : "1px solid var(--color-border)",
            transition: "border-color 0.2s",
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Left: eyebrow + title with dashboard switcher */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "var(--color-accent)", letterSpacing: "0.13em" }}>
                <span aria-hidden="true" style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--color-accent)", marginRight: 8, verticalAlign: "middle", marginBottom: 2 }} />
                {isSystem ? "System Dashboard" : "Dashboard"}
              </p>

              {/* Title — inline name editor OR dashboard switcher */}
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                    className="text-2xl font-display font-light italic rounded px-1 focus:outline-none focus:ring-2"
                    style={{ color: "var(--color-text)", background: "transparent", borderBottom: "2px solid var(--color-accent)", minWidth: 0 }}
                  />
                  <button onClick={saveName} className="p-1 rounded" style={{ color: "var(--color-accent)" }}><Check className="h-4 w-4" /></button>
                </div>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setDashPickerOpen((v) => !v)}
                    className="group flex items-center gap-1.5 text-left"
                    title="Switch dashboard"
                  >
                    <h1
                      className="font-display font-light italic leading-tight"
                      style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", color: "var(--color-text)", letterSpacing: "-0.02em" }}
                    >
                      {dashboard.name}
                    </h1>
                    <ChevronDown
                      className="h-5 w-5 shrink-0 transition-transform"
                      style={{ color: "var(--color-text-muted)", transform: dashPickerOpen ? "rotate(180deg)" : "rotate(0deg)", marginTop: 4 }}
                    />
                  </button>

                  {dashPickerOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setDashPickerOpen(false)} />
                      <div
                        className="absolute left-0 top-full mt-2 w-72 rounded-xl py-2 z-20 overflow-auto"
                        style={{ maxHeight: 320, background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-dropdown, 0 8px 24px rgba(27,59,107,0.12))" }}
                      >
                        <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>System</p>
                        {systemDashboards.map((d) => {
                          const route = d.id === "system:pipelines" ? "/pipelines" : d.id === "system:quality" ? "/quality" : `/dashboard/${d.id}`;
                          const active = d.id === dashboardId;
                          return (
                            <button key={d.id} onClick={() => { router.push(route); setDashPickerOpen(false); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--color-sidebar-hover)]"
                              style={{ color: active ? "var(--color-accent)" : "var(--color-text)" }}>
                              <span className="w-3.5 shrink-0">{active && <Check className="h-3.5 w-3.5" />}</span>
                              <span className="truncate">{d.name}</span>
                            </button>
                          );
                        })}

                        {userDashboards.length > 0 && (
                          <>
                            <div className="my-1 mx-3" style={{ borderTop: "1px solid var(--color-border)" }} />
                            <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>My Dashboards</p>
                            {userDashboards.map((d) => {
                              const active = d.id === dashboardId;
                              return (
                                <button key={d.id} onClick={() => { router.push(`/dashboard/${d.id}`); setDashPickerOpen(false); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--color-sidebar-hover)]"
                                  style={{ color: active ? "var(--color-accent)" : "var(--color-text)" }}>
                                  <span className="w-3.5 shrink-0">{active && <Check className="h-3.5 w-3.5" />}</span>
                                  <span className="truncate">{d.name}</span>
                                </button>
                              );
                            })}
                          </>
                        )}

                        <div className="my-1 mx-3" style={{ borderTop: "1px solid var(--color-border)" }} />
                        <button onClick={() => { setNewDashOpen(true); setDashPickerOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--color-sidebar-hover)]"
                          style={{ color: "var(--color-accent)" }}>
                          <Plus className="h-3.5 w-3.5 shrink-0" />
                          New Dashboard
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {dashboard.description && !editMode && (
                <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>{dashboard.description}</p>
              )}
              {editMode && !isSystem && (
                <input
                  type="text"
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  onBlur={() => { if (nameInput.trim()) renameDash(dashboardId, nameInput.trim(), descInput.trim() || undefined); }}
                  onDoubleClick={() => setEditingName(true)}
                  placeholder="Add a subtitle…"
                  className="mt-1 w-full text-sm rounded px-1 focus:outline-none focus:ring-1"
                  style={{ color: "var(--color-text-muted)", background: "transparent", borderBottom: "1px dashed var(--color-border)" }}
                />
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <DateRangePicker from={from} to={to} onChange={setRange} />

              {!isSystem && (
                <Button variant="primary" onClick={() => { setEditMode(true); setPickerOpen(true); }}>
                  <Plus className="h-4 w-4" />
                  Add Widget
                </Button>
              )}

              {!editMode && !isSystem && (
                <Button variant="ghost" size="sm" onClick={() => setEditMode(true)} style={{ padding: "0.5rem 0.75rem" }}>
                  <Pencil className="h-4 w-4" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
              )}

              {editMode && (
                <Button variant="secondary" onClick={() => { setEditMode(false); setPendingRemove(null); setConfigTarget(null); }}>
                  <Check className="h-4 w-4" />
                  Done
                </Button>
              )}

              {!editMode && (
                <>
                  <div className="relative">
                    <Button variant="ghost" size="sm" onClick={() => setMenuOpen((v) => !v)} style={{ padding: "0.5rem" }}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    {menuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                        <div
                          className="absolute right-0 top-full mt-1 w-44 rounded-xl py-1 z-20"
                          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-dropdown, 0 8px 24px rgba(27,59,107,0.12))" }}
                        >
                          <button onClick={() => { duplicateDash(dashboardId); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-sidebar-hover)]" style={{ color: "var(--color-text)" }}>
                            <Copy className="h-4 w-4" /> Duplicate
                          </button>
                          {isSystem && (
                            <button onClick={() => { resetDash(dashboardId); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-sidebar-hover)]" style={{ color: "var(--color-text)" }}>
                              <RotateCcw className="h-4 w-4" /> Reset to default
                            </button>
                          )}
                          {!isSystem && (
                            <button onClick={() => { setSettingsOpen(true); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-sidebar-hover)]" style={{ color: "var(--color-text)" }}>
                              <Settings2 className="h-4 w-4" /> Settings
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Edit mode banner */}
        {editMode && (
          <div
            className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm"
            style={{
              background: "rgba(200,137,42,0.08)",
              border: "1px solid var(--color-accent)",
              color: "var(--color-accent)",
            }}
          >
            <span className="flex items-center gap-2">
              <Pencil className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">Editing layout</span>
              <span className="text-xs opacity-70 hidden sm:inline">— drag to reorder · resize from corner · configure with ⚙</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPickerOpen(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ background: "var(--color-accent)", color: "#fff" }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Widget
              </button>
              <button
                onClick={() => { setEditMode(false); setPendingRemove(null); setConfigTarget(null); }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border"
                style={{ borderColor: "var(--color-accent)", color: "var(--color-accent)" }}
              >
                <Check className="h-3.5 w-3.5" />
                Done
              </button>
            </div>
          </div>
        )}

        {/* Grid — key forces ResizeObserver to recalculate when panel opens/closes */}
        <div ref={containerRef} style={{ width: "100%" }}>
          {widgets.length === 0 ? (
            <div
              className="rounded-2xl py-16 px-8 text-center"
              style={{
                border: draggingWidget ? "2px dashed var(--color-accent)" : "2px dashed var(--color-border)",
                background: draggingWidget ? "rgba(200,137,42,0.04)" : undefined,
                transition: "border-color 0.15s, background 0.15s",
              }}
              onDragOver={(e) => { if (editMode) e.preventDefault(); }}
              onDrop={(e) => {
                if (!editMode || !draggingWidget) return;
                e.preventDefault();
                addWidget(draggingWidget.type, draggingWidget.customWidgetId);
                setDraggingWidget(null);
              }}
            >
              <LayoutGrid className="h-10 w-10 mx-auto mb-4" style={{ color: "var(--color-text-muted)" }} />
              <h3 className="text-base font-semibold mb-1" style={{ color: "var(--color-text)" }}>
                Start building your dashboard
              </h3>
              <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
                Add widgets from the library or build a custom widget with your own data query
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={() => { setEditMode(true); setPickerOpen(true); }}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium"
                  style={{ background: "var(--color-accent)", color: "#fff" }}
                >
                  <Plus className="h-4 w-4" />
                  Add Widget
                </button>
                <button
                  onClick={() => { setEditMode(true); router.push("/dashboard/widget-builder"); }}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium border"
                  style={{ borderColor: "var(--color-accent)", color: "var(--color-accent)" }}
                >
                  <Sparkles className="h-4 w-4" />
                  Build custom widget
                </button>
              </div>
            </div>
          ) : (
            <ResponsiveGridLayout
              key={editMode ? "edit" : "view"}
              className="layout"
              layouts={layouts}
              width={width ?? (typeof window !== "undefined" ? Math.max(window.innerWidth - (parseInt(getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width") || "256") || 256) - 48, 600) : 1200)}
              breakpoints={{ lg: 768, md: 480, sm: 0 }}
              cols={{ lg: 12, md: 8, sm: 4 }}
              rowHeight={90}
              containerPadding={[0, 0]}
              margin={[16, 16]}
              compactor={verticalCompactor}
              onLayoutChange={handleLayoutChange}
              dragConfig={{ enabled: editMode, handle: ".drag-handle" }}
              resizeConfig={{ enabled: editMode, handles: ["se"] }}
              dropConfig={{ enabled: editMode, defaultItem: draggingWidget?.size ?? { w: 4, h: 3 } }}
              droppingItem={draggingWidget ? { i: "__dropping__", x: 0, y: 0, ...draggingWidget.size } : undefined}
              onDrop={(_layout, _item, _e) => {
                if (draggingWidget) addWidget(draggingWidget.type, draggingWidget.customWidgetId);
                setDraggingWidget(null);
              }}
            >
              {widgets.map((w) => {
                const isCustom = w.type === "custom" || w.type === "shared";
                const def = isCustom ? null : getWidgetDef(w.type);
                if (!isCustom && !def) return null;

                const effectiveFrom = w.dateFrom ?? from;
                const effectiveTo = w.dateTo ?? to;

                return (
                  <div key={w.instanceId} className="relative group h-full overflow-hidden rounded-xl">
                    {/* Controls — only visible in edit mode */}
                    <div
                      className={cn(
                        "absolute inset-x-0 top-0 z-10 flex items-center justify-between px-2 py-1 transition-opacity",
                        editMode
                          ? "opacity-100 pointer-events-auto"
                          : "opacity-0 pointer-events-none"
                      )}
                      style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, transparent 100%)" }}
                    >
                      <button
                        onClick={() => setConfigTarget(w)}
                        className="rounded p-1"
                        style={{ color: "var(--color-text-muted)", background: "var(--color-surface)" }}
                        title="Configure"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </button>
                      <div className="flex items-center gap-1">
                        {editMode && (
                          <div className="drag-handle cursor-grab active:cursor-grabbing rounded p-1" style={{ color: "var(--color-text-muted)", background: "var(--color-surface)" }} title="Drag">
                            <GripVertical className="h-3.5 w-3.5" />
                          </div>
                        )}
                        {pendingRemove === w.instanceId ? (
                          <>
                            <button
                              ref={(el) => { if (el) el.focus(); }}
                              onClick={() => { removeWidget(w.instanceId); setPendingRemove(null); }}
                              className="rounded p-1 text-xs font-medium"
                              style={{ color: "#fff", background: "var(--color-error, #EF4444)" }}
                              title="Confirm remove"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setPendingRemove(null)}
                              className="rounded p-1"
                              style={{ color: "var(--color-text-muted)", background: "var(--color-surface)" }}
                              title="Cancel"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setPendingRemove(w.instanceId)}
                            className="rounded p-1"
                            style={{ color: "var(--color-text-muted)", background: "var(--color-surface)" }}
                            title="Remove widget"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="h-full">
                      {isCustom && w.customWidgetId ? (
                        <CustomWidgetRenderer customWidgetId={w.customWidgetId} from={effectiveFrom} to={effectiveTo} titleOverride={w.titleOverride} />
                      ) : def ? (
                        <def.component from={effectiveFrom} to={effectiveTo} titleOverride={w.titleOverride} />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </ResponsiveGridLayout>
          )}
        </div>
        </div>
      </div>

      <WidgetConfigPanel
        widget={configTarget}
        currentSize={configTarget ? (() => {
          const item = (layoutsRef.current.lg ?? []).find((l) => l.i === configTarget.instanceId);
          return item ? { w: item.w, h: item.h } : undefined;
        })() : undefined}
        onClose={() => setConfigTarget(null)}
        onSave={(instanceId, patch, size) => { updateSlotConfig(instanceId, patch, size); setConfigTarget(null); }}
      />

      <NewDashboardModal open={newDashOpen} onClose={() => setNewDashOpen(false)} />

      {pickerOpen && (
        <WidgetPickerModal
          onAdd={(type, customWidgetId, size) => { addWidget(type, customWidgetId, size); }}
          onCreateCustom={() => { setPickerOpen(false); router.push("/dashboard/widget-builder"); }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {settingsOpen && !isSystem && (
        <DashboardSettingsDialog
          dashboardId={dashboardId}
          name={dashboard.name}
          description={dashboard.description}
          onClose={() => setSettingsOpen(false)}
          onRename={(name, desc) => renameDash(dashboardId, name, desc)}
          onDelete={() => { router.replace("/"); deleteDash(dashboardId); }}
        />
      )}
    </>
  );
}

function findPlacement(cols: number, items: LayoutItem[], w: number, h: number): { x: number; y: number } {
  const clamped = Math.min(w, cols);
  const maxY = items.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  for (let y = 0; y <= maxY + 1; y++) {
    for (let x = 0; x <= cols - clamped; x++) {
      const fits = items.every((item) =>
        x + clamped <= item.x || x >= item.x + item.w || y + h <= item.y || y >= item.y + item.h
      );
      if (fits) return { x, y };
    }
  }
  return { x: 0, y: maxY + 1 };
}
