# LADR-009 — Dashboard Builder: widget library in sidebar navigation and drag-to-canvas placement

Date: 2026-04-19
Status: PARTIALLY SUPERSEDED — Decision 1 superseded by [LADR-010](20260419-dashboard-ux-cta-and-placement.md)
Owner: Layer2 Meta Insights product
Related: [LADR-008](20260418-dashboard-builder-implementation.md), [LADR-007](20260418-dashboard-builder-model.md)

---

## Context

LADR-008 established the widget system, the `LeftLibraryPanel`, and the canvas drop model. After the initial implementation the widget library was only accessible by clicking "Edit Layout" inside a dashboard canvas. This created a discoverability problem: users had to know that edit mode exists before they could find or add widgets.

Two concrete issues were raised:

1. The widget library is not reachable from the main navigation — it is hidden inside an edit mode that is only visible after opening a specific dashboard.
2. Widgets can only be added by clicking a card in the library panel. Drag-and-drop placement onto the canvas is not supported, which is inconsistent with the grid's existing drag-to-reorder behavior.

---

## Decision 1 — Widget Library as a sidebar navigation entry

**Decision:** A "Widget Library" button is added to the main sidebar under a "Build" section heading. It is rendered only when the current pathname starts with `/dashboard/` (i.e. when viewing a user or system dashboard). It is not shown on Pipelines, Data Quality, Lineage, or other non-dashboard routes.

Clicking the button sets `widgetLibraryOpen = true` in `DashboardContext`, which causes the `LeftLibraryPanel` to render and auto-enables edit mode on the active canvas.

**Rationale:** The sidebar is the primary navigation chrome visible on all pages. Adding a context-sensitive "Build" section there makes widget discovery zero-click from any dashboard view, without polluting the sidebar on non-dashboard pages. The entry uses the existing `Blocks` icon from Lucide, consistent with the icon-per-section convention already in the sidebar.

**State model:**
- `widgetLibraryOpen` and `setWidgetLibraryOpen` are added to `DashboardContextValue` as ephemeral UI state (`useState` in `DashboardProvider`).
- This state is **not** persisted to localStorage and is **not** part of `DashboardStoreData`.
- Closing edit mode (Done button) also sets `widgetLibraryOpen = false`.
- Collapsing the library panel from inside the canvas also sets `widgetLibraryOpen = false`.

---

## Decision 2 — Drag-to-canvas widget placement via HTML5 drag API

**Decision:** Library widget cards are `draggable`. On drag start, each card calls `e.dataTransfer.setData("text/plain", type)` (required for Firefox compatibility) and fires an `onDragStart` callback that sets `draggingWidget` state in `DashboardCanvas` with the widget type and its default grid size.

`ResponsiveGridLayout` receives:
- `dropConfig={{ enabled: editMode, defaultItem: draggingWidget?.size }}` to enable external drop
- `droppingItem` with a placeholder layout item while dragging
- `onDrop` to commit the widget when released over the grid

On drop, `addWidget(type, customWidgetId?)` is called with the same logic as click-to-add, placing the widget at the drop position. The `draggingWidget` state is cleared on `onDragEnd` regardless of whether the drop succeeded.

Click-to-add is preserved unchanged alongside drag-to-add.

**Rationale:** `react-grid-layout` v2 natively supports external drop via `dropConfig` + `droppingItem` + `onDrop`. This avoids adding a separate DnD library (e.g. `@dnd-kit`, `react-dnd`) for what is a first-class capability of the grid already in use. The HTML5 drag API is sufficient for the desktop use case; touch-drag is deferred to a later release.

**Firefox note:** `dataTransfer.setData("text/plain", ...)` must be called in `onDragStart` for Firefox to allow the drag. The actual widget type is passed via the `draggingWidget` state ref, not read back from `dataTransfer`.

---

## Consequences

- `DashboardContext` interface now includes `widgetLibraryOpen: boolean` and `setWidgetLibraryOpen: (open: boolean) => void`.
- `LeftLibraryPanel` props gain optional `onDragStart` and `onDragEnd` callbacks; the component is backward-compatible (both props are optional).
- The `ResponsiveGridLayout` in `DashboardCanvas` gains `dropConfig`, `droppingItem`, and `onDrop`. No changes to the layout persistence or widget slot model.
- The sidebar renders a "Build" section only on `/dashboard/` routes. On all other routes the sidebar is unchanged.
- Touch-drag from the library to the canvas is not implemented. Users on touch devices continue to use click-to-add.

---

## Post-acceptance revision

**Decision 1 was implemented and then superseded.** After UX review, the sidebar "Widget Library" button approach was rejected on two grounds:

1. The sidebar is navigation chrome — adding an action that mutates canvas state from the sidebar violates the navigation/canvas boundary. Users found it unintuitive ("niet innovatief").
2. The sidebar widget library button had no affordance for dashboard selection; users viewing Pipelines or Data Quality could not switch dashboards from inside the canvas.

Decision 1 and its associated sidebar state (`widgetLibraryOpen`, `setWidgetLibraryOpen` in `DashboardContext`, the "Build" section in `sidebar.tsx`) were **removed**. The replacement is described in [LADR-010](20260419-dashboard-ux-cta-and-placement.md).

Decision 2 (drag-to-canvas via HTML5 + `dropConfig`) remains in effect.

---

## Files changed

| File | Change |
|------|--------|
| `src/contexts/dashboard-context.tsx` | Added `widgetLibraryOpen` + `setWidgetLibraryOpen` ephemeral state |
| `src/components/navigation/sidebar.tsx` | Added "Build / Widget Library" nav button, route-conditional |
| `src/app/(dashboard)/dashboard/dashboard.tsx` | Wired `widgetLibraryOpen` context; added `draggingWidget` state; added `dropConfig`, `droppingItem`, `onDrop` to grid |
| `src/app/(dashboard)/dashboard/palette.tsx` | Added `onDragStart`, `onDragEnd` props; made all widget cards `draggable` |
