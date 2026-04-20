"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { Dashboard, DashboardStoreData, CustomWidget, WidgetSlot, QueryConfig, VisualType, SharedWidgetDef } from "@/types/dashboard";
import type { ResponsiveLayouts } from "react-grid-layout";
import {
  loadStore,
  saveStore,
  getDashboard,
  createDashboard,
  updateDashboard,
  deleteDashboard,
  resetSystemDashboard,
  addCustomWidget,
  deleteCustomWidget,
  detachSharedWidget,
  SYSTEM_DASHBOARD_DEFS,
} from "@/lib/dashboard-store";

interface DashboardContextValue {
  store: DashboardStoreData;

  // Dashboard CRUD
  dashboards: Dashboard[];
  systemDashboards: Dashboard[];
  userDashboards: Dashboard[];
  getDashboardById: (id: string) => Dashboard | undefined;
  createDash: (name: string, description?: string, template?: Dashboard) => Dashboard;
  renameDash: (id: string, name: string, description?: string) => void;
  deleteDash: (id: string) => void;
  resetDash: (id: string) => void;
  duplicateDash: (id: string) => Dashboard;

  // Widget mutations within a dashboard
  updateDashboardContent: (id: string, widgets: WidgetSlot[], layout: ResponsiveLayouts) => void;

  // Custom widgets
  customWidgets: CustomWidget[];
  saveCustomWidget: (widget: Omit<CustomWidget, "id" | "createdAt">) => CustomWidget;
  deleteCustomWidget: (id: string) => void;
  withdrawSharedWidget: (sharedWidget: SharedWidgetDef) => void;

  // Active tracking
  activeId: string | null;
  setActiveId: (id: string) => void;
  mounted: boolean;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<DashboardStoreData>(() => ({
    dashboards: [],
    customWidgets: [],
    activeId: null,
  }));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setStore(loadStore());
    setMounted(true);
  }, []);

  const getDashboardById = useCallback(
    (id: string) => getDashboard(store, id),
    [store]
  );

  const createDash = useCallback(
    (name: string, description?: string, template?: Dashboard) => {
      const { data, dashboard } = createDashboard(store, name, description, template);
      setStore(data);
      return dashboard;
    },
    [store]
  );

  const renameDash = useCallback(
    (id: string, name: string, description?: string) => {
      setStore((prev) => updateDashboard(prev, id, {
        name,
        ...(description !== undefined && { description }),
      }));
    },
    []
  );

  const deleteDash = useCallback(
    (id: string) => setStore((prev) => deleteDashboard(prev, id)),
    []
  );

  const resetDash = useCallback(
    (id: string) => setStore((prev) => resetSystemDashboard(prev, id)),
    []
  );

  const duplicateDash = useCallback(
    (id: string) => {
      const src = getDashboard(store, id);
      if (!src) throw new Error(`Dashboard ${id} not found`);
      const { data, dashboard } = createDashboard(store, `${src.name} (copy)`, src.description, src);
      setStore(data);
      return dashboard;
    },
    [store]
  );

  const updateDashboardContent = useCallback(
    (id: string, widgets: WidgetSlot[], layout: ResponsiveLayouts) =>
      setStore((prev) => updateDashboard(prev, id, { widgets, layout })),
    []
  );

  const saveCustomWidget = useCallback(
    (widget: Omit<CustomWidget, "id" | "createdAt">) => {
      const { data, widget: w } = addCustomWidget(store, widget);
      setStore(data);
      return w;
    },
    [store]
  );

  const deleteCustomWidgetFn = useCallback(
    (id: string) => setStore((prev) => deleteCustomWidget(prev, id)),
    []
  );

  const withdrawSharedWidgetFn = useCallback(
    (sharedWidget: SharedWidgetDef) =>
      setStore((prev) => detachSharedWidget(prev, sharedWidget.id, sharedWidget)),
    []
  );

  const setActiveId = useCallback((id: string) => {
    setStore((prev) => {
      if (prev.activeId === id) return prev; // bail out — no state update, no re-render
      const next = { ...prev, activeId: id };
      saveStore(next);
      return next;
    });
  }, []);

  const systemDashboards = Object.values(SYSTEM_DASHBOARD_DEFS).map(
    (def) => getDashboard(store, def.id) ?? def
  );
  const userDashboards = mounted
    ? store.dashboards.filter((d) => !d.id.startsWith("system:"))
    : [];

  const value: DashboardContextValue = {
    store,
    dashboards: [...systemDashboards, ...userDashboards],
    systemDashboards,
    userDashboards,
    getDashboardById,
    createDash,
    renameDash,
    deleteDash,
    resetDash,
    duplicateDash,
    updateDashboardContent,
    customWidgets: store.customWidgets,
    saveCustomWidget,
    deleteCustomWidget: deleteCustomWidgetFn,
    withdrawSharedWidget: withdrawSharedWidgetFn,
    activeId: store.activeId,
    setActiveId,
    mounted,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboards() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboards must be used within DashboardProvider");
  return ctx;
}
