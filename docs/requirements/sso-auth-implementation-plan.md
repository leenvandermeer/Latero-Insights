# SSO Authentication Implementation Plan

Status: Draft  
Owner: Engineering  
Date: 2026-05-03

## Purpose

This document translates the SSO work packages into concrete implementation
changes across SQL, API routes, libraries, admin surfaces, and Docker assets.

It is intentionally technical and file-oriented so engineering can use it as a
build sheet during execution.

## Guiding implementation rules

- Reuse the existing Latero session model as the only application session
- Keep all external IdP handling server-side
- Make auth configuration installation-scoped
- Do not store OIDC client secrets in `.cache/settings.json`
- Preserve tenant isolation by always resolving access through
  `active_installation_id`

## Proposed schema changes

### New SQL init file

Add a new bootstrap/migration file:

- `infra/sql/init/007_sso_auth.sql`

Recommended contents:

1. `insights_installation_auth_config`
   - installation-scoped auth mode and OIDC configuration metadata
   - fields such as:
     - `installation_id`
     - `auth_mode`
     - `oidc_enabled`
     - `oidc_issuer`
     - `oidc_client_id`
     - `oidc_discovery_url`
     - `oidc_post_logout_redirect_uri`
     - `allowed_email_domains` as `JSONB`
     - `allowed_groups` as `JSONB`
     - `role_mapping` as `JSONB`
     - `jit_provisioning_enabled`
     - timestamps

2. `insights_external_identities`
   - external identity linkage
   - fields such as:
     - `identity_id`
     - `user_id`
     - `installation_id`
     - `issuer`
     - `subject`
     - `email`
     - `claims_snapshot` optional and minimized
     - `last_authenticated_at`
     - timestamps
   - unique constraint on `(issuer, subject, installation_id)` or, if identity
     is globally unique in policy, `(issuer, subject)`

3. `insights_users` extensions
   - add optional flags for:
     - `is_break_glass`
     - `local_login_enabled`
     - `last_local_login_at`

4. `insights_sessions` extensions
   - add optional auth metadata:
     - `auth_method`
     - `identity_provider`
     - `external_subject`
     - `authenticated_at`

5. auth audit table or extension
   - either extend existing audit storage or add dedicated auth-event storage
   - must support login, logout, callback failure, provisioning and policy
     change events

## Library/module changes

### `web/src/lib/session-auth.ts`

Keep this as the internal session authority, but extend it to:

- populate additional auth metadata in sessions
- support session creation from `local` and `oidc`
- expose helpers for:
  - `createSessionFromOidcIdentity(...)`
  - `revokeSession(...)`
  - auth-method-aware audit hooks

Do not remove the existing local login capabilities here; policy checks should
decide whether they are allowed.

### New file: `web/src/lib/oidc.ts`

Add an OIDC helper module responsible for:

- discovery document loading
- authorization URL construction
- PKCE verifier/challenge generation
- callback code exchange
- JWKS-based ID token validation
- logout URL generation if provider supports it

This file should not create app sessions directly; it should return validated
identity information to higher-level auth services.

### New file: `web/src/lib/auth-policy.ts`

Responsibilities:

- read installation auth policy
- determine whether local login is allowed
- determine whether SSO is required
- evaluate JIT provisioning policy
- evaluate break-glass eligibility

### New file: `web/src/lib/external-identity.ts`

Responsibilities:

- lookup by `issuer + subject`
- link external identities to local users
- enforce installation-scoped matching
- optionally create local users through controlled JIT provisioning

### New file: `web/src/lib/auth-audit.ts`

Responsibilities:

- record auth-specific events
- redact sensitive values
- unify local and federated auth event logging

## API route changes

### Existing route: `web/src/app/api/auth/login/route.ts`

Keep as local login endpoint, but add:

- installation-aware auth policy check before password validation
- deny local login when installation mode is `sso_only`
- allow only break-glass accounts when installation mode is
  `sso_with_break_glass`
- auth audit event emission on success/failure

### Existing route: `web/src/app/api/auth/logout/route.ts`

Extend to:

- revoke local session
- clear cookie
- optionally return IdP logout redirect target when current session came from
  OIDC
- emit auth audit event

### Existing route: `web/src/app/api/auth/session/route.ts`

Extend response with safe session metadata if needed:

- `auth_method`
- whether current installation is `sso_only`
- whether local login is available for the current context

Do not expose sensitive IdP internals.

### New route: `web/src/app/api/auth/sso/start/route.ts`

Responsibilities:

- determine target installation
- load installation SSO config
- generate `state`, `nonce`, `code_verifier`
- set short-lived server-side correlation storage or secure cookies
- redirect to IdP authorize endpoint

### New route: `web/src/app/api/auth/sso/callback/route.ts`

Responsibilities:

