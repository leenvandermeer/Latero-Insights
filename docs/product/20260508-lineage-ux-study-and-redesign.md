# Latero Control — Lineage UX Study And Redesign

**Date:** 2026-05-08  
**Author:** Codex / tech-lead study draft  
**Status:** Proposed

---

## 1. Purpose

This study reviews the current lineage experience in Latero Control and proposes a new UX design for the `/lineage` graph experience.

The redesign goal is simple:

> A user must be able to select one entity, choose a direction and depth, and understand the relevant lineage path without fighting the canvas.

This proposal is based on:

- current product requirements and UX ADRs in `docs/`
- the current implementation in `web/src/app/(tenant)/(dashboard)/lineage/*`
- market patterns from Databricks, Atlan, Collibra, and Alation

---

## 2. Inputs Reviewed

### Local product and architecture inputs

- [docs/requirements/current-product-requirements.md](/Users/leenvandermeer/Git/Latero%20Control/docs/requirements/current-product-requirements.md)
- [docs/requirements/v2-product-design.md](/Users/leenvandermeer/Git/Latero%20Control/docs/requirements/v2-product-design.md)
- [docs/decisions/20260422-progressive-disclosure-dashboard-ux.md](/Users/leenvandermeer/Git/Latero%20Control/docs/decisions/20260422-progressive-disclosure-dashboard-ux.md)
- [docs/decisions/20260424-lineage-graph-entity-labels-and-dataset-focus.md](/Users/leenvandermeer/Git/Latero%20Control/docs/decisions/20260424-lineage-graph-entity-labels-and-dataset-focus.md)
- [docs/decisions/20260507-lineage-entity-focus-and-cross-chain-upstream.md](/Users/leenvandermeer/Git/Latero%20Control/docs/decisions/20260507-lineage-entity-focus-and-cross-chain-upstream.md)
- [web/src/app/(tenant)/(dashboard)/lineage/dashboard.tsx](/Users/leenvandermeer/Git/Latero%20Control/web/src/app/(tenant)/(dashboard)/lineage/dashboard.tsx)
- [web/src/app/(tenant)/(dashboard)/lineage/graph-view.tsx](/Users/leenvandermeer/Git/Latero%20Control/web/src/app/(tenant)/(dashboard)/lineage/graph-view.tsx)
- [web/src/app/(tenant)/(dashboard)/lineage/entity-detail-panel.tsx](/Users/leenvandermeer/Git/Latero%20Control/web/src/app/(tenant)/(dashboard)/lineage/entity-detail-panel.tsx)

### Market references reviewed on 2026-05-08

- Databricks Unity Catalog lineage docs: https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage
- Atlan lineage graph docs: https://docs.atlan.com/product/capabilities/lineage/how-tos/view-lineage
- Collibra technical lineage docs: https://productresources.collibra.com/docs/collibra/latest/Content/CollibraDataLineage/TechnicalLineage/co_technical-lineage.htm
- Collibra browse/settings patterns: https://productresources.collibra.com/docs/release-notes/Content/CollibraDataLineage/ref_browse_tab_pane.htm and https://productresources.collibra.com/docs/release-notes/Content/CollibraDataLineage/ref_settings_tab_pane.htm
- Alation lineage impact analysis docs: https://www.alation.com/docs/en/latest/sources/Lineage/LineageImpactAnalysis.html

---

## 3. Summary Conclusion

The current Latero graph is functional, but it combines too many user intents in one canvas:

- estate browsing
- entity investigation
- upstream/downstream tracing
- detail inspection
- filtering

That creates a UX that is technically capable but cognitively unstable.

The core issue is not only styling or layout. The core issue is that the graph is still **canvas-first**, while the user task is **investigation-first**.

The recommended redesign is:

1. Replace the single graph mental model with **two graph modes**:
   - **Map** for broad estate scanning
   - **Trace** for entity-centered investigation
2. Make **entity selection the primary entry point** for detailed exploration.
3. Add explicit **direction** and **depth** controls:
   - upstream / downstream / both
   - 1 hop / 2 hops / 3 hops / all
