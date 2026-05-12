"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { ResponsiveGridLayout, verticalCompactor, type LayoutItem, type ResponsiveLayouts } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { Settings2, X, GripVertical, LayoutGrid, Pencil, RotateCcw, Copy, Trash2, Check, MoreHorizontal, Sparkles, Plus, Globe, Star } from "lucide-react";
import { useDateRange } from "@/hooks/use-date-range";
import { useHealth } from "@/hooks/use-health";
import { DateRangePicker, Button } from "@/components/ui";
import { useDashboards } from "@/contexts/dashboard-context";
import { useInstallation } from "@/contexts/installation-context";
import { useSharedWidgets, useUpdateSharedWidget } from "@/hooks/use-shared-widgets";
import { usePinnedDashboards } from "@/hooks/use-pinned-dashboards";
import { NewDashboardModal } from "@/components/dashboard/new-dashboard-modal";
import { DashboardSettingsDialog } from "@/components/dashboard/dashboard-settings-dialog";
import { WidgetPickerDrawer } from "@/components/dashboard/widget-picker-modal";
import { getWidgetDef, WIDGET_REGISTRY } from "./registry";
import { WidgetConfigPanel } from "./widget-config-panel";
import { CustomWidgetRenderer } from "./widgets/custom-widget";
import type { WidgetSlot, SharedWidgetDef } from "@/types/dashboard";

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
  const {
    getDashboardById,
    updateDashboardContent,
    renameDash,
    deleteDash,
    resetDash,
    duplicateDash,
    publishSystemDashboard,
    resetSystemOverride,
    systemOverrides,
    customWidgets,
    dashboards,
    updateCustomWidget,
  } = useDashboards();
  const { data: sharedWidgets = [] } = useSharedWidgets();
  const { installation, installations, switchInstallation, validating } = useInstallation();
  const { mutateAsync: updateSharedWidget } = useUpdateSharedWidget();
  const { from, to, preset, setRange, setPreset, summaryLabel } = useDateRange({ scope: `dashboard:${dashboardId}`, defaultPreset: "7d" });
  const { data: health } = useHealth();
  const { toggle: togglePin, isPinned } = usePinnedDashboards(installation?.installation_id);
  const [editMode, setEditMode] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishDone, setPublishDone] = useState(false);
  const [configTarget, setConfigTarget] = useState<WidgetSlot | null>(null);
  const [draggingWidget, setDraggingWidget] = useState<{ type: string; size: { w: number; h: number }; customWidgetId?: string } | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [newDashOpen, setNewDashOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const router = useRouter();
  // Custom ResizeObserver-based width measurement.
  // useContainerWidth() from react-grid-layout has initialWidth=1280 and sets up
  // its ResizeObserver in a useEffect([]) that runs when containerRef is still null
  // (because we return null until mounted=true). The observer therefore never fires
  // and width is stuck at 1280, causing the grid to overflow the visible area.
  // By re-running the effect whenever `mounted` changes we guarantee the element
  // exists before we observe it.
  const containerRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState<number | null>(null);
  const layoutsRef = useRef<ResponsiveLayouts>({});
  const widgetsRef = useRef<WidgetSlot[]>([]);

  useEffect(() => { setMounted(true); }, []);

  // Measure container width once the element is in the DOM (after mounted=true)
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const measure = () => setGridWidth(node.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver((entries) => {
      setGridWidth(entries[0]?.contentRect.width ?? node.getBoundingClientRect().width);
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [mounted]); // re-run when mounted flips to true so containerRef.current is set

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

  const hasOverride = Boolean(systemOverrides[dashboardId]);
  // Resolve the editable widget definition for any slot that has a customWidgetId
  // (both "custom" personal widgets and "shared" org widgets).
  const { selectedEditableWidget, isSharedEditable } = useMemo<{
    selectedEditableWidget: (typeof customWidgets)[0] | SharedWidgetDef | undefined;
    isSharedEditable: boolean;
  }>(() => {
    if (!configTarget?.customWidgetId) return { selectedEditableWidget: undefined, isSharedEditable: false };
    if (configTarget.type === "custom") {
      return { selectedEditableWidget: customWidgets.find((cw) => cw.id === configTarget.customWidgetId), isSharedEditable: false };
    }
    if (configTarget.type === "shared") {
      return { selectedEditableWidget: sharedWidgets.find((sw) => sw.id === configTarget.customWidgetId), isSharedEditable: true };
    }
    return { selectedEditableWidget: undefined, isSharedEditable: false };
  }, [configTarget, customWidgets, sharedWidgets]);

  const selectedCustomWidgetImpact = useMemo(() => {
    if (!selectedEditableWidget) return 0;
    const id = selectedEditableWidget.id;
    const slotType = isSharedEditable ? "shared" : "custom";
    return dashboards.filter((d) =>
      d.widgets.some((w) => w.type === slotType && w.customWidgetId === id)
    ).length;
  }, [dashboards, selectedEditableWidget, isSharedEditable]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await publishSystemDashboard(dashboardId, widgets, layouts);
      setPublishDone(true);
      setEditMode(false);
      setTimeout(() => setPublishDone(false), 3000);
    } finally {
      setPublishing(false);
    }
  };

  const handleResetOverride = async () => {
    await resetSystemOverride(dashboardId);
    setMenuOpen(false);
  };

  if (!mounted || !dashboard) return null;

  const isSystem = dashboard.isSystem;
  const dashboardScopeLabel = isSystem ? "Organization dashboard" : "Personal dashboard";
  const dashboardScopeStyles = isSystem
    ? { background: "rgba(27,59,107,0.10)", color: "var(--color-brand, #1b3b6b)" }
    : { background: "rgba(200,137,42,0.12)", color: "var(--color-accent)" };
  const dashboardScopeHint = isSystem
    ? "Changes affect the tenant after publishing."
    : "Only visible in your personal workspace.";
  const widgetSemantics = new Set(
    widgets.map((widget) => {
      if (widget.type === "custom" || widget.type === "shared") return "mixed";
      return getWidgetDef(widget.type)?.timeSemantics ?? "mixed";
    })
  );
  const isPeriodOnlyDashboard = widgetSemantics.size > 0 && widgetSemantics.size === 1 && widgetSemantics.has("period");
  const rangeHelper = isPeriodOnlyDashboard
    ? `Showing ${summaryLabel}`
    : `Date scope for period-based widgets: ${summaryLabel}`;

  return (
    <>
      <div className="page-content flex h-full gap-3 overflow-x-hidden pt-3" style={{ alignItems: "flex-start" }}>

        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-4 overflow-hidden">
        {/* Dashboard header */}
        <div
          className="mb-5 flex min-h-[44px] flex-wrap items-start gap-3"
        >
          {/* Left: title */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {editingName ? (
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                  className="text-[17px] font-semibold rounded px-1 focus:outline-none min-w-0 flex-1"
                  style={{ color: "var(--color-text)", background: "transparent", borderBottom: "2px solid var(--color-accent)", letterSpacing: "-0.02em" }}
                />
                <button onClick={saveName} className="p-1 rounded shrink-0" style={{ color: "var(--color-accent)" }}>
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative group/title min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <h1
                    className="truncate text-lg font-medium leading-tight"
                    style={{ color: "var(--color-text)", letterSpacing: "-0.02em" }}
                  >
                    {dashboard.name}
                  </h1>
                  {!isSystem && editMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingName(true); setNameInput(dashboard.name); }}
                      className="shrink-0 rounded p-1 opacity-0 transition-opacity group-hover/title:opacity-100"
                      style={{ color: "var(--color-text-muted)" }}
                      title="Edit name"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                  {!isSystem && (
                    <button
                      onClick={() => togglePin(dashboardId)}
                      className="shrink-0 rounded p-1"
                      style={{ color: isPinned(dashboardId) ? "var(--color-accent)" : "var(--color-text-muted)", opacity: isPinned(dashboardId) ? 1 : 0, transition: "opacity 0.15s" }}
                      title={isPinned(dashboardId) ? "Unpin from sidebar" : "Pin to sidebar"}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = isPinned(dashboardId) ? "1" : "0"; }}
                    >
                      <Star className="h-3 w-3" fill={isPinned(dashboardId) ? "currentColor" : "none"} />
                    </button>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={dashboardScopeStyles}
                  >
                    {dashboardScopeLabel}
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                    {dashboardScopeHint}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right: date + controls */}
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <div className="flex flex-col items-end gap-1">
              <DateRangePicker from={from} to={to} preset={preset} onChange={setRange} onPresetChange={setPreset} />
              <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                {rangeHelper}
              </span>
            </div>

            {publishDone && (
              <span
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{ background: "rgba(34,197,94,0.12)", color: "#16a34a" }}
              >
                <Check className="h-3 w-3" />
                Published
              </span>
            )}

            {editMode ? (
              isSystem ? (
                <Button variant="primary" onClick={handlePublish} disabled={publishing}>
                  <Globe className="h-3.5 w-3.5" />
                  {publishing ? "Publishing…" : "Publish"}
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => { setEditMode(false); setPendingRemove(null); setConfigTarget(null); }}>
                  <Check className="h-3.5 w-3.5" />
                  Done
                </Button>
              )
            ) : (
              <div className="relative">
                <Button variant="ghost" size="sm" onClick={() => setMenuOpen((v) => !v)} style={{ padding: "0.375rem" }}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div
                      className="absolute right-0 top-full mt-1 w-56 rounded-xl py-1 z-20"
                      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-dropdown, 0 8px 24px rgba(27,59,107,0.12))" }}
                    >
                      {installation && installations.length > 1 && (
                        <>
                          <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                            Switch organization
                          </p>
                          {installations.map((org) => {
                            const active = org.installation_id === installation.installation_id;
                            return (
                              <button
                                key={org.installation_id}
                                onClick={() => { void switchInstallation(org.installation_id); setMenuOpen(false); }}
                                disabled={validating}
                                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-[var(--color-sidebar-hover)] disabled:opacity-60"
                                style={{ color: "var(--color-text)" }}
                              >
                                <span className="truncate">{org.label ?? org.installation_id}</span>
                                {active ? <Check className="h-4 w-4" style={{ color: "var(--color-accent)" }} /> : null}
                              </button>
                            );
                          })}
                          <div className="my-1 border-t" style={{ borderColor: "var(--color-border)" }} />
                        </>
                      )}
                      <button onClick={() => { setEditMode(true); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-sidebar-hover)]" style={{ color: "var(--color-text)" }}>
                        <Pencil className="h-4 w-4" /> {isSystem ? "Edit organization layout" : "Edit personal layout"}
                      </button>
                      {!isSystem && (
                        <button onClick={() => { setSettingsOpen(true); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-sidebar-hover)]" style={{ color: "var(--color-text)" }}>
                          <Settings2 className="h-4 w-4" /> Dashboard settings
                        </button>
                      )}
                      <button onClick={() => { duplicateDash(dashboardId); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-sidebar-hover)]" style={{ color: "var(--color-text)" }}>
                        <Copy className="h-4 w-4" /> {isSystem ? "Create personal copy" : "Duplicate dashboard"}
                      </button>
                      {isSystem ? (
                        hasOverride ? (
                          <button onClick={handleResetOverride} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-sidebar-hover)]" style={{ color: "var(--color-error, #dc2626)" }}>
                            <RotateCcw className="h-4 w-4" /> Reset to default
                          </button>
                        ) : null
                      ) : (
                        <button onClick={() => { resetDash(dashboardId); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-sidebar-hover)]" style={{ color: "var(--color-error, #dc2626)" }}>
                          <RotateCcw className="h-4 w-4" /> Reset layout
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Edit mode banner */}
        {editMode && (
          <div
            className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm"
            style={{
              background: isSystem ? "rgba(99,102,241,0.08)" : "rgba(200,137,42,0.08)",
              border: isSystem ? "1px solid rgba(99,102,241,0.4)" : "1px solid var(--color-accent)",
              color: isSystem ? "rgb(99,102,241)" : "var(--color-accent)",
            }}
          >
            <span className="flex items-center gap-2">
              {isSystem ? <Globe className="h-3.5 w-3.5 shrink-0" /> : <Pencil className="h-3.5 w-3.5 shrink-0" />}
              <span className="font-medium">{isSystem ? "Editing system dashboard" : "Edit layout"}</span>
              <span className="text-xs opacity-70 hidden sm:inline">
                {isSystem
                  ? "— changes are visible to all users after publishing"
                  : "— drag to reorder · resize from corner · configure with ⚙"}
              </span>
            </span>
            <div className="flex items-center gap-2">
              {isSystem ? (
                <>
                  <button
                    onClick={() => { setEditMode(false); setPendingRemove(null); setConfigTarget(null); }}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border"
                    style={{ borderColor: "rgba(99,102,241,0.4)", color: "rgb(99,102,241)" }}
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={publishing}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                    style={{ background: "rgb(99,102,241)", color: "#fff", opacity: publishing ? 0.7 : 1 }}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {publishing ? "Publishing…" : "Publish for everyone"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setEditMode(false); setPendingRemove(null); setConfigTarget(null); }}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border"
                    style={{ borderColor: "var(--color-accent)", color: "var(--color-accent)" }}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Done
                  </button>
                </>
              )}
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
                  onClick={() => setEditMode(true)}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium"
                  style={{ background: "var(--color-accent)", color: "#fff" }}
                >
                  <Plus className="h-4 w-4" />
                  Add widgets
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
              width={gridWidth ?? 1280}
              breakpoints={{ lg: 600, md: 400, sm: 0 }}
              cols={{ lg: 12, md: 8, sm: 4 }}
              rowHeight={72}
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
                        "absolute inset-x-0 top-0 z-10 flex items-center justify-end gap-1 px-2 py-1 transition-opacity",
                        editMode
                          ? "opacity-100 pointer-events-auto"
                          : "opacity-0 pointer-events-none"
                      )}
                      style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, transparent 100%)" }}
                    >
                      <div className="drag-handle cursor-grab active:cursor-grabbing rounded p-1" style={{ color: "var(--color-text-muted)", background: "var(--color-surface)" }} title="Move">
                        <GripVertical className="h-3.5 w-3.5" />
                      </div>
                      <button
                        onClick={() => setConfigTarget(w)}
                        className="rounded p-1"
                        style={{ color: "var(--color-text-muted)", background: "var(--color-surface)" }}
                        title="Settings"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </button>
                      {pendingRemove === w.instanceId ? (
                        <>
                          <button
                            ref={(el) => { if (el) el.focus(); }}
                            onClick={() => { removeWidget(w.instanceId); setPendingRemove(null); }}
                            className="rounded p-1 text-xs font-medium"
                            style={{ color: "#fff", background: "var(--color-error, #EF4444)" }}
                            title="Confirm delete"
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

        {/* Widget picker drawer — slides in from the right in edit mode */}
        <WidgetPickerDrawer
          open={editMode}
          onAdd={(type, customWidgetId, size) => addWidget(type, customWidgetId, size)}
          onCreateCustom={() => { setEditMode(false); router.push("/dashboard/widget-builder"); }}
          onClose={() => setEditMode(false)}
        />
      </div>

      <WidgetConfigPanel
        widget={configTarget}
        editableWidget={selectedEditableWidget}
        isSharedWidget={isSharedEditable}
        impactCount={selectedCustomWidgetImpact}
        currentSize={configTarget ? (() => {
          const item = (layoutsRef.current.lg ?? []).find((l) => l.i === configTarget.instanceId);
          return item ? { w: item.w, h: item.h } : undefined;
        })() : undefined}
        onClose={() => setConfigTarget(null)}
        onUpdateWidget={async (id, patch) => {
          if (isSharedEditable) {
            await updateSharedWidget({ id, patch });
          } else {
            updateCustomWidget(id, patch);
          }
        }}
        onSave={(instanceId, patch, size) => { updateSlotConfig(instanceId, patch, size); setConfigTarget(null); }}
      />

      <NewDashboardModal open={newDashOpen} onClose={() => setNewDashOpen(false)} />

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
