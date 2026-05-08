import type { Dashboard, DashboardStoreData, CustomWidget, WidgetSlot, SharedWidgetDef } from "@/types/dashboard";
import type { ResponsiveLayouts } from "react-grid-layout";

const STORAGE_KEY = "insights-dashboard-store-v1";

// LINS-016: Namespace storage key by installation to prevent cross-tenant data leakage
export function getStorageKey(installationId?: string): string {
  const id = installationId || "default";
  return `insights-dashboard-store-v1:${id}`;
}

// ─── System dashboard factory definitions ───────────────────────────────────
// LADR-068: System dashboards ship with OOTB widget layouts.
// Operators can override via "Publish for everyone". "Reset to default" restores
// these factory defaults. SYSTEM_LAYOUT_VERSION bumped to 3.

const systemPipelinesSlots: WidgetSlot[] = [
  { instanceId: "sys-p-1", type: "total-runs" },
  { instanceId: "sys-p-2", type: "failed-runs" },
  { instanceId: "sys-p-3", type: "avg-run-duration" },
  { instanceId: "sys-p-4", type: "pipeline-status" },
  { instanceId: "sys-p-5", type: "runs-by-pipeline" },
  { instanceId: "sys-p-6", type: "pipeline-runs-table" },
];
const systemPipelinesLayout: ResponsiveLayouts = {
  lg: [
    { i: "sys-p-1", x: 0,  y: 0, w: 3,  h: 2, minW: 2, minH: 2 },
    { i: "sys-p-2", x: 3,  y: 0, w: 3,  h: 2, minW: 2, minH: 2 },
    { i: "sys-p-3", x: 6,  y: 0, w: 3,  h: 2, minW: 2, minH: 2 },
    { i: "sys-p-4", x: 0,  y: 2, w: 6,  h: 4, minW: 4, minH: 3 },
    { i: "sys-p-5", x: 6,  y: 2, w: 6,  h: 4, minW: 4, minH: 3 },
    { i: "sys-p-6", x: 0,  y: 6, w: 12, h: 4, minW: 6, minH: 3 },
  ],
  md: [
    { i: "sys-p-1", x: 0, y: 0,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-p-2", x: 4, y: 0,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-p-3", x: 0, y: 2,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-p-4", x: 0, y: 4,  w: 8, h: 4, minW: 4, minH: 3 },
    { i: "sys-p-5", x: 0, y: 8,  w: 8, h: 4, minW: 4, minH: 3 },
    { i: "sys-p-6", x: 0, y: 12, w: 8, h: 4, minW: 6, minH: 3 },
  ],
  sm: [
    { i: "sys-p-1", x: 0, y: 0,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-p-2", x: 0, y: 2,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-p-3", x: 0, y: 4,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-p-4", x: 0, y: 6,  w: 4, h: 4, minW: 4, minH: 3 },
    { i: "sys-p-5", x: 0, y: 10, w: 4, h: 4, minW: 4, minH: 3 },
    { i: "sys-p-6", x: 0, y: 14, w: 4, h: 4, minW: 6, minH: 3 },
  ],
};

const systemQualitySlots: WidgetSlot[] = [
  { instanceId: "sys-q-1", type: "pass-rate" },
  { instanceId: "sys-q-2", type: "failed-dq-checks" },
  { instanceId: "sys-q-3", type: "warning-dq-checks" },
  { instanceId: "sys-q-4", type: "dq-trend" },
  { instanceId: "sys-q-5", type: "severity-category" },
  { instanceId: "sys-q-6", type: "dq-by-category" },
  { instanceId: "sys-q-7", type: "dq-checks-table" },
];
const systemQualityLayout: ResponsiveLayouts = {
  lg: [
    { i: "sys-q-1", x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { i: "sys-q-2", x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { i: "sys-q-3", x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { i: "sys-q-4", x: 0, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
    { i: "sys-q-5", x: 6, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
    { i: "sys-q-6", x: 0, y: 6, w: 4, h: 4, minW: 3, minH: 3 },
    { i: "sys-q-7", x: 4, y: 6, w: 8, h: 4, minW: 4, minH: 3 },
  ],
  md: [
    { i: "sys-q-1", x: 0, y: 0,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-q-2", x: 4, y: 0,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-q-3", x: 0, y: 2,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-q-4", x: 0, y: 4,  w: 8, h: 4, minW: 4, minH: 3 },
    { i: "sys-q-5", x: 0, y: 8,  w: 8, h: 4, minW: 4, minH: 3 },
    { i: "sys-q-6", x: 0, y: 12, w: 4, h: 4, minW: 3, minH: 3 },
    { i: "sys-q-7", x: 4, y: 12, w: 4, h: 4, minW: 4, minH: 3 },
  ],
  sm: [
    { i: "sys-q-1", x: 0, y: 0,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-q-2", x: 0, y: 2,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-q-3", x: 0, y: 4,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-q-4", x: 0, y: 6,  w: 4, h: 4, minW: 4, minH: 3 },
    { i: "sys-q-5", x: 0, y: 10, w: 4, h: 4, minW: 4, minH: 3 },
    { i: "sys-q-6", x: 0, y: 14, w: 4, h: 4, minW: 3, minH: 3 },
    { i: "sys-q-7", x: 0, y: 18, w: 4, h: 4, minW: 4, minH: 3 },
  ],
};

const systemBcbs239Slots: WidgetSlot[] = [
  { instanceId: "sys-b-1", type: "bcbs239-score" },
  { instanceId: "sys-b-2", type: "pass-rate" },
  { instanceId: "sys-b-3", type: "failed-dq-checks" },
  { instanceId: "sys-b-4", type: "dq-trend" },
  { instanceId: "sys-b-5", type: "severity-category" },
  { instanceId: "sys-b-6", type: "dq-checks-table" },
];
const systemBcbs239Layout: ResponsiveLayouts = {
  lg: [
    { i: "sys-b-1", x: 0, y: 0, w: 3,  h: 2, minW: 2, minH: 2 },
    { i: "sys-b-2", x: 3, y: 0, w: 3,  h: 2, minW: 2, minH: 2 },
    { i: "sys-b-3", x: 6, y: 0, w: 3,  h: 2, minW: 2, minH: 2 },
    { i: "sys-b-4", x: 0, y: 2, w: 6,  h: 4, minW: 4, minH: 3 },
    { i: "sys-b-5", x: 6, y: 2, w: 6,  h: 4, minW: 4, minH: 3 },
    { i: "sys-b-6", x: 0, y: 6, w: 12, h: 4, minW: 6, minH: 3 },
  ],
  md: [
    { i: "sys-b-1", x: 0, y: 0,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-b-2", x: 4, y: 0,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-b-3", x: 0, y: 2,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-b-4", x: 0, y: 4,  w: 8, h: 4, minW: 4, minH: 3 },
    { i: "sys-b-5", x: 0, y: 8,  w: 8, h: 4, minW: 4, minH: 3 },
    { i: "sys-b-6", x: 0, y: 12, w: 8, h: 4, minW: 6, minH: 3 },
  ],
  sm: [
    { i: "sys-b-1", x: 0, y: 0,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-b-2", x: 0, y: 2,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-b-3", x: 0, y: 4,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-b-4", x: 0, y: 6,  w: 4, h: 4, minW: 4, minH: 3 },
    { i: "sys-b-5", x: 0, y: 10, w: 4, h: 4, minW: 4, minH: 3 },
    { i: "sys-b-6", x: 0, y: 14, w: 4, h: 4, minW: 6, minH: 3 },
  ],
};

const NOW = new Date(0).toISOString();
const SYSTEM_LAYOUT_VERSION = 3;

export const SYSTEM_DASHBOARD_DEFS: Record<string, Dashboard> = {
  "system:pipelines": {
    id: "system:pipelines",
    name: "Pipelines",
    description: "Pipeline execution health, step performance, and run log",
    isSystem: true,
    layoutVersion: SYSTEM_LAYOUT_VERSION,
    widgets: systemPipelinesSlots,
    layout: systemPipelinesLayout,
    createdAt: NOW,
    updatedAt: NOW,
  },
  "system:quality": {
    id: "system:quality",
    name: "Data Quality",
    description: "DQ check results, pass rate trends, and detailed check log",
    isSystem: true,
    layoutVersion: SYSTEM_LAYOUT_VERSION,
    widgets: systemQualitySlots,
    layout: systemQualityLayout,
    createdAt: NOW,
    updatedAt: NOW,
  },
  "system:bcbs239": {
    id: "system:bcbs239",
    name: "BCBS 239",
    description: "BCBS 239 compliance score, DQ pass rate, and high-severity findings — last 7 days",
    isSystem: true,
    layoutVersion: SYSTEM_LAYOUT_VERSION,
    widgets: systemBcbs239Slots,
    layout: systemBcbs239Layout,
    createdAt: NOW,
    updatedAt: NOW,
  },
};

// ─── Default personal dashboard ──────────────────────────────────────────────

function makeDefaultDashboard(): Dashboard {
  const now = new Date().toISOString();
  return {
    id: "default",
    name: "Personal Dashboard",
    description: undefined,
    isSystem: false,
    widgets: [],
    layout: {},
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Storage adapter ─────────────────────────────────────────────────────────

function load(installationId?: string): DashboardStoreData {
  if (typeof window === "undefined") {
    return { dashboards: [makeDefaultDashboard()], customWidgets: [], activeId: "default" };
  }
  try {
    const key = getStorageKey(installationId);
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as DashboardStoreData;
      if (parsed.dashboards?.length) return parsed;
    }
  } catch {
    // ignore
  }
  const initial: DashboardStoreData = {
    dashboards: [makeDefaultDashboard()],
    customWidgets: [],
    activeId: "default",
  };
  save(initial, installationId);
  return initial;
}

function save(data: DashboardStoreData, installationId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = getStorageKey(installationId);
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // storage unavailable
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function loadStore(installationId?: string): DashboardStoreData {
  return load(installationId);
}

export function saveStore(data: DashboardStoreData, installationId?: string): void {
  save(data, installationId);
}

export function getDashboard(data: DashboardStoreData, id: string): Dashboard | undefined {
  if (id.startsWith("system:")) {
    const systemDef = SYSTEM_DASHBOARD_DEFS[id];
    if (!systemDef) return undefined;
    const override = data.dashboards.find((d) => d.id === id);
    // Discard stale overrides: if the stored version doesn't match the current
    // system layout version, fall back to the system default so users always
    // see the well-designed factory layout after an upgrade.
    if (override && (override.layoutVersion ?? 0) < SYSTEM_LAYOUT_VERSION) {
      return systemDef;
    }
    return override ?? systemDef;
  }
  return data.dashboards.find((d) => d.id === id);
}

export function createDashboard(
  data: DashboardStoreData,
  name: string,
  description?: string,
  template?: Dashboard
): { data: DashboardStoreData; dashboard: Dashboard } {
  const now = new Date().toISOString();
  const newDash: Dashboard = template
    ? {
        ...template,
        id: crypto.randomUUID(),
        name,
        description: description ?? template.description,
        isSystem: false,
        createdAt: now,
        updatedAt: now,
      }
    : {
        id: crypto.randomUUID(),
        name,
        description,
        isSystem: false,
        widgets: [],
        layout: {},
        createdAt: now,
        updatedAt: now,
      };
  const next: DashboardStoreData = {
    ...data,
    dashboards: [...data.dashboards, newDash],
    activeId: newDash.id,
  };
  save(next);
  return { data: next, dashboard: newDash };
}

export function updateDashboard(
  data: DashboardStoreData,
  id: string,
  patch: Partial<Pick<Dashboard, "name" | "description" | "widgets" | "layout">>
): DashboardStoreData {
  const now = new Date().toISOString();
  // System dashboards: store as user override (stamp current layout version)
  if (id.startsWith("system:")) {
    const base = getDashboard(data, id)!;
    const updated: Dashboard = { ...base, ...patch, layoutVersion: SYSTEM_LAYOUT_VERSION, updatedAt: now };
    const existing = data.dashboards.findIndex((d) => d.id === id);
    const dashboards =
      existing >= 0
        ? data.dashboards.map((d) => (d.id === id ? updated : d))
        : [...data.dashboards, updated];
    const next = { ...data, dashboards };
    save(next);
    return next;
  }
  const dashboards = data.dashboards.map((d) =>
    d.id === id ? { ...d, ...patch, updatedAt: now } : d
  );
  const next = { ...data, dashboards };
  save(next);
  return next;
}

export function deleteDashboard(data: DashboardStoreData, id: string): DashboardStoreData {
  const dashboards = data.dashboards.filter((d) => d.id !== id);
  const activeId =
    data.activeId === id ? (dashboards[0]?.id ?? null) : data.activeId;
  const next = { ...data, dashboards, activeId };
  save(next);
  return next;
}

export function resetSystemDashboard(data: DashboardStoreData, id: string): DashboardStoreData {
  const dashboards = data.dashboards.filter((d) => d.id !== id);
  const next = { ...data, dashboards };
  save(next);
  return next;
}

export function addCustomWidget(
  data: DashboardStoreData,
  widget: Omit<CustomWidget, "id" | "createdAt">
): { data: DashboardStoreData; widget: CustomWidget } {
  const newWidget: CustomWidget = {
    ...widget,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const next: DashboardStoreData = {
    ...data,
    customWidgets: [...data.customWidgets, newWidget],
  };
  save(next);
  return { data: next, widget: newWidget };
}

export function updateCustomWidget(
  data: DashboardStoreData,
  id: string,
  patch: Partial<Pick<CustomWidget, "label" | "description" | "queryConfig" | "visualType">>
): DashboardStoreData {
  let changed = false;
  const customWidgets = data.customWidgets.map((cw) => {
    if (cw.id !== id) return cw;
    changed = true;
    return { ...cw, ...patch };
  });
  if (!changed) return data;
  const next = { ...data, customWidgets };
  save(next);
  return next;
}

/**
 * Detach a shared widget from all dashboards that use it.
 * Converts each "shared" slot into a personal custom widget so those dashboards
 * keep working after the shared widget is withdrawn from the library.
 */
export function detachSharedWidget(
  data: DashboardStoreData,
  sharedWidgetId: string,
  sharedWidget: SharedWidgetDef
): DashboardStoreData {
  const affected = data.dashboards.some((d) =>
    d.widgets.some((w) => w.type === "shared" && w.customWidgetId === sharedWidgetId)
  );
  if (!affected) return data;

  const now = new Date().toISOString();
  const detached: CustomWidget = {
    id: crypto.randomUUID(),
    label: sharedWidget.label,
    description: sharedWidget.description,
    queryConfig: sharedWidget.queryConfig ?? { dataSource: "pipeline_runs", measure: { type: "count" }, filters: [] },
    visualType: sharedWidget.visualType ?? "counter",
    templateType: sharedWidget.templateType,
    category: sharedWidget.category,
    createdAt: now,
  };

  const dashboards = data.dashboards.map((d) => {
    const hasSlot = d.widgets.some(
      (w) => w.type === "shared" && w.customWidgetId === sharedWidgetId
    );
    if (!hasSlot) return d;
    return {
      ...d,
      updatedAt: now,
      widgets: d.widgets.map((w) =>
        w.type === "shared" && w.customWidgetId === sharedWidgetId
          ? { ...w, type: "custom" as const, customWidgetId: detached.id }
          : w
      ),
    };
  });

  const next = { ...data, customWidgets: [...data.customWidgets, detached], dashboards };
  save(next);
  return next;
}

export function deleteCustomWidget(
  data: DashboardStoreData,
  id: string
): DashboardStoreData {
  const customWidgets = data.customWidgets.filter((cw) => cw.id !== id);
  const dashboards = data.dashboards.map((d) => {
    const widgets = d.widgets.filter(
      (w) => !(w.type === "custom" && w.customWidgetId === id)
    );
    if (widgets.length === d.widgets.length) return d;
    // Rebuild layout: remove keys that no longer have a slot
    const remaining = new Set(widgets.map((w) => w.instanceId));
    const layout: typeof d.layout = {};
    for (const [bp, items] of Object.entries(d.layout ?? {})) {
      layout[bp] = (items ?? []).filter((item) => remaining.has(item.i));
    }
    return { ...d, widgets, layout, updatedAt: new Date().toISOString() };
  });
  const next = { ...data, customWidgets, dashboards };
  save(next);
  return next;
}