4. Add a complementary **impact list view** for precise downstream/upstream lists.
5. Stop relying on opacity-heavy filtering as the main interaction model.

---

## 4. Audit Of The Current Lineage UX

This section originally focused on the graph experience. It is now expanded to cover the entire `/lineage` page as one workflow:

- `Overview`
- `Graph`
- `Chains`
- `Columns`

### 4.1 What works

- The product already follows progressive disclosure reasonably well:
  graph first, detail panel second, columns as dense detail third.
- Entity focus already exists.
- Upstream and downstream tracing already exists.
- The detail panel is useful and aligns with the existing ADR direction.
- Layer semantics are explicit and important to the product domain.
- The page already has a meaningful specialist structure instead of collapsing everything into one dashboard card grid.

### 4.2 What feels wrong in practice

#### A0. The page has four tabs, but only two clear user journeys

Today the user sees four parallel tabs:

- `Overview`
- `Graph`
- `Chains`
- `Columns`

In practice, these do not represent four equally clear jobs.

The real user journeys are closer to:

1. "Show me what is broken or important."
2. "Let me investigate one entity or chain."
3. "Let me inspect dense technical evidence."

That means the current tab model creates overlap:

- `Graph` and `Chains` both try to explain structure
- `Overview` already includes chain-level summaries
- `Columns` is evidence, not peer-level navigation

This is why the full page can feel less standard than the individual components might suggest.

#### A. One toolbar is carrying multiple mental models

The current toolbar mixes:

- focus-layer filter
- entity selector
- search
- graph layer filter
- status filter
- reset
- viewpoint toggle

This is a strong signal that the screen does not have one dominant job.

#### B. Selection and viewpoint are coupled in a hidden way

The current graph changes meaning based on a combination of:

- `entityFocus`
- `selectedNodeId`
- `viewMode`
- opacity filtering

This makes the canvas state hard to predict. A selected node can mean:

- "show details"
- "dim neighbors"
- "switch to upstream path"
- "switch to downstream path"

depending on other state already present.

#### C. Filters mostly dim the graph instead of simplifying it

Current search/layer/status filters reduce opacity rather than restructuring the graph.
That preserves visual noise. Users still have to parse the same topology, just faded.

For lineage investigation, users usually want:

- isolate a path
- expand one level further
- compare one branch to another

not "keep the whole graph on screen but dim most of it."

#### D. Global map and focused trace are competing in the same canvas

The current graph tries to be both:

- a full lineage map
- a focused path explorer

Those are different UX jobs.

The result is that the global graph is too dense for exploration, and the focused graph still inherits controls and layout behaviors from the global graph.

#### E. The detail panel is good, but the investigation pivot is incomplete

The detail panel shows upstream/downstream lists, but it does not let the user express the key analytical question in the UI model:

- show only first hop
- show two hops
- show only bronze and silver
- show all upstream bronze parents
- show downstream gold impact only

That intent belongs in the primary interaction model, not as a manual mental exercise.

#### F. Draggable positions are useful for ad hoc layouts, but bad for deterministic reasoning

Persisted manual node positions help with personal tweaking, but for investigation UX they can degrade readability:

- relative position starts to lie about actual structure
- repeated analyses are less reproducible
- "Reset" becomes overloaded because it resets layout and analytic state together

For a trace workflow, deterministic layout is more valuable than free-form drag.

#### G. `Overview` is useful, but promises more continuity than the page currently delivers

`Overview` is the strongest tab on the page from a dashboard perspective:

- health score
- open risk
- lineage coverage
- column flows
- layer coverage
- chain readiness

However, the next-step pathways are still fragmented:

- layer coverage points toward the graph
- chain readiness points toward chains
- column flow KPIs point toward columns

That means the user must decide between multiple structural views before they have chosen an investigation anchor.

For a strong specialist page, `Overview` should not mainly route users into different visualization types. It should route them into a consistent investigation flow.

#### H. `Chains` is informative, but overlaps with both `Overview` and `Graph`

