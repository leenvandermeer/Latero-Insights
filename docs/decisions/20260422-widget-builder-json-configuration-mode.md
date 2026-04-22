# LADR-018 — Widget Builder JSON Configuration Mode

**Date:** 2026-04-22
**Status:** ACCEPTED
**Owner:** Tech Lead
**Related:** [LADR-008](20260418-dashboard-builder-implementation.md), [LADR-010](20260419-dashboard-ux-cta-and-placement.md)

---

## Context

Power users need more flexibility in custom widget authoring than the wizard
step controls provide. The current UI supports only form-driven configuration,
which slows down advanced edits, copy/paste reuse, and quick iteration across
multiple fields.

At the same time, widget definitions are already stored as JSON in the
dashboard store model, so there is no architectural mismatch in supporting a
JSON authoring path.

---

## Decision

### 1. Add an advanced JSON editor in the Widget Builder

- The Widget Builder (`/dashboard/widget-builder`) MUST expose an optional
  JSON editor in the final step.
- The editor allows users to edit the full widget draft:
  `label`, `description`, `queryConfig`, and `visualType`.

### 2. Validate JSON before apply/save

- JSON content MUST be validated for syntactic and structural correctness.
- Invalid JSON MUST show a clear inline validation error and MUST NOT be saved.
- Valid JSON MAY be applied back into the form state so users can continue with
  the guided UI.

### 3. Preserve wizard usability for non-technical users

- Form-based configuration remains the default path.
- JSON editing is explicitly opt-in and does not replace the wizard.

---

## Consequences

- Advanced users can configure widgets faster and with more precision.
- The risk of malformed widget configs is reduced by explicit validation.
- Existing UX remains intact for users who prefer the guided flow.

---

## Implementation Notes

Applied in:

- `src/app/(dashboard)/dashboard/widget-builder/page.tsx`
  - Added advanced JSON editor toggle and textarea.
  - Added draft parser and structural validator for widget JSON.
  - Added "Apply JSON to form" and "Reload from form" actions.
  - Save flow now supports validated JSON draft as source of truth.

---

## Requirement Impact

- Extends [LINS-063](../requirements/insights-product.md) with an optional JSON
  authoring mode and required validation behavior.