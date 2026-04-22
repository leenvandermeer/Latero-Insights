import type { Dashboard, DashboardStoreData, CustomWidget, WidgetSlot, SharedWidgetDef } from "@/types/dashboard";
import type { ResponsiveLayouts } from "react-grid-layout";

const STORAGE_KEY = "insights-dashboard-store-v1";

// ─── System dashboard factory definitions ───────────────────────────────────
// Imported lazily to avoid circular deps with registry

const systemPipelinesSlots: WidgetSlot[] = [
  { instanceId: "sys-total-runs",      type: "total-runs" },
  { instanceId: "sys-failed-runs",     type: "failed-runs" },
  { instanceId: "sys-dataset-ov",      type: "dataset-overview" },
  { instanceId: "sys-pipeline-status", type: "pipeline-status" },
  { instanceId: "sys-step-duration",   type: "step-duration" },
  { instanceId: "sys-event-log",       type: "event-log" },
  { instanceId: "sys-runs-table",      type: "pipeline-runs-table" },
];

const systemPipelinesLayout: ResponsiveLayouts = {
  lg: [
    { i: "sys-total-runs",      x: 0, y: 0,  w: 3,  h: 2, minW: 2, minH: 2 },
    { i: "sys-failed-runs",     x: 3, y: 0,  w: 3,  h: 2, minW: 2, minH: 2 },
    { i: "sys-dataset-ov",      x: 6, y: 0,  w: 6,  h: 4, minW: 3, minH: 2 },
    { i: "sys-pipeline-status", x: 0, y: 2,  w: 6,  h: 4, minW: 4, minH: 3 },
    { i: "sys-step-duration",   x: 0, y: 6,  w: 6,  h: 4, minW: 4, minH: 3 },
    { i: "sys-event-log",       x: 6, y: 5,  w: 6,  h: 4, minW: 3, minH: 3 },
    { i: "sys-runs-table",      x: 0, y: 10, w: 12, h: 5, minW: 6, minH: 3 },
  ],
  md: [
    { i: "sys-total-runs",      x: 0, y: 0,  w: 4,  h: 2, minW: 2, minH: 2 },
    { i: "sys-failed-runs",     x: 4, y: 0,  w: 4,  h: 2, minW: 2, minH: 2 },
    { i: "sys-pipeline-status", x: 0, y: 2,  w: 8,  h: 4, minW: 4, minH: 3 },
    { i: "sys-step-duration",   x: 0, y: 6,  w: 8,  h: 4, minW: 4, minH: 3 },
    { i: "sys-dataset-ov",      x: 0, y: 10, w: 4,  h: 4, minW: 3, minH: 2 },
    { i: "sys-event-log",       x: 4, y: 10, w: 4,  h: 5, minW: 3, minH: 3 },
    { i: "sys-runs-table",      x: 0, y: 15, w: 8,  h: 5, minW: 6, minH: 3 },
  ],
  sm: [
    { i: "sys-total-runs",      x: 0, y: 0,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-failed-runs",     x: 0, y: 2,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-pipeline-status", x: 0, y: 4,  w: 4, h: 4, minW: 4, minH: 3 },
    { i: "sys-dataset-ov",      x: 0, y: 8,  w: 4, h: 4, minW: 3, minH: 2 },
    { i: "sys-step-duration",   x: 0, y: 13, w: 4, h: 4, minW: 4, minH: 3 },
    { i: "sys-event-log",       x: 0, y: 17, w: 4, h: 4, minW: 3, minH: 3 },
    { i: "sys-runs-table",      x: 0, y: 21, w: 4, h: 5, minW: 4, minH: 3 },
  ],
};

const systemQualitySlots: WidgetSlot[] = [
  { instanceId: "sys-pass-rate",        type: "pass-rate" },
  { instanceId: "sys-failed-runs-q",    type: "failed-runs" },
  { instanceId: "sys-bcbs239",          type: "bcbs239-score" },
  { instanceId: "sys-dq-trend",         type: "dq-trend" },
  { instanceId: "sys-severity-cat",     type: "severity-category" },
  { instanceId: "sys-dataset-ov-q",     type: "dataset-overview" },
  { instanceId: "sys-dq-table",         type: "dq-checks-table" },
];