`Chains` gives:

- chain grouping
- layer progress
- per-entity expansion
- upstream/downstream detail lists

This is valuable, but it overlaps with:

- `Overview` chain readiness cards
- `Graph` structural understanding
- detail panel investigation

So `Chains` currently behaves like a middle layer that is neither the best overview nor the best investigation surface.

It may still be useful tactically, but strategically it is probably not the right primary destination.

#### I. `Columns` is technically clear, but weak as a page-level destination when evidence is sparse

On the real `Vdmeer Consulting` tenant reviewed for this study:

- `Columns` currently returns `0` attribute flows

This matters for page UX:

- `Overview` still presents "Column flows" as one of the four top KPIs
- `Columns` still appears as a full peer tab
- the user can navigate there and hit an empty evidence surface

That is not a failure of the table component itself. It is a workflow issue:

- column lineage is evidence-level detail
- evidence may be partial or absent
- the page currently gives it the same navigational weight as the main structural views

The right pattern is:

- keep `Columns` available
- treat it as evidence detail
- communicate coverage clearly before the user lands there

#### J. The page lacks one dominant "next best action"

The strongest lineage pages in the market usually make one action feel primary:

- pick an asset
- start tracing
- expand one level

The current `/lineage` page instead asks the user to choose a visualization family first:

- overview metric reading
- graph canvas reading
- chain expansion reading
- column table reading

That increases cognitive setup cost.

---

## 5. Market Pattern Synthesis

### Databricks

Databricks starts from the asset, shows one level by default, and lets the user expand from nodes. It also uses a connection panel for edge details and allows column lineage on demand.

Relevant pattern:

- start narrow
- reveal more only when asked
- edge detail is first-class

Source:
- https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage

### Atlan

Atlan centers the experience around a base asset with explicit upstream/downstream expansion controls, search in canvas, pinned metadata sidebar, column lineage controls, and visibility controls for non-path assets.

Relevant pattern:

- base asset anchor
- explicit path controls
- pinned context sidebar
- path visibility as a deliberate mode

Source:
- https://docs.atlan.com/product/capabilities/lineage/how-tos/view-lineage

### Collibra

Collibra separates browse/search, settings, dependency direction, and depth. It also distinguishes object, attribute, and transformation views.

Relevant pattern:

- clear browse pane
- explicit direction toggle
- explicit depth control
- different visualizations for different questions

Sources:
- https://productresources.collibra.com/docs/release-notes/Content/CollibraDataLineage/ref_browse_tab_pane.htm
- https://productresources.collibra.com/docs/release-notes/Content/CollibraDataLineage/ref_settings_tab_pane.htm

### Alation

Alation complements the graph with tabular upstream/downstream reports and a max-distance filter. That matters because graph is not always the best answer for impact analysis.

Relevant pattern:

- graph plus report
- max traversal distance
- child-column scoping

Source:
- https://www.alation.com/docs/en/latest/sources/Lineage/LineageImpactAnalysis.html

### What the market consistently does

- Asset-first exploration beats full-canvas-first exploration.
- Direction is explicit.
- Depth is explicit.
- Column lineage is secondary and on-demand.
- Graph is complemented by list/report views for exact analysis.
- Expansion is deliberate, not merely opacity-based.

---

## 6. Proposed UX Direction For Latero

## Principle

Latero should treat lineage as an **investigation workspace**, not as a generic graph canvas.

### New information architecture inside `/lineage`

Recommended tabs:

- `Overview`
- `Map`
- `Trace`
- `Columns`
- optional later: `Impact`

This replaces the current mental model of `Graph` and `Chains` as separate but overlapping specialist modes.

### Whole-page interpretation

The page should be read as a funnel:

1. `Overview` tells you where to look
2. `Trace` lets you investigate one entity or path
3. `Columns` lets you inspect dense evidence

`Map` stays available for orientation, but should no longer be the default mental center of the page.

---

## 6.1 Recommended Full Page Model

### Recommended tab order

The full `/lineage` page should be reorganized to this order:

