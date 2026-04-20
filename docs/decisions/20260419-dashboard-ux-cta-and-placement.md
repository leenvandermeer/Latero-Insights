# LADR-010 — Dashboard Builder: canvas CTA pattern, dashboard title switcher, and smart widget placement

Date: 2026-04-19
Status: ACCEPTED
Owner: Layer2 Meta Insights product
Related: [LADR-009](20260419-widget-library-navigation-and-drag.md), [LADR-008](20260418-dashboard-builder-implementation.md)

---

## Context

After the initial LADR-009 implementation (sidebar widget library button), a UX review identified three problems:

1. **Edit mode discoverability** — "Edit Layout" was a secondary call-to-action buried next to the date picker. Users unfamiliar with the product had no clear entry point for adding widgets.
2. **Dashboard navigation** — Users had no way to switch between dashboards from inside the canvas. The title was static text; navigation required going back to the sidebar.
3. **Widget placement algorithm** — `addWidget` placed every new widget at `y: Infinity, x: 0`, stacking all widgets in the first column. On a 12-column grid this left 9 columns empty and produced a visually broken layout on any screen wider than the minimum.

---

## Decision 1 — "+ Add Widget" as primary canvas CTA

**Decision:** The primary entry point to edit mode is an **"+ Add Widget"** button in the dashboard header, displayed with accent background colour whenever the canvas is not in edit mode. The previous secondary "Edit Layout" text button is removed.

On click, the button enables edit mode and opens the `LeftLibraryPanel`. The widget library panel is now entirely controlled by the canvas edit mode flag (`editMode` in `DashboardCanvas`) — no separate `widgetLibraryOpen` state in `DashboardContext` is needed.

**Rationale:** Market best practice (Grafana, Retool, Amplitude) is a single high-contrast "Add…" CTA that opens the widget panel in one click. Hiding widget discovery behind an unlabelled "Edit Layout" toggle is a two-step find-then-act pattern that increases time-to-first-widget. The accent-coloured CTA is visible on first load and communicates the primary action clearly.

**State model change:** `widgetLibraryOpen` and `setWidgetLibraryOpen` are removed from `DashboardContext`. The library panel is rendered when `editMode === true` in `DashboardCanvas`. No shared context state is needed.

---

## Decision 2 — Dashboard title as switcher dropdown

**Decision:** The static dashboard title (`<h1>`) is replaced by a clickable title + chevron that opens a **dashboard switcher dropdown**. The dropdown lists:

- System dashboards (Pipelines, Data Quality) under a "System" section header
- User dashboards under a "My Dashboards" section header (omitted when empty)
- A "New Dashboard" action at the bottom

Selecting an entry navigates to that dashboard route. System dashboards map to their canonical routes (`/pipelines`, `/quality`); user dashboards navigate to `/dashboard/${id}`.

The active dashboard is marked with a check icon.

**Rationale:** Dashboards are the primary unit of navigation inside the canvas area. Making the title the pivot point for dashboard switching is the pattern used by Amplitude, Metabase, and Looker. It avoids adding a dedicated dashboard selector widget or requiring the user to use the sidebar when they are already working on a canvas.

**Implementation note:** A full-screen click-away overlay (`position: fixed; inset: 0`) closes the dropdown when clicking outside it. The dropdown renders as a positioned element inside the title container so it does not affect the header height.

---

## Decision 3 — Smart widget placement algorithm (`findPlacement`)

**Decision:** `addWidget` uses a `findPlacement(cols, items, w, h)` function to compute the position of each new widget rather than placing at `y: Infinity, x: 0`.

`findPlacement` iterates the grid from `y=0` to `maxOccupiedY + 1`, left-to-right, and returns the first `(x, y)` position where a rectangle of size `(w, h)` does not overlap any existing layout item. Overlap is checked with the standard AABB test:

```
noOverlap = x + w <= item.x || x >= item.x + item.w || y + h <= item.y || y >= item.y + item.h
```

Placement is computed independently for each responsive breakpoint (`lg` 12-col, `md` 8-col, `sm` 4-col) using the items and column count of that breakpoint.

**Rationale:** `y: Infinity` is the `react-grid-layout` sentinel for "append below all existing items". It always places at `x: 0`, producing a left-aligned column of widgets regardless of how much horizontal space is available. The `findPlacement` algorithm fills gaps left by removed or resized widgets and distributes additions across the full grid width, matching the visual expectation of a 12-column layout.

**Correctness bound:** The function is guaranteed to return a valid position because the fallback case `{ x: 0, y: maxY + 1 }` is always valid (below all existing items). The loop scans at most `(maxY + 2) × cols` cells, which is bounded by the number of existing items × their average height — acceptable for dashboards of typical size (< 30 widgets).

---

## Consequences

- `DashboardContext` no longer exports `widgetLibraryOpen` or `setWidgetLibraryOpen`. Consumers that referenced those properties will see a TS error and must be updated.
- `sidebar.tsx` no longer imports `useDashboards` for widget library state. The sidebar is pure navigation.
- `DashboardCanvas` gains `systemDashboards` and `userDashboards` from `useDashboards()` for the switcher dropdown, and `useRouter` for programmatic navigation.
- New widgets are placed at the first available grid position rather than appended at `x:0, y:Infinity`. Existing saved layouts are unaffected.
- The `key` prop on the `containerRef` div (which was forcing a full grid remount on edit mode toggle) is removed; `useContainerWidth` ResizeObserver handles width recalculation naturally.

---

## Files changed

| File | Change |
|------|--------|
| `src/app/(dashboard)/dashboard/dashboard.tsx` | Replaced "Edit Layout" with "+ Add Widget" CTA; dashboard title → switcher dropdown; `addWidget` uses `findPlacement`; removed `key` from containerRef div |
| `src/contexts/dashboard-context.tsx` | Removed `widgetLibraryOpen` + `setWidgetLibraryOpen` |
| `src/components/navigation/sidebar.tsx` | Removed "Build / Widget Library" section; removed `useDashboards` import |
