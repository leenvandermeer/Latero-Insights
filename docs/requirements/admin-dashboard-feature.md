# Admin Dashboard Feature — Analysis & Requirements Summary

**Status**: Ready for Development  
**Feature ID**: LADR-028 + LINS-010 through LINS-014  
**Created**: 2026-04-25

---

## Executive Summary

Latero Control has multi-tenant capability (LADR-027) but lacks operator-facing
management UI for:

- Creating and managing installations
- Viewing health status
- Managing users and roles
- Tracking and rotating API keys
- Auditing administrative actions

This feature bridges that gap by implementing a **separate admin dashboard**
(`/admin/*` routes) with backend APIs (`/api/v1/admin/*`) and a responsive UI.

---

## Key Decisions

### 1. Route Namespace

- **Admin frontend**: `/admin` → separate layout group (not part of `(dashboard)`)
- **Admin backend**: `/api/v1/admin/*` → versioned, bearer-token-compatible
- **Auth model**: Session cookie + admin role flag (`is_admin` on `insights_users`)
- **Fallback**: Bearer token (`X-Admin-Token` header) for tooling/automation (phase 3)

### 2. Layout & Navigation

```
─────────────────────────────────────
Sidebar (left)  │  Content (right)
───────────────┼──────────────────────
• Dashboard    │  ┌─ Overview/Install. ─┬─ Users
• Install...   │  │  (tab navigation)   │
• Users        │  └─ [Content pane] ────┘
• API Keys     │
• Audit        │
```

- Fixed sidebar on ≥1024px
- Hamburger/collapsible on mobile
- Responsive grid for table/card content

### 3. Three-Phase Rollout

| Phase | Focus | Duration |
|-------|-------|----------|
| **1** | MVP: Install CRUD, health display, admin auth | Week 1 |
| **2** | User management, API key rotation, audit log | Week 2 |
| **3** | Advanced metrics, 2FA, bearer token, bulk ops | Week 3+ |

---

## Architecture Components

### Database Schema (4 new tables)

1. **`insights_user_roles`**: Admin and operator role assignments
2. **`insights_api_keys`**: Per-installation API key tracking with usage
3. **`insights_admin_audit_log`**: Audit trail (all admin actions)
4. **`insights_users` (extended)**: Add `is_admin` boolean flag

### Backend API Routes (Phase 1–2)

```
GET/POST   /api/v1/admin/installations         → list + create
GET/PATCH  /api/v1/admin/installations/[id]    → detail + edit
GET        /api/v1/admin/installations/[id]/health
GET        /api/v1/admin/health                → aggregated metrics
GET/PATCH  /api/v1/admin/users                 → list users
PATCH/DEL  /api/v1/admin/users/[id]/roles
GET/POST   /api/v1/admin/api-keys              → list + manage
POST       /api/v1/admin/api-keys/[id]/rotate
GET        /api/v1/admin/audit-log             → query + filter
```

### Frontend Pages (Phase 1–2)

- **Overview**: Health summary, stats, refresh button
- **Installations**: List (table/cards), search, create button
- **Installation Detail**: Edit form, health status, key rotation
- **Users**: Members across all installations, roles management
- **API Keys**: Token lifecycle, rotation, revocation history
- **Audit Log**: Paginated, filterable by date/user/action

### Middleware & Helpers

- **`requireAdminSession()`**: Auth boundary for all admin routes
- **`logAdminAction()`**: Audit logging helper
- **`checkInstallationHealth()`**: Compute + cache health status (5-min TTL)
- **TanStack Query hooks**: `use-admin-installations`, `use-admin-health`, etc.

---

## Design Tokens & Styling

All UI uses existing Tailwind v4 + `src/styles/tokens.css`:

- **Colors**: Use CSS custom properties (`--color-*`)
- **Responsive**: Tailwind breakpoints (`sm`, `md`, `lg`, `xl`)
- **Typography**: Existing scale (h1–h6, body, label)
- **Icons**: Lucide React (status badges, actions)

Example badge:
```tsx
<div className="inline-block px-2 py-1 rounded bg-emerald-100 text-emerald-800 text-sm font-medium">
  Connected
</div>
```

---

## Security & Guardrails

