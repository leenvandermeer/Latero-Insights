# LADR-067 — Lineage UX split: Map for topology, Trace for investigation

**Date:** 2026-05-08  
**Status:** PROPOSED  
**Owner:** Latero Control product  
**Related:** [LADR-015](20260420-lineage-entity-model-redesign.md), [LADR-016](20260422-progressive-disclosure-dashboard-ux.md), [LADR-022](20260424-lineage-graph-entity-labels-and-dataset-focus.md), [LADR-066](20260507-lineage-entity-focus-and-cross-chain-upstream.md)

---

## Context

The current `/lineage` graph has evolved incrementally:

- first as a broad lineage graph
- then with dataset focus
- then with entity focus
- then with upstream/downstream viewpoint tracing

This solved several correctness issues, but it also made one screen carry too many jobs:

1. estate topology scanning
2. focused entity investigation
3. upstream and downstream impact tracing
4. detail inspection
5. search and filter operations

In the current implementation, graph meaning is determined by a combination of:

- `entityFocus`
- `selectedNodeId`
- `viewMode`
- layer/status/search filters
- opacity-based highlight logic

This makes the screen powerful but cognitively unstable. The user does not always have one clear answer to:

> "What exactly is this graph currently showing me?"

### Tenant validation on real data

This issue is visible on the active `Vdmeer Consulting` tenant (`prod_ko5o09uj9`):

- `47` lineage entities
- `9` landing
- `9` raw
- `9` bronze
- `12` silver
- `8` gold

Observed patterns in this tenant:

- simple linear chains in `landing → raw → bronze`
- fan-out from bronze to multiple silver entities
- fan-out from silver to multiple gold entities
- several gold entities with multiple upstream silver inputs

Examples:

- `gold_gemeente_esg_score` has `3` upstream silver dependencies
- `gold_duurzame_energie` has `4` upstream silver references
- `silver_klimaatindicator` fans out to `3` gold entities
- `silver_energielabel` fans out to `2` gold entities

These are not "just graph" scenarios. They are investigation scenarios:

- what feeds this gold entity?
- what is affected by this silver entity?
- show me only one or two hops
- show me only bronze/silver/gold

The current graph can technically answer those questions, but not through a stable, standard interaction model.

---

## Decision

The lineage experience will split the current graph intent into two distinct UX modes:

### 1. `Map` mode

`Map` is the topology and orientation surface.

It is used to:

- scan the estate
- identify hotspots
- inspect layer coverage
- open a node into a deeper investigation flow

Characteristics:

- compact lane-based graph
- minimal filters
- node selection opens a detail rail
- primary action is `Open in Trace`
- no investigation-specific depth or direction controls

### 2. `Trace` mode

`Trace` is the entity-centered investigation surface.

It is used to:

- select one anchor entity
- trace upstream, downstream, or both
- limit visible scope by hop depth
- limit visible scope by layer
- inspect impact and root cause without relying on a full estate graph

Primary controls:

- `Anchor entity`
- `Direction`: `Upstream | Downstream | Both`
- `Depth`: `1 | 2 | 3 | All`
- `Layers`: `Landing | Raw | Bronze | Silver | Gold`

Behavior:

- selecting a node inspects it
- re-anchoring is explicit
- direction is explicit
- depth is explicit
- filtering restructures the subgraph rather than only dimming unrelated nodes

### 3. `Trace` gets a complementary list/report surface

Trace is not graph-only.

Inside `Trace`, users must be able to switch between:

- `Graph`
- `List`

The list view is used for precise impact analysis and should include:

- related entity
- layer
- direction
- hop distance
- latest status
- latest success

### 4. Current `Graph` tab becomes `Map`

The current `Graph` tab will be renamed to `Map`.

### 5. New `Trace` tab is added

The new `Trace` tab becomes the recommended route for analysis starting from a selected entity.

---

## Rationale

### A. This matches the real user task better

Users investigating lineage usually start from one entity, not from the whole estate.

The requested behavior is explicit and bounded:

- select a silver entity
- show only first or second hop
- isolate bronze/silver/gold

That is better served by a trace workspace than by a generalized graph canvas.

### B. This is more aligned with market-standard lineage UX

Across Databricks, Atlan, Collibra, and Alation, the common pattern is:

- asset-first exploration
- explicit direction
- explicit depth
- graph plus complementary detail/reporting surfaces

Latero should align with those patterns while preserving its layer-aware semantics.

### C. This preserves progressive disclosure

The split remains consistent with [LADR-016](20260422-progressive-disclosure-dashboard-ux.md):

- `Map` gives overview
- `Trace` gives contextual focused investigation
- `Columns` remains the dense technical detail surface

### D. This is a cleaner continuation of LADR-066

LADR-066 correctly moved from dataset focus to entity focus and improved cross-chain upstream visibility.

This decision builds on that work, but clarifies that entity focus alone is not enough. The UX model must also distinguish:

- orientation
- investigation

---

## Consequences

### Product consequences

- `/lineage` gains a clearer information architecture
- `Trace` becomes the recommended investigation workflow
- `Chains` becomes less central as a primary investigation surface

### UX consequences

- users can understand graph scope faster
- entity selection becomes the explicit investigation anchor
- direction and hop depth become visible state instead of hidden behavior
- graph state becomes more shareable and easier to explain

### Technical consequences

The lineage state model will need to distinguish:

- map scope
- trace anchor
- trace direction
- trace depth
- trace included layers
- trace display mode (`graph | list`)

Likely implementation shape:

- keep `graph-view.tsx` as the basis for `Map`
- add a new `trace-view.tsx`
- reuse `entity-detail-panel.tsx` with trace-specific actions
- add a derived subgraph builder for hop-bounded traversal

---

## Implementation Guidance

### Phase 1

- rename current `Graph` tab to `Map`
- add a new `Trace` tab
- implement anchor/direction/depth/layer state
- render a bounded subgraph around the anchor

### Phase 2

- add `Graph | List` switch inside `Trace`
- encode trace state in URL query params
- separate `Reset scope` from `Reset layout`

### Phase 3

- add edge evidence
- add run-centric drilldown from selected node/edge
- reassess whether `Chains` remains a top-level tab

---

## Explicit Non-Goals

This decision does not:

- remove `Columns`
- change lineage data semantics
- replace layer-aware lanes in the graph
- solve run-centric drilldown in the same change

