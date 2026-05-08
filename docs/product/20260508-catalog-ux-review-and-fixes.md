# Catalog UX Review And Fixes

Date: 2026-05-08
Scope: `/catalog`
Tenant context: `Vdmeer Consulting`

## Review Summary

The catalog experience was functional, but not yet product-grade in four critical areas:

1. The `Datasets` view presented an incomplete estate model because the UI and API only exposed `landing`, `raw`, and `bronze`, while the product clearly operates across `silver` and `gold` as well.
2. `Entities` and `Datasets` were browse-only tables with no primary drill-in action, which made them dead ends inside the product flow.
3. Catalog navigation and filters were local-only state, so the page could not be reliably shared, bookmarked, or restored.
4. Data product composition did not scale well because entity selection was a flat multi-select without search.

## Implemented Fixes

### 1. URL-backed catalog state

The catalog now persists the active tab and relevant filters in the URL:

- `tab`
- `entity_q`
- `dataset_q`
- `dataset_layer`

This makes the catalog state shareable and recoverable.

### 2. Full dataset layer coverage

The `Datasets` API and tab now include all supported layers:

- `landing`
- `raw`
- `bronze`
- `silver`
- `gold`

This removes the previous mismatch between catalog UX and Latero’s actual layer model.

### 3. Drill-in from catalog rows

`Entities` and `Datasets` now expose a direct `Open Trace` action per row.

This creates a clear path from catalog discovery into lineage investigation instead of leaving users in a static browse table.

### 4. Better product composition UX

The data product slide-over now supports searching inside the entity picker.

This is still lightweight, but it is materially better than a flat unchecked list once the entity count grows.

## Remaining Gaps

The following items were identified during review but were not part of this implementation slice:

1. Catalog still lacks a true overview landing with counts, ownership gaps, stale assets, and “needs attention” entry points.
2. `Entities` and `Datasets` still use plain tabular browse patterns rather than richer asset detail surfaces.
3. Data product cards still rely on a relatively light action model and can be improved further for touch-first discoverability.
4. Search is now URL-backed, but server-facing browse/search can still be improved later with stronger facet patterns and larger-estate ergonomics.

## Recommended Next Step

The next iteration should turn `/catalog` from a tabbed browse page into a real catalog home:

- overview first
- asset-class drill-in second
- asset detail surface third
- lineage, quality, and ownership as connected actions rather than separate destinations