1. **No admin bypass of data isolation**
   - Admin can see all installations but must use InstallationPicker to access
     dashboard data
   - Health data is aggregated; no direct read of customer data

2. **Secrets shown once only**
   - New API key displayed only in response
   - No retrieval or plaintext storage

3. **All admin actions audited**
   - Create, update, delete, rotate logged to `insights_admin_audit_log`
   - Includes user, timestamp, action, resource, details

4. **Auth required on all admin routes**
   - `requireAdminSession()` middleware blocks unauthorized access
   - Returns 401/403 accordingly

5. **No hardcoded admin users**
   - Admin role provisioned during setup (manual or seed script)

---

## UX Patterns & Components

### Forms

- **Text input**: `form-input.tsx` (Tailwind-styled)
- **Select**: `form-select.tsx` (environment, tier dropdowns)
- **Validation**: HTML5 validation + client-side checks (TanStack Form or custom)

### Data Display

- **Tables**: Responsive, pagination (TanStack Table optional for phase 2+)
- **Cards**: Metric cards with icon + value + sparkline (phase 3)
- **Status badge**: `health-badge.tsx` → Connected/Degraded/Offline
- **Masked secret**: `masked-secret.tsx` → sk-XXXX...XXXX with copy button

### Confirmations

- **Confirm dialog**: `confirm-dialog.tsx` for destructive actions
  - "Rotate Key", "Revoke Access", "Archive Installation"
  - Shows consequence + cancel button

### Responsive Breakpoints

- **Mobile (<640px)**: Single-column layout, sidebar hamburger
- **Tablet (≥640px)**: Two-column, sidebar visible
- **Desktop (≥1024px)**: Three-column if needed, sidebar expanded

---

## Phasing & MVP Scope

### Phase 1 (MVP) — **Week 1**

Must-haves:
- ✅ Installation CRUD (create, read, update, soft-delete)
- ✅ Health status display (status badge + metrics)
- ✅ Admin auth verification
- ✅ Audit logging for create/update
- ✅ Responsive admin layout

Nice-to-have (defer to phase 2):
- User management
- API key rotation UI
- Full audit log search

### Phase 2 — **Week 2**

- User roles & membership management
- API key rotation & revocation
- Full audit log with filters
- Confirm dialogs for destructive actions

### Phase 3 — **Week 3+**

- Two-factor admin verification
- Bearer token (X-Admin-Token) support
- Advanced health metrics (timeline graphs)
- Bulk operations (archive multiple)
- Audit log export (CSV)

---

## Implementation Checklist

See **`docs/requirements/admin-implementation-checklist.md`** for detailed
per-phase breakdown, file structure, and deployment steps.

---

## Related Documents

- **ADR**: [LADR-028](../decisions/20260425-admin-dashboard-architecture.md)
- **Requirements**: [LINS-010 through LINS-014](./current-product-requirements.md)
- **Companion**: [Implementation Checklist](./admin-implementation-checklist.md)

---

## Known Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Admin role escalation | Session + database constraints prevent privilege bypass |
| Health check DB load | 5-min caching + index on `(installation_id, timestamp)` |
| Audit log bloat | Retention policy (purge >90d) in phase 3 |
| Secret disclosure | Show once only, masked in UI, logged as hashed |
| Auth bypass | Separate route namespace + middleware testing |

---

## Deployment & Launch

1. **Week 1 end**: MVP (phase 1) merged and deployed to staging
2. **QA**: Manual testing of installation CRUD, health display
3. **Security review**: Admin auth paths, audit logging
4. **Week 2**: Phase 2 merged and deployed
5. **Final review**: Complete admin workflow tested end-to-end
6. **Production**: Deploy with feature flag or manual access control

---

## Next Steps for Developer

1. **Read** LADR-028 and implementation checklist
2. **Set up** database schema (SQL migration)
3. **Implement** phase 1 backend (routes, middleware, helpers)
4. **Implement** phase 1 frontend (layout, pages, components)
5. **Test** admin session verification + CRUD operations
6. **Validate** build and manual QA
7. **Document** API contract and deployment steps

---

**Ready to proceed?** → Assign to Developer agent for phase 1 implementation.
