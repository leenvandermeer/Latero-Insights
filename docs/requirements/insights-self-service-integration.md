# Latero Insights Self-Service Integration — Normative Requirements

Version: 1.0-draft
Status: DRAFT
Owner: Latero product
Date: 2026-04-24
ADR: [LADR-008](../decisions/20260424-self-service-insights-onboarding.md)

---

## Scope

This document defines normative requirements for reducing developer dependency when onboarding
Latero metadata to Latero Insights.

In scope:

- Managed onboarding lifecycle (`validate`, `plan`, `apply`, `verify`)
- Declarative integration manifest and schema validation
- Contract-tested consumer read model for Insights
- Operational readiness and runbook requirements

Out of scope:

- Demo repository structure as product contract
- UI design of Latero Insights pages
- Platform-specific implementation internals beyond adapter boundary

---

## LINS-SS — Self-service lifecycle

### LINS-SS-001 — Managed lifecycle commands

Latero must provide a managed lifecycle with four explicit phases:

- `validate`
- `plan`
- `apply`
- `verify`

Each phase must return machine-readable status and human-readable summary.

**Acceptance criteria:**
- Every phase can be invoked independently.
- `apply` is blocked when `validate` reports blocking errors.
- `verify` reports a deterministic pass/fail result.

---

### LINS-SS-002 — Dry-run and non-interactive support

The lifecycle must support:

- dry-run mode (`plan` without changes)
- non-interactive execution suitable for CI/CD

**Acceptance criteria:**
- Dry-run produces no DDL/job/provisioning side effects.
- Non-interactive mode returns non-zero exit code on blocking failures.

---

### LINS-SS-003 — Idempotent apply semantics

`apply` must be idempotent. Re-running with unchanged input must not create duplicate jobs,
resources, or schema artifacts.

**Acceptance criteria:**
- Two consecutive `apply` runs with same manifest produce no additional changes in the second run.
- `plan` after successful `apply` returns "no changes".

---

## LINS-MAN — Declarative manifest

### LINS-MAN-001 — Single integration manifest

Latero must define one product-owned manifest schema for Insights integration intent.

Minimum required keys:

- `installation_id`
- `environment`
- `adapter`
- `meta_target`
- `lineage_projector.enabled`

Optional keys include:

- `lineage_projector.schedule`
- `openmetadata_sync.enabled`
- `openmetadata_sync.service_name`
- `tags`

**Acceptance criteria:**
- Manifest schema is documented and versioned.
- Missing required keys fail `validate` with actionable errors.

---

### LINS-MAN-002 — Manifest versioning

The manifest must include `manifest_version`. Breaking schema changes require a version bump
and migration notes.

**Acceptance criteria:**
- Validator rejects unsupported manifest versions.
- Release notes document supported manifest versions per release.

---

## LINS-CON — Consumer contract

### LINS-CON-001 — Read model as primary consumer target

Latero Insights integrations must target:

- `meta.lineage_entities_current`
- `meta.lineage_attributes_current`

Direct dashboard logic on raw `meta.data_lineage` aggregation is allowed only for ad-hoc analysis,
not as the supported product integration path.

**Acceptance criteria:**
- Integration docs designate current-state tables as primary interface.
- Product examples for Insights use the two current-state tables.

---

### LINS-CON-002 — Contract tests for integration-critical changes

Changes that impact lineage read-model semantics must include contract tests covering:

- status semantics (`SUCCESS`, `PARTIAL`, `FAILED`, `IN_PROGRESS`, `STALE`)
- `hop_kind` filtering semantics (`data_flow` plus historical `NULL`)
- layer progression consistency

**Acceptance criteria:**
- CI fails when contract tests fail.
- Contract test fixtures are versioned and reproducible.

---

### LINS-CON-003 — Compatibility and deprecation policy

Latero must publish compatibility guarantees for Insights integration contracts.

**Acceptance criteria:**
- Backward-compatible changes follow minor/patch release policy.
- Breaking changes include deprecation window and migration guide.

---

## LINS-OPS — Operational readiness

### LINS-OPS-001 — Preflight checks

`validate` must include preflight checks for:

- required meta tables and columns
- migration prerequisites
- job/workspace permissions
- secret availability when optional sync is enabled

**Acceptance criteria:**
- Failures identify missing capability and remediation hint.
- Output includes blocking vs non-blocking classification.

---

### LINS-OPS-002 — Drift detection

Latero must detect drift between desired manifest and deployed integration state for managed
artifacts (jobs/schedules/config refs).

**Acceptance criteria:**
- `plan` reports drift as add/change/remove actions.
- Drift output is stable and machine-readable.

---

### LINS-OPS-003 — Runbook and ownership model

Latero product docs must include operator runbooks and ownership boundaries for self-service
onboarding and upgrades.

**Acceptance criteria:**
- Runbook includes incident paths for failed projector and failed sync.
- Ownership model identifies product owner vs platform operator responsibilities.

---

## References

- Meta table contract (`meta-table-contract.md`)
- Insights lineage integration guide (`../latero-insights-lineage-integration.md`)
- LADR-005 (`../decisions/20260421-lineage-current-state-projection.md`)
- LADR-008 (`../decisions/20260424-self-service-insights-onboarding.md`)