1. `Overview`
2. `Trace`
3. `Map`
4. `Columns`
5. optional later: `Impact`

### Why this order

#### `Overview` first

This remains the best first-load state for most users:

- fastest comprehension
- strongest dashboard behavior
- best place to summarize health, chain coverage, and missing evidence

#### `Trace` second

This becomes the primary investigation entry point.

The page should make it obvious that once the user sees a problem or a target entity, the next step is:

- choose an entity
- trace upstream/downstream
- narrow by hop depth and layers

#### `Map` third

`Map` is important, but no longer the primary job surface.

It stays available when the user wants:

- broad estate orientation
- pattern scanning
- a compact structural overview

#### `Columns` fourth

`Columns` is evidence, not the primary way to begin analysis.

It should still be easy to reach, but it should no longer read like a peer investigative mode next to `Trace`.

#### `Impact` later

`Impact` is the right longer-term home for list/report style investigation that is currently split across:

- `Chains`
- detail panel upstream/downstream lists
- future downstream audit needs

### Recommended default tab on page load

Default should remain:

- `Overview` when no `entity` is specified

If the URL already contains a trace anchor:

- open directly into `Trace`

Examples:

- `/lineage` → `Overview`
- `/lineage?entity=silver::silver_klimaatindicator` → `Trace`

---

## 6.2 Recommended Cross-Tab Page Narrative

The page should tell one coherent story:

### Step 1. Orient

Use `Overview` to answer:

- how healthy is the lineage estate?
- which layers are weak?
- which chains or entities deserve attention?
- do we even have column evidence coverage?

### Step 2. Investigate

Use `Trace` to answer:

- where did this entity come from?
- what does this entity affect?
- what changes if I expand one more hop?
- what happens if I isolate bronze/silver/gold only?

### Step 3. Verify evidence

Use `Columns` to answer:

- are there attribute-level mappings?
- are the expected column transformations available?
- what technical evidence supports this relationship?

### Step 4. Re-orient when needed

Use `Map` when the user needs to zoom back out and understand the wider estate topology.

This sequence is important:

- `Map` should not be the first thing users must decode
- `Trace` should not be hidden behind broad topology navigation
- `Columns` should not be used as primary navigation

---

## 7. Proposed View 1: Map

### Purpose

`Map` is the broad topology view.

It answers:

- what major chains exist?
- where are the hotspots?
- which layers are populated?
- which entities are risky or broken?

### Behavior

- Read-only and mostly non-investigative
- No draggable node positions
- Minimal filter set:
  - search
  - layer visibility
  - status visibility
- Selecting a node opens a light detail rail
- Primary CTA from a node:
  - `Open In Trace`

### Layout

- Compact graph with strong lane semantics
- Nodes stay small and scannable
- Cross-chain edges remain visible but visually secondary
- Mini-map can stay here

### Why this helps

The global graph remains available, but it stops pretending to be the main analysis tool.

---

## 8. Proposed View 2: Trace

### Purpose

`Trace` is the main answer to the user need:

> "I want to select one silver entity and inspect its related nodes by depth or by layer."

### Primary controls

Top control bar:

- `Anchor entity` search/select
- `Direction`: Upstream | Downstream | Both
- `Depth`: 1 | 2 | 3 | All
- `Layers`: Landing | Raw | Bronze | Silver | Gold
- `Layout`: Layer lanes | Tree

Secondary controls:

- `Show process evidence`
- `Show file sources`
- `Show only active path`

### Core interaction model

1. User selects an entity.
2. Latero builds a bounded subgraph around that entity.
3. User changes direction and depth explicitly.
4. Canvas redraws to the new scope.
5. Clicking a node updates the right rail, but does not silently change the trace mode.

### Important behavior rules

- The anchor entity is always visually obvious.
- Direction is not inferred from a click; it is chosen in a visible control.
- Depth is not inferred from hidden BFS behavior; it is chosen in a visible control.
- Selecting a node should inspect it, not mutate the graph meaning unless the user explicitly asks to re-anchor.

### Node actions

Inside the detail rail:

