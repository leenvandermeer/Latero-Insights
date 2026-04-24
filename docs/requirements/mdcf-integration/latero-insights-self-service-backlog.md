# Latero Insights Self-Service Integration Backlog

Status: Draft delivery backlog
Owner: Latero product
Date: 2026-04-24
Related ADR: [LADR-008](decisions/20260424-self-service-insights-onboarding.md)
Related requirements: [Insights self-service integration](requirements/insights-self-service-integration.md)

---

## Goal

Reduce developer dependency for onboarding/upgrading Latero Insights integrations by delivering
self-service lifecycle tooling, declarative configuration, contract testing, and runbooks.

---

## Epic 1 — Managed onboarding lifecycle

### Story E1-S1 — Implement lifecycle command surface

As a platform operator, I can run `validate`, `plan`, `apply`, and `verify` so that onboarding
is executable without ad-hoc scripts.

**Acceptance criteria:**
- Commands exist with consistent input/output contract.
- Exit codes are deterministic for CI/CD.

### Story E1-S2 — Add dry-run and non-interactive modes

As a release pipeline, I can execute dry-run and non-interactive flows to safely gate deployments.

**Acceptance criteria:**
- Dry-run has zero side effects.
- Non-interactive mode fails fast on blocking errors.

### Story E1-S3 — Ensure idempotent apply

As an operator, I can rerun `apply` safely without duplicating jobs/resources.

**Acceptance criteria:**
- Repeated runs produce no duplicate managed artifacts.

---

## Epic 2 — Declarative integration manifest

### Story E2-S1 — Define manifest schema v1

As a config owner, I have one versioned manifest with required and optional keys.

**Acceptance criteria:**
- JSON/YAML schema published.
- Required keys validated with actionable error messages.

### Story E2-S2 — Manifest compatibility policy

As a release manager, I can reason about supported manifest versions per product release.

**Acceptance criteria:**
- Manifest compatibility table included in release notes.
- Unsupported versions fail validation with migration hint.

---

## Epic 3 — Consumer contract hardening

### Story E3-S1 — Formalize read-model contract for Insights

As an Insights integrator, I target `lineage_entities_current` and `lineage_attributes_current`
with stable semantics.

**Acceptance criteria:**
- Integration guide references read-model as primary path.
- Raw-table aggregation explicitly marked as non-primary path.

### Story E3-S2 — Add contract tests for integration-critical semantics

As a maintainer, I prevent regressions in status, hop filtering, and layer progression behavior.

**Acceptance criteria:**
- CI contract tests cover status semantics and `hop_kind` compatibility behavior.
- Failing contract tests block merges.

---

## Epic 4 — Operational readiness

### Story E4-S1 — Preflight checks

As an operator, I know before apply whether permissions, tables, columns, and secrets are ready.

**Acceptance criteria:**
- `validate` output classifies blocking and non-blocking findings.

### Story E4-S2 — Drift detection

As a platform team, I can detect when deployed jobs/schedules diverge from manifest intent.

**Acceptance criteria:**
- `plan` output contains add/change/remove action list.

### Story E4-S3 — Runbooks and ownership model

As an operations team, I can recover from projector/sync failures without developer handholding.

**Acceptance criteria:**
- Runbooks published with clear RACI and recovery procedures.

---

## Suggested 30/60/90 sequence

### Day 0-30

- Deliver Epic 1 (E1-S1, E1-S2) and Epic 2 (E2-S1).
- Publish minimum manifest schema and validation errors.

### Day 31-60

- Deliver E1-S3, E2-S2, E3-S1.
- Integrate lifecycle flow in CI/CD gating.

### Day 61-90

- Deliver E3-S2, E4-S1, E4-S2, E4-S3.
- Complete contract tests, drift detection, and operator runbooks.

---

## Definition of Done (program level)

- A new environment can be onboarded with manifest + lifecycle commands only.
- No manual SQL/job wiring is required for the standard path.
- Contract tests protect Insights-facing semantics in CI.
- Runbooks enable operations team ownership for day-2 support.