- validate state and PKCE flow
- exchange code for tokens server-side
- validate ID token and claims
- resolve or provision local user
- create Latero session
- redirect to allowed app target
- emit auth audit events

### New route: `web/src/app/api/auth/sso/logout/route.ts`

Responsibilities:

- perform RP-initiated logout where supported
- coordinate local logout and IdP logout

### Existing route: `web/src/app/api/auth/switch-installation/route.ts`

Harden with:

- explicit CSRF protection
- auth audit event for installation switch
- optional membership revalidation if SSO-backed role mapping is dynamic

## Admin/API management changes

### Existing admin installation routes

Update:

- `web/src/app/api/v1/admin/installations/route.ts`
- `web/src/app/api/v1/admin/installations/[installation_id]/route.ts`

To support:

- auth mode configuration
- non-secret SSO metadata retrieval
- secure secret write-only update flow

### New admin auth config endpoints

Suggested routes:

- `web/src/app/api/v1/admin/installations/[installation_id]/auth/route.ts`
- `web/src/app/api/v1/admin/installations/[installation_id]/auth/test/route.ts`

Responsibilities:

- read/update installation auth policy
- validate issuer/discovery configuration
- test provider connectivity safely

## UI changes

### Login UX

Potential file areas:

- login page/component files under `web/src/app/`
- shared auth UI components under `web/src/components/`

Changes:

- show SSO entrypoint for installations with SSO enabled
- show local login only when policy permits
- show clear tenant/admin intent
- make one auth path visually primary per installation policy
- show installation-aware explanatory text
- keep break-glass access visually secondary
- keep error messages generic for authentication failures

Recommended UX states:

- default login
- redirecting to IdP
- callback processing
- unauthorized after successful authentication
- local login disabled by policy
- break-glass only information state

### Admin UX

Potential file areas:

- `web/src/app/admin/`
- `web/src/components/admin/`
- `web/src/hooks/use-admin.ts` and related hooks

Changes:

- installation auth settings form
- toggle auth mode
- configure issuer/client settings
- manage allowed domains/groups and role mapping
- test SSO connection flow
- show impact guidance when switching between `local_only`, `sso_only`,
  `sso_with_break_glass`, and `sso_with_local_fallback`
- add confirmation UX for restrictive mode changes

Recommended admin UX states:

- untouched
- dirty
- validating provider config
- validation success/failure
- save success/failure

## Middleware and security changes

### `web/src/middleware.ts`

Review and tighten behavior around:

- unauthenticated access to new SSO routes
- any assumptions about `localhost` vs HTTPS
- optional API-key bypass paths unrelated to UI auth

This file should not implement the whole auth system, but it must not interfere
with OIDC redirects or callback handling.

### CSRF protections

Add or extend a helper for CSRF on cookie-auth mutations.

Likely impact areas:

- logout
- switch installation
- settings writes
- admin auth config writes

## Settings and secret storage

### `web/src/lib/settings.ts`

Do not store OIDC client secrets here if this module still persists plaintext
runtime settings.

Instead:

- keep only non-secret installation metadata in app-managed config if needed
- read secrets from environment or secret-mounted files
- document the operator workflow clearly

## Docker and local test stack

### New/updated infra files

Suggested additions:

- `infra/docker/docker-compose.sso.yml`
- `infra/docker/Caddyfile.sso`
- `infra/docker/keycloak/realm-export.json`
- `infra/docker/.env.sso.example`

Responsibilities:

- run app, postgres, redis and keycloak together
- expose HTTPS hostnames for both app and IdP
- preconfigure test realm, clients, groups and users

### Existing infra docs

Update:

- `infra/README.md`
- `web/README.md`

To document:

- how to start the SSO stack
- local hostnames required
- seed users and installations
- expected test flows

## Test plan by layer

### Unit/service tests

- auth policy evaluation
- PKCE/state/nonce helpers
- external identity matching rules
- role mapping evaluation

### Route/integration tests

- local login allowed/blocked by policy
- OIDC callback success
- OIDC callback failure on invalid state
- OIDC callback failure on wrong issuer/audience
- logout and revocation behavior
- installation switch after SSO login
- unauthorized-after-login UX state
- break-glass visibility rules by auth mode

### Security regression tests

- cross-tenant identity mismatch
- break-glass only restriction
- local login blocked for `sso_only`
- no browser-side token persistence

## Recommended implementation order

1. Add ADR and schema design
2. Add SQL file `007_sso_auth.sql`
3. Add OIDC helper and auth-policy modules
4. Add `sso/start` and `sso/callback` routes
5. Extend local login route with policy checks
6. Add audit logging extensions
7. Add admin auth configuration management
8. Add Docker SSO stack
9. Add regression and security tests

## Definition of Ready for coding

Implementation can start when:

- the auth modes are product-approved
- the IdP choice for local testing is fixed
- secret handling for local and production environments is agreed
- engineering has sign-off on the SQL model