- `Re-anchor here`
- `Trace upstream`
- `Trace downstream`
- `Show only 1 hop`
- `Open column lineage`
- `View related runs` later

### Why this helps

This matches how data teams think:

- start from one object
- ask "where did this come from?"
- ask "what will this affect?"
- narrow or widen depth as needed

---

## 9. Add A Complementary Impact List

Graph alone is not enough for downstream impact analysis.

Add a companion panel or tabular subview in `Trace`:

- `Graph`
- `List`

The list view should show:

- related entity name
- layer
- direction
- hop distance
- latest status
- last success

This is especially important when one gold entity fans out to many downstream consumers, or one silver entity depends on multiple upstream sources across chains.

This pattern is directly supported by what Alation exposes through impact and upstream audit reports.

---

## 10. Detailed Latero UX Proposal

### 10.1 Recommended screen structure for `Trace`

Three-column layout:

- Left rail: investigation controls and saved recent anchors
- Center: trace graph canvas
- Right rail: node details, attributes preview, impact summary

### 10.2 Left rail content

- anchor entity selector
- direction toggle
- depth chips
- layer toggles
- optional "include files" toggle
- recent anchors
- shareable URL state summary

### 10.3 Center canvas behavior

- deterministic auto-layout
- no persisted drag in v1 of Trace
- layer lanes remain visible because layer semantics matter in Latero
- if `Direction = Upstream`, the anchor sits right-of-center
- if `Direction = Downstream`, the anchor sits left-of-center
- if `Direction = Both`, the anchor sits center

### 10.4 Right rail content

- selected node summary
- status badges
- layer
- latest success
- direct upstream count
- direct downstream count
- source datasets
- attribute preview
- `Open full Columns view`
- future:
  - related runs
  - edge evidence
  - observation count

### 10.5 Scope chips above the graph

Under the top bar, show a live scope sentence such as:

- `Tracing upstream from silver::customer_orders, 2 hops, layers: bronze + raw`
- `Showing 7 entities across 3 layers`

This removes ambiguity about what the graph currently means.

---

## 11. Specific UX Problems This Solves

### Current need: select a silver entity and see only 1st or 2nd layer

Solved by:

- anchor entity selector
- explicit depth chips
- explicit layer toggles

### Current need: inspect per bronze, silver, gold

Solved by:

- layer toggles in Trace
- lane-based layout
- impact list grouped by layer

### Current need: distinguish map browsing from root cause analysis

Solved by:

- separate `Map` and `Trace` views

### Current need: preserve progressive disclosure

Solved by:

- graph = structure
- detail rail = context
- columns = dense technical detail
- impact list = precise audit format

---

## 11.1 Concrete `Overview` To Investigation CTA Model

The current `Overview` already contains the right kinds of summaries. The change needed is in the CTA logic.

### KPI cards

#### Health score

CTA:

- `Review affected entities in Trace`

Behavior:

- opens `Trace`
- prefilters to riskiest entity or most severe open issue

#### Open risk

CTA:

- `Trace highest-risk entity`

Behavior:

- opens `Trace`
- anchor = top failed or warning entity
- direction = `Upstream`
- depth = `2`

#### Lineage coverage

CTA:

- `Open estate map`

Behavior:

- opens `Map`
- optionally highlights chains or layers with weak coverage

#### Column flows

CTA:

- if coverage exists: `Inspect evidence`
- if coverage is zero: `View coverage gap`

Behavior:

- with data: open `Columns`
- without data: stay in `Overview` or open `Columns` with an explanatory empty state

### Layer coverage panel

CTA:

- `Trace affected entity`

Behavior:

- each layer row should make it easy to jump into `Trace`
- if a layer has failures, the CTA should anchor the worst entity in that layer

Avoid:

- sending the user to `Map` by default for every layer question

### Chain readiness panel

CTA:

- `Open in Trace`

Behavior:

- clicking a chain should not mainly open the legacy `Chains` tab
- it should open `Trace` anchored on the most terminal or riskiest entity in that chain