const systemQualityLayout: ResponsiveLayouts = {
  lg: [
    { i: "sys-pass-rate",      x: 0, y: 0, w: 4,  h: 2, minW: 2, minH: 2 },
    { i: "sys-failed-runs-q",  x: 4, y: 0, w: 4,  h: 2, minW: 2, minH: 2 },
    { i: "sys-bcbs239",        x: 8, y: 0, w: 4,  h: 2, minW: 2, minH: 2 },
    { i: "sys-dq-trend",       x: 0, y: 2, w: 6,  h: 4, minW: 4, minH: 3 },
    { i: "sys-severity-cat",   x: 6, y: 2, w: 6,  h: 4, minW: 4, minH: 3 },
    { i: "sys-dataset-ov-q",   x: 0, y: 6, w: 4,  h: 4, minW: 3, minH: 2 },
    { i: "sys-dq-table",       x: 4, y: 6, w: 8,  h: 5, minW: 6, minH: 3 },
  ],
  md: [
    { i: "sys-pass-rate",      x: 0, y: 0,  w: 4,  h: 2, minW: 2, minH: 2 },
    { i: "sys-failed-runs-q",  x: 4, y: 0,  w: 4,  h: 2, minW: 2, minH: 2 },
    { i: "sys-bcbs239",        x: 0, y: 2,  w: 4,  h: 2, minW: 2, minH: 2 },
    { i: "sys-dq-trend",       x: 0, y: 4,  w: 8,  h: 4, minW: 4, minH: 3 },
    { i: "sys-severity-cat",   x: 0, y: 8,  w: 8,  h: 4, minW: 4, minH: 3 },
    { i: "sys-dataset-ov-q",   x: 0, y: 12, w: 4,  h: 4, minW: 3, minH: 2 },
    { i: "sys-dq-table",       x: 4, y: 12, w: 4,  h: 5, minW: 4, minH: 3 },
  ],
  sm: [
    { i: "sys-pass-rate",      x: 0, y: 0,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-failed-runs-q",  x: 0, y: 2,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-bcbs239",        x: 0, y: 4,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-dq-trend",       x: 0, y: 6,  w: 4, h: 4, minW: 4, minH: 3 },
    { i: "sys-severity-cat",   x: 0, y: 10, w: 4, h: 4, minW: 4, minH: 3 },
    { i: "sys-dataset-ov-q",   x: 0, y: 14, w: 4, h: 4, minW: 3, minH: 2 },
    { i: "sys-dq-table",       x: 0, y: 19, w: 4, h: 5, minW: 4, minH: 3 },
  ],
};

const systemBcbs239Slots: WidgetSlot[] = [
  { instanceId: "sys-bcbs-score",       type: "bcbs239-score" },
  { instanceId: "sys-bcbs-pass-rate",   type: "pass-rate" },
  { instanceId: "sys-bcbs-failed",      type: "failed-runs" },
  { instanceId: "sys-bcbs-dq-trend",    type: "dq-trend" },
  { instanceId: "sys-bcbs-sev-cat",     type: "severity-category" },
  { instanceId: "sys-bcbs-dataset-ov",  type: "dataset-overview" },
  { instanceId: "sys-bcbs-dq-table",    type: "dq-checks-table" },
];

const systemBcbs239Layout: ResponsiveLayouts = {
  lg: [
    { i: "sys-bcbs-score",      x: 0, y: 0, w: 4,  h: 2, minW: 2, minH: 2 },
    { i: "sys-bcbs-pass-rate",  x: 4, y: 0, w: 4,  h: 2, minW: 2, minH: 2 },
    { i: "sys-bcbs-failed",     x: 8, y: 0, w: 4,  h: 2, minW: 2, minH: 2 },
    { i: "sys-bcbs-dq-trend",   x: 0, y: 2, w: 6,  h: 4, minW: 4, minH: 3 },
    { i: "sys-bcbs-sev-cat",    x: 6, y: 2, w: 6,  h: 4, minW: 4, minH: 3 },
    { i: "sys-bcbs-dataset-ov", x: 0, y: 6, w: 4,  h: 4, minW: 3, minH: 2 },
    { i: "sys-bcbs-dq-table",   x: 4, y: 6, w: 8,  h: 5, minW: 6, minH: 3 },
  ],
  md: [
    { i: "sys-bcbs-score",      x: 0, y: 0,  w: 4,  h: 2, minW: 2, minH: 2 },
    { i: "sys-bcbs-pass-rate",  x: 4, y: 0,  w: 4,  h: 2, minW: 2, minH: 2 },
    { i: "sys-bcbs-failed",     x: 0, y: 2,  w: 4,  h: 2, minW: 2, minH: 2 },
    { i: "sys-bcbs-dq-trend",   x: 0, y: 4,  w: 8,  h: 4, minW: 4, minH: 3 },
    { i: "sys-bcbs-sev-cat",    x: 0, y: 8,  w: 8,  h: 4, minW: 4, minH: 3 },
    { i: "sys-bcbs-dataset-ov", x: 0, y: 12, w: 4,  h: 4, minW: 3, minH: 2 },
    { i: "sys-bcbs-dq-table",   x: 4, y: 12, w: 4,  h: 5, minW: 4, minH: 3 },
  ],
  sm: [
    { i: "sys-bcbs-score",      x: 0, y: 0,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-bcbs-pass-rate",  x: 0, y: 2,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-bcbs-failed",     x: 0, y: 4,  w: 4, h: 2, minW: 2, minH: 2 },
    { i: "sys-bcbs-dq-trend",   x: 0, y: 6,  w: 4, h: 4, minW: 4, minH: 3 },
    { i: "sys-bcbs-sev-cat",    x: 0, y: 10, w: 4, h: 4, minW: 4, minH: 3 },
    { i: "sys-bcbs-dataset-ov", x: 0, y: 14, w: 4, h: 4, minW: 3, minH: 2 },
    { i: "sys-bcbs-dq-table",   x: 0, y: 19, w: 4, h: 5, minW: 4, minH: 3 },
  ],
};

const NOW = new Date(0).toISOString();
const SYSTEM_LAYOUT_VERSION = 2;

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
    name: "My Dashboard",
    description: "Pipeline health overview — last 7 days",
    isSystem: false,
    widgets: [
      { instanceId: "d-total-runs",      type: "total-runs" },
      { instanceId: "d-failed-runs",     type: "failed-runs" },
      { instanceId: "d-pass-rate",       type: "pass-rate" },
      { instanceId: "d-pipeline-status", type: "pipeline-status" },
      { instanceId: "d-event-log",       type: "event-log" },
      { instanceId: "d-runs-table",      type: "pipeline-runs-table" },
    ],
    layout: {
      lg: [
        { i: "d-total-runs",      x: 0,  y: 0, w: 3,  h: 2, minW: 2, minH: 2 },
        { i: "d-failed-runs",     x: 3,  y: 0, w: 3,  h: 2, minW: 2, minH: 2 },
        { i: "d-pass-rate",       x: 6,  y: 0, w: 3,  h: 2, minW: 2, minH: 2 },
        { i: "d-pipeline-status", x: 0,  y: 2, w: 8,  h: 4, minW: 4, minH: 3 },
        { i: "d-event-log",       x: 8,  y: 2, w: 4,  h: 4, minW: 3, minH: 3 },
        { i: "d-runs-table",      x: 0,  y: 6, w: 12, h: 5, minW: 6, minH: 3 },
      ],
      md: [
        { i: "d-total-runs",      x: 0, y: 0,  w: 4,  h: 2, minW: 2, minH: 2 },
        { i: "d-failed-runs",     x: 4, y: 0,  w: 4,  h: 2, minW: 2, minH: 2 },
        { i: "d-pass-rate",       x: 0, y: 2,  w: 4,  h: 2, minW: 2, minH: 2 },
        { i: "d-pipeline-status", x: 0, y: 4,  w: 8,  h: 4, minW: 4, minH: 3 },
        { i: "d-event-log",       x: 0, y: 8,  w: 8,  h: 4, minW: 3, minH: 3 },
        { i: "d-runs-table",      x: 0, y: 12, w: 8,  h: 5, minW: 6, minH: 3 },
      ],
      sm: [
        { i: "d-total-runs",      x: 0, y: 0,  w: 4, h: 2, minW: 2, minH: 2 },
        { i: "d-failed-runs",     x: 0, y: 2,  w: 4, h: 2, minW: 2, minH: 2 },
        { i: "d-pass-rate",       x: 0, y: 4,  w: 4, h: 2, minW: 2, minH: 2 },
        { i: "d-pipeline-status", x: 0, y: 6,  w: 4, h: 4, minW: 4, minH: 3 },
        { i: "d-event-log",       x: 0, y: 10, w: 4, h: 4, minW: 3, minH: 3 },
        { i: "d-runs-table",      x: 0, y: 14, w: 4, h: 5, minW: 4, minH: 3 },
      ],
    },
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Storage adapter ─────────────────────────────────────────────────────────

function load(): DashboardStoreData {
  if (typeof window === "undefined") {
    return { dashboards: [makeDefaultDashboard()], customWidgets: [], activeId: "default" };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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
  save(initial);
  return initial;
}

function save(data: DashboardStoreData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage unavailable
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function loadStore(): DashboardStoreData {
  return load();
}

export function saveStore(data: DashboardStoreData): void {
  save(data);
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
    queryConfig: sharedWidget.queryConfig,
    visualType: sharedWidget.visualType,
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
