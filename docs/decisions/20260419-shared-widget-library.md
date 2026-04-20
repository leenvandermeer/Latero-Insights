# LADR-012 — Shared Widget Library: three-tier model and server-side persistence

| Field | Value |
| --- | --- |
| Date | 2026-04-19 |
| Status | ACCEPTED |
| Deciders | Latero product |
| Requirements | [LINS-106](../requirements/insights-product.md#lins-106--shared-widget-library), [LINS-107](../requirements/insights-product.md#lins-107--widget-publishing-workflow) |

---

## Context

The Dashboard Builder (LADR-007, LADR-008) introduced two widget tiers:

- **System widgets** — hard-coded in `registry.ts`, shipped with the product, available to every user and dashboard.
- **Personal widgets** — created via the Custom Widget wizard, stored in `localStorage`, visible only to the creating browser session.

This model has a gap: a widget author who builds a useful custom widget cannot share it with other users or dashboards without modifying source code. `localStorage` is per-browser and does not survive cache clears. There is no promotion path.

The product needs a third tier that allows authored widgets to be available org-wide without requiring a code change or deployment.

---

## Decision

Introduce a **shared (org-level) widget tier** with the following properties:

### 1. Three-tier model

| Tier | Source | Persistence | Scope |
| --- | --- | --- | --- |
| `system` | `registry.ts` at build time | Source code | All users, all deployments |
| `shared` | Author publish action at runtime | Server-side JSON store | All users in this deployment |
| `personal` | Custom Widget wizard | `localStorage` | Current browser session only |

The `WidgetTier` type is extended: `"system" | "shared" | "personal"`.

### 2. Persistence — server-side JSON file

Shared widget definitions are stored in a JSON file on the Next.js server: `data/shared-widgets.json`. This file is read and written exclusively through a Next.js API route (`/api/widgets/shared`).

**Why a JSON file and not a database table?**

- Layer2 Meta Insights is read-only toward the Latero meta tables (`pipeline_runs`, `data_quality_checks`, `data_lineage`). It issues no DML. Introducing a writable meta table for widget definitions would violate LINS-005.
- A separate database adds operational complexity for a single-tenant deployment.
- A JSON file is simple, inspectable, version-controllable if desired, and sufficient for the expected volume (tens of shared widgets, not thousands).
- The file is co-located with the application — no additional infrastructure is required.

**Limitations of this choice:**
- Not suitable for multi-instance deployments with a shared filesystem. If the application is deployed on multiple pods, the JSON file must live on shared storage (NFS, mounted volume). This is an accepted constraint for the initial release.
- The file is writable at runtime, so it must not be inside the Next.js `.next/` build output directory.

### 3. API surface

```
GET    /api/widgets/shared          → SharedWidgetDef[]
POST   /api/widgets/shared          → SharedWidgetDef  (create / publish)
DELETE /api/widgets/shared/:id      → 204              (withdraw / unpublish)
```

All routes are server-side only. No client component calls these routes directly — they go through `useSharedWidgets()` (TanStack Query, LINS-093).

### 4. Shared widget definition type

```ts
interface SharedWidgetDef {
  id: string;                  // stable UUID, set at publish time
  label: string;               // display name in palette
  description?: string;
  queryConfig: QueryConfig;    // same query shape as personal custom widgets
  visualType: VisualType;
  defaultSize: { w: number; h: number; minW: number; minH: number };
  publishedAt: string;         // ISO 8601
  publishedBy?: string;        // optional author label (display only, no auth enforced)
}
```

### 5. Palette rendering

The widget palette renders three labelled sections when applicable:

1. **System** — always visible, widgets from `WIDGET_REGISTRY`
2. **Shared** — visible only when at least one shared widget exists
3. **Personal** — visible only when at least one personal custom widget exists

Shared widgets carry a visual badge (`Shared`) in the palette card to distinguish them from system widgets.

### 6. Detach-on-delete semantics

When a shared widget is withdrawn from the library, dashboards that already use it are **not broken**. At the time of withdrawal the application embeds a detached copy of the widget's query definition directly in each affected dashboard's layout record. The widget continues to function as a personal-tier custom widget scoped to that dashboard.

This is preferred over cascading deletion (which would break existing dashboards) and over a versioning model (which adds significant complexity not warranted at this stage).

### 7. Name conflict guard

A new shared widget cannot be published if an existing shared widget with the same `name` already exists. The publish dialog surfaces this as a validation error. The author must rename the widget before publishing.

---

## Consequences

**Positive:**
- Widget authors can share useful building blocks org-wide without a code change or deployment
- Shared widgets are persistent, session-independent, and available to all dashboards
- No new infrastructure required — a single JSON file on the server
- Clean separation of tiers in the palette makes the model legible to users

**Negative / accepted constraints:**
- The JSON file is not suitable for multi-pod deployments without shared storage; this is documented and accepted
- No versioning: editing a shared widget definition is not tracked; authors must withdraw and re-publish to update
- No per-user access control: in a single-tenant deployment any user can withdraw any shared widget; a future multi-tenant release would need role-based guards
- The `data/` directory must be writable at runtime; deployment configurations must account for this

---

## Alternatives considered

### A — Template-based copying
New dashboards could clone a system or existing dashboard as a starting point. This was the original "Start from template" feature (removed in LADR-011 predecessor state). It does not solve the building-block sharing problem because templates copy entire dashboards, not individual reusable widgets.

### B — Code-defined system widgets only
Widget authors add new widget types to `registry.ts` as code. This requires TypeScript knowledge, a code review, and a deployment per new widget. Accepted for core product widgets; not acceptable for operational/org-specific widgets that change frequently.

### C — Writable Latero meta table
Add a `widget_definitions` meta table to the Latero schema. Ruled out because it violates LINS-005 (read-only toward meta tables), introduces DDL dependency on the data platform, and couples the Insights product to the Latero runtime schema.
