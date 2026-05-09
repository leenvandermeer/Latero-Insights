# Issues Register Concept

## Why

Latero should not become a generic ITSM tool. The value is not in logging every operational incident, but in tracking trust-relevant data issues that affect product confidence, evidence, and remediation.

## Positioning

Recommended UI language:

- `Issues` instead of `Incidents`
- `Issue register` instead of `incident queue`

This keeps the scope focused on data trust operations.

## Issue Types

### Detected

Automatically raised from platform signals such as:

- failed quality checks
- policy violations
- freshness breaches
- missing evidence or broken lineage

### Reported

Manually raised by operators or business users when a data product cannot be trusted, even if no automatic rule fired yet.

### Exception

Accepted deviation or temporary waiver that still needs visibility, ownership, and expiry.

## CRUD Operators

The register should support both automatic and manual lifecycle operations.

### Create

- auto-create from rules and checks
- manual create by operators

### Read

- list by product, severity, status, type
- open detail with evidence and remediation trail

### Update

- move from `open` to `in progress` to `resolved`
- change severity
- assign owner
- attach remediation notes and evidence

### Delete

Delete should remain rare and operator-controlled. In most cases, `resolved` is better than delete for auditability.

## UX Pattern

The issue register should behave like a trust operations surface:

- compact summary cards
- filters for status and issue type
- clearly separated machine-detected vs human-reported entries
- fast manual create flow
- explicit ownership and next-step actions

## Implementation Direction

Phase 1 can reuse the current incidents backend and reframe the UI as `Issues`:

- rename navigation and page copy
- expose `source_type`
- allow manual `Reported issue` creation
- distinguish detected vs reported in the list

Phase 2 can evolve the model toward:

- exception records
- due dates / expiry
- remediation evidence
- auto-generated issues from policy and trust score gaps

## Alerts Position

`Alerts` should not remain a separate primary module unless Latero offers a clearly differentiated alerting experience. In the current product direction, alerts are better treated as:

- internal machine signals
- routing inputs
- optional sources for auto-created issues

Recommended UX choice:

- remove `Alerts` from the main navigation
- remove the `/alerts` page entirely
- keep the alert engine as supporting infrastructure, not as a first-class operator destination