### Riskiest entities panel

CTA:

- `Trace upstream`

Behavior:

- direct jump into `Trace`
- direction defaults to `Upstream`

### Top connected entities panel

CTA:

- `Trace impact`

Behavior:

- direct jump into `Trace`
- direction defaults to `Downstream` or `Both`

This makes `Overview` act as a launcher into one investigation model instead of forcing users to choose between different structural screens.

---

## 11.2 Recommended Role Of `Chains`

### Short-term role

`Chains` can remain in the product for now, but it should be demoted from "primary destination" to "supporting summary mode."

Good uses for `Chains` in the short term:

- quick chain completeness scans
- compact progress-by-layer review
- reading grouped lineage without a canvas

### Problems with keeping it equal-weight

- it duplicates chain summaries already present in `Overview`
- it duplicates node expansion logic already present in graph detail
- it competes with `Trace` for the investigation role

### Recommendation

#### Phase 1

- keep `Chains`, but stop routing to it from the main summary CTA paths

#### Phase 2

- move the strongest parts of `Chains` into:
  - `Overview` for summary
  - `Impact` for grouped list analysis

#### Phase 3

- either remove `Chains` as a top-level tab
- or fold it into `Trace` as a list-mode preset

This is especially justified on tenants like `Vdmeer Consulting`, where the main complexity is not chain completeness alone, but silver/gold branching and multi-upstream analysis.

---

## 11.3 Recommended Role Of `Columns`

### Product role

`Columns` should be treated as:

- technical evidence
- validation detail
- not the primary place to understand lineage structure

### UX consequence

It should remain accessible, but with less navigational weight than `Trace`.

### Coverage-aware behavior

On `Vdmeer Consulting`, `Columns` currently returns:

- `0` attribute flows

So the page should communicate evidence availability much earlier.

Recommended behavior:

- show a coverage badge in `Overview`
- show a muted tab badge when coverage is empty
- keep the empty state informative and non-punitive

### Recommended tab behavior

When the user comes from `Trace`, `Columns` should preserve context:

- selected entity
- possibly direction context
- targeted search

That keeps it as a supporting evidence step instead of a detached table destination.

### Empty-state guidance

When coverage is zero:

- say column lineage is not available for this tenant or sync state
- explain that entity and dataset lineage still remain valid
- offer return actions:
  - `Back to Trace`
  - `Open Map`

---

## 12. Recommended Changes To The Existing Tabs

### Overview

Keep. It already fits the dashboard-level summary role well.

But change its routing role:

- less emphasis on choosing between multiple structural tabs
- more emphasis on `Open in Trace`
- show coverage warnings when evidence surfaces like `Columns` are sparse or empty

### Graph

Rename and split:

- current `Graph` becomes `Map`
- add new `Trace`

### Chains

De-emphasize as a primary tab.

Possible options:

1. Keep temporarily, but position it as a supporting summary view.
2. Fold its most useful summary patterns into `Overview` and `Impact`.

Recommendation: keep in the short term, but the strategic direction should move away from `Chains` as a primary investigation mode.

### Columns

Keep. It remains the dense technical evidence surface.

But reposition it explicitly as:

- evidence detail
- not a peer to the main investigative entry point
- coverage-aware, especially on tenants where column lineage is absent or partial

---

## 12.1 Proposed `/lineage` Wireframe Model

