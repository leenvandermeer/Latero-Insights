# SSO Authentication UX Requirements

Status: Draft  
Owner: UX + Product + Engineering  
Date: 2026-05-03

## Purpose

This document defines the UX requirements for hybrid authentication in Latero
Control. It complements the SSO security and implementation documents by
describing how users should understand, enter, recover from, and administer the
new auth model.

## UX problem statement

Hybrid auth is not only a technical problem. Without clear UX, users can be
confused by:

- when to use SSO versus local login
- why local login is unavailable for one installation but visible in another
- what a break-glass account is and when it is allowed
- what happened after returning from the identity provider
- how installation context affects access after login

In a multi-tenant SaaS product, auth UX must reduce ambiguity while preserving
security controls.

## UX goals

- Make the primary login path obvious for each installation
- Reduce accidental use of the wrong login mechanism
- Keep security restrictions understandable without revealing sensitive policy
- Make installation context visible before and after login
- Ensure admin auth configuration is understandable for non-developer operators

## Core UX principles

### 1. One primary action per context

Every login screen should have one visually primary path.

- If installation policy is `sso_only`, SSO is the only primary action
- If installation policy is `sso_with_break_glass`, SSO is primary and local
  break-glass access is clearly secondary
- If installation policy is `local_only`, local login is primary

The UI should avoid presenting SSO and password login as two equal peers when
policy does not treat them equally.

### 2. Installation-aware messaging

Authentication must be framed in the current installation context.

Examples of required cues:

- installation label in the login view
- short text describing the active auth mode
- explicit notice when local login is restricted

### 3. Security without mystery

Error handling must be clear enough for a normal user, but not leak sensitive
 configuration details.

Examples:

- good: "This installation requires single sign-on."
- good: "Your account is not allowed to use local sign-in for this installation."
- avoid: detailed issuer mismatch, client configuration details, or claim dumps

### 4. Break-glass is exceptional

Break-glass access must feel exceptional in both wording and visual hierarchy.

Requirements:

- secondary placement below the primary SSO action
- warning/supportive copy
- no default focus on password fields when SSO is primary
- audit-sensitive actions should not be framed as convenience shortcuts

### 5. Smooth return from IdP

Users returning from SSO should see a stable, predictable landing path.

Requirements:

- loading/redirect state after callback
- safe fallback destination when original deep link is not allowed
- clear unauthorized state when authentication succeeded but installation access
  is missing

## Required user journeys

### Journey 1 — SSO-only tenant login

User sees:

- installation name
- one primary button: `Continue with Single Sign-On`
- no active password form

Acceptance:

- no ambiguity about the expected login method
- support link or help text exists for access issues

### Journey 2 — SSO with break-glass fallback

User sees:

- SSO as primary
- a secondary disclosure or secondary panel for emergency/local admin access
- language that makes clear this path is restricted

Acceptance:

- normal tenant users are steered to SSO
- break-glass access is discoverable but not visually dominant

### Journey 3 — Local-only tenant

User sees:

- standard local login form
- no irrelevant SSO controls

Acceptance:

- no dead-end or disabled SSO action

### Journey 4 — Authenticated but unauthorized after SSO

User has a valid identity-provider login but no authorized installation access.

User sees:

- a dedicated access-denied state
- installation-aware explanation
- next step guidance such as contacting an administrator

Acceptance:

- error is not shown as a generic crash
- user understands they authenticated successfully but lack authorization

### Journey 5 — Installation switch after login

User switches installation while authenticated.

User sees:

- clear current installation indicator
- confirmation of the newly active installation
- data refresh without leaking previous installation context

Acceptance:

- no stale tenant data remains visible
- change in context is obvious

### Journey 6 — Admin configures SSO for an installation

Admin sees:

- auth mode selector
- issuer/client configuration form
- test configuration action
- warnings about local fallback and break-glass behavior

Acceptance:

- secret inputs are masked
- destructive mode changes have confirmation copy
- operator understands impact before saving

## UI components and states

### Login page states

Required states:

- default
- loading
- redirecting to IdP
- callback processing
- invalid configuration
- access denied
- generic auth failure

### Admin SSO settings states

Required states:

- untouched
- dirty
- validating
- validation success
- validation failure
- save success
- save failure

### Copy guidelines

- Keep language in English to match product UI convention
- Prefer "single sign-on" over acronyms alone in user-facing copy
- Use "emergency access" or "break-glass access" only in admin or advanced
  contexts, not as a default user-facing CTA label

## Responsive considerations

Authentication screens must work on:

- desktop
- tablet
- mobile

Minimum expectations:

- primary CTA visible without confusion on small screens
- secondary local fallback does not crowd out primary action
- callback/loading states remain legible on mobile

## UX deliverables

Expected UX outputs for this feature:

- auth journey map
- low-fidelity wireframes for login and admin auth settings
- state inventory
- UI copy set for auth states
- usability review notes

## UX acceptance criteria

- Users can identify the correct login path for their installation without
  training
- SSO-only installations do not present misleading local login affordances
- Break-glass access is clearly secondary and exceptional
- Unauthorized-after-login states are understandable
- Admin operators can configure auth mode without needing raw implementation
  knowledge
