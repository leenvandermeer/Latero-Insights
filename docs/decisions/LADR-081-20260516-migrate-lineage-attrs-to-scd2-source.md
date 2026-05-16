# LADR-081 — Lineage attribute queries migrate from projected table to SCD2 source

**Date:** 2026-05-16
**Status:** Accepted
**Relates to:** LADR-014 (SCD2 for lineage meta tables), LADR-079 (stable entity guid)

---

## Context

`DatabricksAdapter.getLineageAttributes()` read from `meta.lineage_attributes_current`, a
table projected by the `lineage_projector` Databricks job in the MDCF reference environment.
That job was introduced (LADR-005) because the append-only event log required expensive window
functions to derive current state.

LADR-014 added `valid_from`, `valid_to`, and `is_current` columns to `meta.lineage_attribute`
(the SCD2 attribute events table) at write time. With this change, `meta.lineage_attribute
WHERE is_current = true` is semantically equivalent to `meta.lineage_attributes_current`.

The MDCF projector job is being removed (LADR-017). The projected tables are no longer part
of the Latero meta-table contract. Latero Control must read from the SCD2 source directly.

`meta.lineage_entities_current` was already unused in Control — entity current-state is served
from Postgres `meta.datasets` (LADR-079).

---

## Decision

Rewrite `DatabricksAdapter.getLineageAttributes()` to read from `meta.lineage_attribute`
with `is_current = true`. This aligns it with `getLineageAttributeHistory()`, which already
reads from `meta.lineage_attribute` for all SCD2 versions.

Remove `lineage_entities_current` and `lineage_attributes_current` from
`LineageSchemaInventory`. Update `getLineageSchemaInventory()` to describe `lineage_attribute`
instead.

---

## Consequences

- `getLineageAttributes()` no longer depends on the projected table.
- `getLineageAttributeHistory()` fallback (calls `getLineageAttributes()`) continues to work
  correctly since both now read the same source table.
- `LineageSchemaInventory.lineage_entities_current` and `.lineage_attributes_current` removed;
  `lineage_attribute` added.
- `provenance` field on `LineageAttribute` changes from `"lineage_attributes_current"` to
  `"lineage_attribute"`.
- Existing instances that still have `meta.lineage_attributes_current` as a stale table are
  unaffected — Control no longer queries it.
