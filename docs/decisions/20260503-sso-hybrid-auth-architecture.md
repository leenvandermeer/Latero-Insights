# LADR-034 — SSO-first hybrid authentication with installation-scoped policy

**Date:** 2026-05-03  
**Status:** ACCEPTED  
**Decision:** Latero Control will implement installation-scoped enterprise SSO via OIDC Authorization Code Flow with PKCE, bridged to the existing internal Postgres session model, with a tightly controlled local-account fallback.

## Context

Latero Control already has:

- server-side session authentication with hashed session tokens in Postgres
- installation-scoped tenant access based on `active_installation_id`
- admin role verification on top of the shared session model
- strict security requirements around cross-tenant isolation

That model is suitable for local login and operational security, but it does
not yet support enterprise SaaS expectations such as:

- centralized identity lifecycle management
- federated sign-in with enterprise IdPs
- group-based access policy enforcement
- controlled offboarding outside the application itself

At the same time, a pure “SSO only, no local credentials whatsoever” model is
operationally brittle for bootstrap, outage recovery, and local test/dev flows.

## Problem

We need to add enterprise SSO without weakening existing tenant isolation or
creating a second uncontrolled authentication subsystem.

Specific risks to avoid:

- browser-side storage of IdP tokens
- cross-tenant access caused by loose email-based identity matching
- local password login remaining unintentionally enabled for enterprise tenants
- admin privilege escalation through external tenant claims
- non-realistic local testing that misses cookie, TLS, or redirect issues

## Decision

Latero Control adopts a **SSO-first hybrid authentication model**:

1. **OIDC only in the application**
   - Latero Control supports `OIDC Authorization Code Flow + PKCE`
   - The app does not implement SAML directly
   - If a customer only supports SAML, translation to OIDC belongs in an IdP or broker layer outside the app

2. **Session bridging**
   - OIDC callback handling is fully server-side
   - A successful federated login results in a new internal Latero session
   - The Latero session remains the only browser-visible application session

3. **Installation-scoped auth policy**
   - Each installation defines its own auth mode and SSO configuration
   - Supported modes:
     - `sso_only`
     - `sso_with_break_glass`
     - `sso_with_local_fallback`
     - `local_only`

4. **Controlled local fallback**
   - Local email/password login remains available only where the installation policy allows it
   - For enterprise SaaS tenants, the recommended default is `sso_with_break_glass`

5. **Identity binding by `issuer + subject`**
   - External identities are linked using the IdP issuer and subject
   - Email alone must never be used as the primary account-linking key

6. **Installation-scoped provisioning and role mapping**
   - JIT provisioning is optional and deny-by-default
   - Role mapping from IdP claims is installation-scoped
   - Admin elevation requires explicit internal policy and cannot be granted by arbitrary tenant claims

## Security Controls

### OIDC flow integrity

- `state` is mandatory and validated on callback
- `nonce` is mandatory and validated against the ID token
- `PKCE (S256)` is mandatory
- issuer, audience, expiry, and related token claims are validated server-side

### Session and cookie handling

- Latero continues to store only hashed internal session tokens in Postgres
- Browser receives only an `HttpOnly` cookie
- Production deployment must use `Secure` cookies
- Host-bound cookie naming should be preferred where deployment constraints allow it

### CSRF protection

- OIDC callback protection uses `state`
- Separate CSRF protection is required for mutating cookie-auth endpoints such as:
  - logout
  - installation switch
  - settings updates
  - auth-policy changes

### Secrets handling

- OIDC client secrets are not stored in `.cache/settings.json`
- Secrets must come from environment files, secret mounts, or equivalent operator-managed secret storage

### Auditability

The system must log:

- SSO login success/failure
- callback validation failures
- provisioning outcomes
- local fallback login success/failure
- logout and session revocation
- installation switch
- auth configuration and policy changes

The system must not log:

- raw access tokens
- raw refresh tokens
- full unfiltered claims payloads

## Consequences

### Positive

- One consistent application session model for both local and federated auth
- Enterprise-ready SSO without exposing IdP tokens to the browser
- Better operational resilience through controlled break-glass access
- Installation-scoped auth aligns with existing tenant isolation rules
- Realistic local testability through a dedicated Docker SSO stack

### Trade-offs

- More configuration complexity per installation
- Additional policy logic around local fallback and provisioning
- Local auth UX becomes conditional instead of globally uniform
- Requires dedicated test coverage for both auth paths

## Implementation Notes

Primary implementation areas:

- `web/src/lib/session-auth.ts`
- new OIDC/auth policy helpers under `web/src/lib/`
- `web/src/app/api/auth/*`
- installation-scoped auth config storage and admin management flows
- Docker-based local IdP and TLS setup under `infra/docker/`

## Validation Criteria

The decision is considered correctly implemented when:

- enterprise users can authenticate via OIDC and land in a valid Latero session
- no IdP token is stored in browser-accessible storage
- `sso_only` installations reject standard local password login
- `sso_with_break_glass` installations allow only explicit local emergency access
- cross-tenant access through auth or provisioning bugs is blocked
- local HTTPS Docker SSO testing is reproducible for the team

## References

- [LADR-029 — Tenant Data Isolation Security Hardening](20260425-tenant-data-isolation-security-hardening.md)
- [LADR-028 — Admin Dashboard Architecture](20260425-admin-dashboard-architecture.md)
- [SSO and Local Authentication Feature](../requirements/sso-auth-feature.md)
- [SSO and Hybrid Auth Work Packages](../requirements/sso-auth-workpackages.md)
