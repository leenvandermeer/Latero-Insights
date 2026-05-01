# Go-Live Checklist and Priorities (Multi-tenant Insights)

Date: 2026-04-25  
Scope: Production readiness gate after onboarding UX completion

## P0 (Blockers before first pilot customer)

- Security hardening
- Enforce admin-only guard on all `/api/v1/admin/*` routes.
- Confirm password reset actions are fully audited with actor, target user, and IP.
- Review session cookie settings (`HttpOnly`, `SameSite`, secure in production).
- Disable any debug-only credential exposure in production builds.

- Tenant isolation verification
- Verify read APIs always scope by active installation from session.
- Add regression tests for cross-tenant access denial.

- Reliability baseline
- Build and typecheck must pass in CI.
- Add smoke tests for login, switch-installation, onboarding, reset password.

- Operability minimum
- Add error tracking for admin APIs and onboarding pages.
- Define on-call owner and rollback steps.

## P1 (Required for stable scaling)

- Test coverage expansion
- Add integration tests for full onboarding lifecycle:
- create installation -> key share -> create user -> edit access -> reset password.
- Add negative-path tests for invalid tenant/user combinations.

- Observability
- Dashboard for onboarding KPIs (onboarding success/failure rate, admin errors, latency).
- Alerts for repeated admin route failures and auth anomalies.

- UX and support readiness
- Add inline admin help text for credential handling and reset procedures.
- Add operator runbook for common onboarding failures.

## P2 (Post-pilot hardening)

- Compliance and governance
- Retention policy for audit logs.
- Export and filter improvements for audit timeline.

- Product polish
- Bulk user actions (multi-user access update, bulk reset initiation).
- Richer onboarding wizard with step completion tracking.

## Release Gate (Go / No-Go)

Go only when all P0 items are checked and signed off by:

- Engineering lead (security + reliability)
- Product owner (UX flow acceptance)
- Operations owner (incident readiness)

## Evidence to attach at gate

- CI artifact for successful production build
- Test report for onboarding lifecycle
- Security checklist sign-off
- Monitoring + alert screenshots
- Rollback test notes
