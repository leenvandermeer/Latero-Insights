# LADR-019 — In-Place Custom Widget Editing from Dashboard Settings

**Date:** 2026-04-22
**Status:** ACCEPTED
**Owner:** Tech Lead
**Related:** [LADR-018](20260422-widget-builder-json-configuration-mode.md), [LADR-010](20260419-dashboard-ux-cta-and-placement.md)

---

## Context

Users can create custom widgets in the Widget Builder, but could not edit an
existing custom widget directly from the dashboard canvas where it is used.
This introduced unnecessary navigation and reduced iteration speed during
dashboard tuning.

---

## Decision

### 1. Enable in-place edit for custom widgets in the dashboard settings panel

- The widget settings panel MUST support editing the underlying custom widget
  definition when the selected slot points to a `custom` widget.
- Editing is available as an optional JSON editor in the settings panel.

### 2. Show impact before save

- The settings panel MUST show an impact warning when a custom widget is used
  in multiple dashboards.
- Saving the edited custom widget updates all dashboard slots referencing that
  custom widget ID.

### 3. Keep slot-level settings separate

- Slot overrides (`titleOverride`, date override) remain editable independently
  in the same panel.
- Shared widgets (`type: shared`) are not edited through this path.

---

## Consequences

- Faster iteration for dashboard editors without leaving the canvas.
- Better transparency for cross-dashboard impact before applying updates.
- No change to shared widget governance model.

---

## Implementation Notes

Applied in:

- `src/lib/dashboard-store.ts`
  - Added `updateCustomWidget()` mutation for local store updates.
- `src/contexts/dashboard-context.tsx`
  - Exposed `updateCustomWidget()` in context API.
- `src/app/(dashboard)/dashboard/dashboard.tsx`
  - Wired selected custom widget + cross-dashboard usage count into settings panel.
- `src/app/(dashboard)/dashboard/widget-config-panel.tsx`
  - Added optional JSON editor, validation, and impact warning for custom widgets.

---

## Requirement Impact

- Extends [LINS-063](../requirements/insights-product.md) with dashboard-level
  in-place editing for custom widget definitions.