# LADR-074 — Lineage default map with preserved advanced trace

**Date:** 2026-05-11  
**Status:** PROPOSED  
**Owner:** Latero Control product  
**Related:** [LADR-067](20260508-lineage-map-vs-trace-ux.md), [LADR-016](20260422-progressive-disclosure-dashboard-ux.md)

---

## Context

The `/lineage` experience already contains three powerful capabilities:

- a broad estate-wide lineage overview
- a focused trace workflow
- column-level evidence

In the previous UX, these appeared as three equal top-level tabs:

- `Overview`
- `Trace`
- `Columns`

This made the page hard to explain. New users encountered three competing
mental models at once, while experienced users still needed the full power of
Trace for investigation work.

The product goal is therefore not to remove capability, but to reduce cognitive
load in the default experience.

---

## Decision

Lineage adopts the following interaction model:

### 1. `Map` becomes the default mode

The former `Overview` mode is explicitly positioned as `Map`.

`Map` is the orientation surface:

- understand the current flow
- see hotspots and coverage
- discover likely investigation entry points

### 2. `Advanced Trace` is preserved in full

The former `Trace` mode remains fully available, but is now positioned as an
advanced investigation mode rather than a general-purpose default tab.

All existing trace capabilities remain:

- starting point selection
- direction
- hop depth
- layer inclusion
- graph/list display
- export and reset

### 3. `Column mappings` becomes a secondary investigation tool

Column-level lineage remains available, but it is positioned as a secondary
tool for evidence review rather than a peer to the default `Map` mode.

### 4. The lineage page must explain the current mode

The shell and in-page helper text must state what the active mode is for:

- `Map` explains current flow
- `Advanced Trace` explains focused investigation
- `Column mappings` explains attribute-level evidence

---

## Rationale

### Preserve capability without exposing all complexity by default

The strongest Trace functionality is valuable, but it should not define the
first impression of `/lineage`.

### Align with progressive disclosure

This decision continues the established Latero pattern:

- overview first
- investigation second
- evidence detail third

### Make lineage easier to explain

The new mental model is intentionally simple:

- `Map` for orientation
- `Advanced Trace` for deep investigation
- `Column mappings` for proof

---

## Consequences

### Positive

- simpler default story for `/lineage`
- full trace capability preserved
- clearer distinction between topology, investigation, and evidence

### Trade-offs

- advanced users take one extra explicit step into Trace
- some former tab symmetry is intentionally removed

---

## UX implications

- `Overview` user-facing copy is replaced by `Map`
- `Trace` user-facing copy becomes `Advanced Trace`
- `Columns` user-facing copy becomes `Column mappings`
- helper copy should guide users toward the right mode instead of presenting all
  modes as equally primary