### Page shell

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Lineage                                                            │
│ [Overview] [Trace] [Map] [Columns]                                 │
├─────────────────────────────────────────────────────────────────────┤
│ If Overview:                                                       │
│   KPI cards                                                        │
│   Layer coverage                                                   │
│   Chain readiness                                                  │
│   Riskiest / most connected entities                               │
│   Primary CTA everywhere: Open in Trace                            │
│                                                                    │
│ If Trace:                                                          │
│   Left rail: anchor, direction, depth, layers                      │
│   Center: bounded trace graph or list                              │
│   Right rail: selected entity detail + evidence CTA                │
│                                                                    │
│ If Map:                                                            │
│   compact read-only topology graph                                 │
│                                                                    │
│ If Columns:                                                        │
│   evidence table, coverage-aware empty state                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Trace sublayout

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Trace                                                              │
│ [Anchor entity........] [Upstream|Downstream|Both] [1|2|3|All]     │
│ [Landing][Raw][Bronze][Silver][Gold] [Graph|List]                  │
├───────────────┬──────────────────────────────────┬──────────────────┤
│ Controls      │ Trace canvas / impact list       │ Detail rail      │
│ recent anchors│ scope sentence                   │ status            │
│ saved context │ bounded graph                    │ source datasets   │
│               │                                  │ attr preview      │
│               │                                  │ open columns      │
└───────────────┴──────────────────────────────────┴──────────────────┘
```

---

## 13. Interaction Rules To Adopt

1. A click on a node selects it. It should not silently switch analytical mode.
2. Re-anchoring must be explicit.
3. Direction must be explicit.
4. Depth must be explicit.
5. Filters should reduce topology, not merely opacity, in Trace mode.
6. Layout reset and investigation reset must be separate actions.
7. The URL should encode the trace state:
   - `entity`
   - `direction`
   - `depth`
   - `layers`

8. `Overview` should route into `Trace` by default for entity- or chain-level follow-up.
9. `Columns` should preserve the current entity context whenever entered from `Trace`.
10. `Map` should favor orientation over control density.

---

## 14. Visual Design Guidance

### Tone

This page should feel like an operational analysis workspace, not a playground graph.

### Visual priorities

- strong anchor highlighting
- restrained canvas chrome
- clear layer lane labeling
- one primary action color
- status color used only for health semantics

### Avoid

- too many equal-weight pills in one toolbar
- heavy opacity states as main filtering mechanism
- draggable default behavior in investigative mode
- mixing "search everything" and "trace this entity" into one control cluster

---

## 15. Suggested Delivery Plan

### Phase 1

- Rename current graph tab to `Map`
- Reorder tabs to `Overview | Trace | Map | Columns`
- Add trace state model:
  - anchor
  - direction
  - depth
  - layer include set
- Add new `Trace` tab with deterministic subgraph rendering
- Update `Overview` CTAs to point primarily into `Trace`
- Remove persisted drag from `Trace`

### Phase 2

- Add `Graph/List` switch inside Trace
- Add URL-persisted trace state
- Split reset actions:
  - reset trace scope
  - reset visual layout
- Add coverage-aware `Columns` tab badge and empty-state routing
- Reduce or repurpose `Chains` routing

### Phase 3

- Add edge evidence panel
- Add run-centric drilldown from node/edge
- Add `Impact` tab if list mode grows beyond the Trace subview
- Reassess whether `Chains` still deserves a top-level tab

---

## 16. Files Most Likely Affected

- [web/src/app/(tenant)/(dashboard)/lineage/dashboard.tsx](/Users/leenvandermeer/Git/Latero%20Control/web/src/app/(tenant)/(dashboard)/lineage/dashboard.tsx)
- [web/src/app/(tenant)/(dashboard)/lineage/graph-view.tsx](/Users/leenvandermeer/Git/Latero%20Control/web/src/app/(tenant)/(dashboard)/lineage/graph-view.tsx)
- new proposed component: `trace-view.tsx`
- possible supporting component: `impact-list.tsx`
- [web/src/app/(tenant)/(dashboard)/lineage/entity-detail-panel.tsx](/Users/leenvandermeer/Git/Latero%20Control/web/src/app/(tenant)/(dashboard)/lineage/entity-detail-panel.tsx)

---

## 17. Final Recommendation

Latero should not keep iterating on the current graph as one increasingly complex all-purpose surface.

The better product move is:

- keep one simplified **Map** for orientation
- introduce one explicit **Trace** graph for investigation
- add one **Impact List** for exact analysis

That gives users a much more standard, market-aligned lineage UX while still preserving what is unique in Latero:

- layer-aware semantics
- operational status visibility
- progressive disclosure into evidence and columns
- cross-chain investigation where it actually matters
