# LADR-017 — Dataset-First Titling in Lineage and Job-Name-First OpenLineage Labels

**Date:** 2026-04-22
**Status:** ACCEPTED
**Owner:** Tech Lead
**Related:** [LADR-015](20260420-lineage-entity-model-redesign.md), [LADR-016](20260422-progressive-disclosure-dashboard-ux.md)

---

## Context

In the lineage UX, users reported that chain labels and chain-readiness content
were not understandable because technical grouping identifiers were shown as
primary labels. The same pattern appeared in OpenLineage cards where `run_id`
was shown as the main title, while users reason about jobs and datasets.

This created a mismatch between:

- how stewards and engineers investigate impact (dataset/job first), and
- what the UI emphasized (technical IDs first).

---

## Decision

### 1. Lineage labels are dataset-first

- In `Chains` and `Overview > Chain readiness`, the visible title MUST be based
  on a dataset-derived name from `entity_fqn`.
- Technical IDs (`lineage_group_id` and derived chain keys) MAY remain available
  as secondary diagnostics, but MUST NOT be the primary title.

### 2. OpenLineage labels are job-name-first

- In OpenLineage run cards and JSON drawer headers, the primary label MUST be
  `job_name`.
- `run_id` remains visible as secondary traceability metadata.
- `job.name` in exported OpenLineage JSON MUST align with the same `job_name`
  shown in the UI.

### 3. Search behavior follows primary mental model

- OpenLineage search MUST include `job_name` in addition to run ID and dataset
  fields.

---

## Consequences

- Readability improves for non-technical stakeholders because dataset/job names
  are immediately visible.
- Technical debugging remains possible by preserving secondary identifiers.
- This aligns with progressive disclosure: business label first, technical ID
  on demand.

---

## Implementation Notes

Applied in:

- `src/app/(dashboard)/lineage/chains-view.tsx`
  - chain titles derived from dataset keys instead of technical group IDs.
- `src/app/(dashboard)/lineage/overview-view.tsx`
  - chain readiness content uses dataset-first wording and grouping.
- `src/app/(dashboard)/lineage/entity-detail-panel.tsx`
  - dataset chain shown as primary; technical chain ID shown as secondary info.
- `src/app/(dashboard)/openlineage/dashboard.tsx`
  - `job_name` added to run-event model and search.
- `src/app/(dashboard)/openlineage/run-event-card.tsx`
  - card title switched to `job_name`; `run_id` shown as secondary badge.
- `src/app/(dashboard)/openlineage/json-drawer.tsx`
  - drawer title switched to `job_name`; JSON `job.name` aligned.

---

## Requirement Impact

- Clarifies LINS-022 and LINS-023 UX behavior as dataset-first for lineage
  investigation.
- Keeps traceability requirements intact by preserving run identifiers.
