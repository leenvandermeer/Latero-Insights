# Admin Dashboard Implementation Checklist

**Related ADR**: LADR-028  
**Status**: In Planning  
**Effort Estimate**: 3–4 weeks (phases 1–2) + 1–2 weeks (phase 3)

## Phase 1 (MVP) — Week 1

**Goal**: Basic installation CRUD, health display, and admin session verification.

### Schema & Database

- [ ] Run migration: add `is_admin` column to `insights_users`
- [ ] Run migration: create `insights_user_roles` table
- [ ] Run migration: create `insights_api_keys` table
- [ ] Run migration: create `insights_admin_audit_log` table
- [ ] Update `session-auth.ts` to populate `is_admin` and `admin_roles` in `AuthSession`

### Backend — Auth & Middleware

- [ ] Create `src/lib/admin-middleware.ts` with `requireAdminSession()` function
- [ ] Update session verification to check admin status
- [ ] Create `src/lib/audit-log.ts` with `logAdminAction()` helper

### Backend — API Routes (Admin Namespace)

- [ ] Create `src/app/api/v1/admin/installations/route.ts`
  - `GET` — list with health snapshot
  - `POST` — create new installation
- [ ] Create `src/app/api/v1/admin/installations/[id]/route.ts`
  - `GET` — detail view
  - `PATCH` — update metadata
- [ ] Create `src/app/api/v1/admin/health/route.ts`
  - `GET` — aggregated metrics
- [ ] Create `src/app/api/v1/admin/installations/[id]/health/route.ts`
  - `GET` — detailed health per installation

### Frontend — Layout & Navigation

- [ ] Create `src/app/admin/layout.tsx` (separate from `(dashboard)` group)
  - Sidebar navigation (responsive)
  - Auth boundary (`requireAdminSession` check)
  - Breadcrumb/title bar
- [ ] Create `src/components/admin/sidebar-nav.tsx`
  - Navigation items: Dashboard, Installations, Users, API Keys, Audit
  - Mobile hamburger (collapse on <1024px)
- [ ] Create `src/components/admin/page-header.tsx`
  - Title, description, CTA button if applicable

### Frontend — Pages (Phase 1)

- [ ] Create `src/app/admin/page.tsx` (overview dashboard)
  - Health summary (total, connected, degraded, offline)
  - Key stats (message count 24h, avg error rate)
  - Refresh button
- [ ] Create `src/app/admin/installations/page.tsx`
  - Searchable table (name, environment, tier, status, last synced)
  - "Create Installation" button
  - Row click → detail page
- [ ] Create `src/app/admin/installations/[id]/page.tsx`
  - Edit form (name, environment, tier, contact email)
  - Health status display (badge, last synced, metrics)
  - "Rotate Key" button (disabled; implemented phase 2)
- [ ] Create `src/app/admin/(placeholder)/page.tsx` for Users, API Keys, Audit
  - Placeholder: "Coming soon" or minimal table structure

### Frontend — Components (Reusable)

- [ ] Create `src/components/admin/health-badge.tsx` (status indicator)
- [ ] Create `src/components/admin/form-input.tsx` (Tailwind-styled input)
- [ ] Create `src/components/admin/form-select.tsx` (Tailwind-styled select)
- [ ] Create `src/components/admin/card.tsx` (metric card)

### Frontend — Hooks (Data Fetching)

- [ ] Create `src/hooks/use-admin-installations.ts` (TanStack Query)
- [ ] Create `src/hooks/use-admin-health.ts` (TanStack Query)
- [ ] Create `src/hooks/use-admin-create-installation.ts` (mutation)

### Testing & Validation

- [ ] Verify admin session is required (test 401/403 without admin flag)
- [ ] Verify installation list displays correctly
- [ ] Verify create installation form validation (required fields)
- [ ] Verify health status is correctly computed and cached
- [ ] Run `npm run build` — zero errors
- [ ] Manual QA: Create installation → verify in database

---

## Phase 2 — Week 2

**Goal**: User management, API key rotation, basic audit log.

### Backend — API Routes (continued)

- [ ] Create `src/app/api/v1/admin/users/route.ts`
  - `GET` — list users with installations
- [ ] Create `src/app/api/v1/admin/users/[id]/roles/route.ts`
  - `PATCH` — update role per installation
  - `DELETE` — remove user from installation
- [ ] Create `src/app/api/v1/admin/api-keys/route.ts`
  - `GET` — list keys (per installation, searchable)
- [ ] Create `src/app/api/v1/admin/api-keys/[key_id]/rotate/route.ts`
  - `POST` — rotate key, return new key once
- [ ] Create `src/app/api/v1/admin/audit-log/route.ts`
  - `GET` — paginated log with filters (user, action, date range)

### Backend — Health & Helpers

- [ ] Create `src/lib/health-check.ts`
  - `checkInstallationHealth()` function
  - Caching logic (5 min TTL)
- [ ] Extend audit logging across all admin routes

### Frontend — Pages (Phase 2)

- [ ] Create `src/app/admin/users/page.tsx`
  - Table: email, admin?, installations count, created date
  - Search by email
  - Click row → detail page
- [ ] Create `src/app/admin/users/[id]/page.tsx`
  - User detail + list of installations with roles
  - Modify role dropdown per installation
  - Revoke access button (with confirm)
- [ ] Create `src/app/admin/api-keys/page.tsx`
  - Table: installation, masked key, created date, last used, expiry
  - Filter by installation
  - Rotate button, revoke button
- [ ] Create `src/app/admin/audit-log/page.tsx`
  - Table: timestamp, admin email, action, resource, details
  - Filters: date range, user, action type
  - Export (optional, phase 3)

### Frontend — Components & Hooks (Phase 2)

- [ ] Create `src/components/admin/confirm-dialog.tsx` (reusable danger action)
- [ ] Create `src/components/admin/masked-secret.tsx` (XXXX...XXXX display)
- [ ] Create `src/hooks/use-admin-users.ts`
- [ ] Create `src/hooks/use-admin-api-keys.ts`
- [ ] Create `src/hooks/use-admin-audit-log.ts`
- [ ] Create mutation hooks: `use-admin-rotate-key.ts`, `use-admin-modify-role.ts`

### Testing & Validation

- [ ] Verify user role modification updates database
- [ ] Verify API key rotation generates new key (old revoked)
- [ ] Verify audit log captures all admin actions
- [ ] Verify audit log filters work (date, user, action)
- [ ] Run `npm run build` — zero errors
- [ ] Manual QA: Full admin workflow (create install → manage users → rotate keys)

---

## Phase 3 (Nice-to-have) — Week 3+

**Goal**: Advanced metrics, two-factor admin verification, bearer token.

### Backend

- [ ] Create admin bearer token table + verification
- [ ] Implement two-factor verification endpoint (if 2FA enabled on user)
- [ ] Add health timeline computation (per-installation, 7-day history)
- [ ] Add bulk archive/reactivate endpoint

### Frontend

- [ ] Enhanced health metrics page (graph of metrics over time)
- [ ] Bulk select + actions (archive multiple installations)
- [ ] Two-factor prompt in admin login flow
- [ ] Export audit log to CSV

### Testing & Deployment

- [ ] Full regression test suite for admin routes
- [ ] Performance test: health check caching (verify 5-min TTL)
- [ ] Security review: admin role bypass attempts
- [ ] Load test: concurrent admin actions (create installation, rotate keys)

---

## File Structure Summary

```
src/
  app/
    admin/                            # NEW: admin layout group
      layout.tsx                       # Auth boundary + sidebar
      page.tsx                         # Overview dashboard
      installations/
        page.tsx                       # List + create
        [id]/
          page.tsx                     # Detail + edit
          health/
            page.tsx                   # Expanded health metrics (phase 3)
      users/
        page.tsx                       # List
        [id]/
          page.tsx                     # Detail + modify role
      api-keys/
        page.tsx                       # List + rotate/revoke
      audit/
        page.tsx                       # Paginated log + filters
    api/
      v1/
        admin/
          installations/
            route.ts                   # GET list, POST create
            [id]/
              route.ts                 # GET detail, PATCH update
              health/
                route.ts               # GET detailed health
          health/
            route.ts                   # GET aggregated
          users/
            route.ts                   # GET list
            [id]/
              roles/
                route.ts               # PATCH role, DELETE access
          api-keys/
            route.ts                   # GET list
            [key_id]/
              rotate/
                route.ts               # POST rotate
          audit-log/
            route.ts                   # GET paginated log

  components/
    admin/                             # NEW: admin-specific components
      sidebar-nav.tsx
      page-header.tsx
      health-badge.tsx
      form-input.tsx
      form-select.tsx
      card.tsx
      confirm-dialog.tsx               # Phase 2
      masked-secret.tsx                # Phase 2

  hooks/
    use-admin-installations.ts         # NEW
    use-admin-health.ts                # NEW
    use-admin-create-installation.ts   # NEW
    use-admin-users.ts                 # Phase 2
    use-admin-api-keys.ts              # Phase 2
    use-admin-audit-log.ts             # Phase 2
    use-admin-rotate-key.ts            # Phase 2
    use-admin-modify-role.ts           # Phase 2

  lib/
    admin-middleware.ts                # NEW: requireAdminSession()
    audit-log.ts                       # NEW: logAdminAction()
    health-check.ts                    # NEW: checkInstallationHealth() + caching
    session-auth.ts                    # MODIFIED: add is_admin, admin_roles

sql/
  init/
    20260425-admin-schema.sql          # NEW: migrations for admin tables
```

---

## Database Migrations

**File**: `sql/init/20260425-admin-schema.sql`

```sql
-- Add is_admin to insights_users
ALTER TABLE insights_users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Create admin roles table
CREATE TABLE IF NOT EXISTS insights_user_roles (
  user_id UUID NOT NULL REFERENCES insights_users(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES insights_users(user_id),
  PRIMARY KEY (user_id, role)
);

-- Create API keys table
CREATE TABLE IF NOT EXISTS insights_api_keys (
  key_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id TEXT NOT NULL REFERENCES insights_installations(installation_id),
  key_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES insights_users(user_id),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  INDEX (installation_id),
  INDEX (key_hash)
);

-- Create audit log table
CREATE TABLE IF NOT EXISTS insights_admin_audit_log (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES insights_users(user_id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address INET,
  INDEX (timestamp DESC),
  INDEX (user_id),
  INDEX (resource_type, resource_id)
);

-- Seed initial admin user (optional, for development)
-- INSERT INTO insights_users (email, password_hash, is_admin) VALUES ('admin@latero.local', '...')
```

---

## Deployment & Go-Live Checklist

- [ ] Database migrations run successfully
- [ ] Admin user provisioned and tested
- [ ] Session auth extended with `is_admin` flag
- [ ] `/admin` routes respond with 401 for non-admin
- [ ] All admin API endpoints tested with Postman/curl
- [ ] Frontend builds without errors
- [ ] Admin UI is responsive on mobile/tablet/desktop
- [ ] Health metrics are correctly cached (verify logs)
- [ ] Audit log entries are created for all admin actions
- [ ] Documentation updated (README, CHANGELOG, ADR index)
- [ ] Security review passed (no auth bypass, secrets not logged)
- [ ] Load testing completed (health check caching, concurrent requests)
- [ ] Rollback plan documented

---

## Known Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Admin role could grant themselves higher privileges | Bearer token and session verification are independent; admin role cannot bypass database constraints |
| Health check causes database load spikes | Caching (5-min TTL) prevents excessive queries |
| Audit log grows unbounded | Implement retention policy (e.g., purge entries older than 90 days) in phase 3 |
| API keys shown once and never retrieved | Make this clear in UI with copy-to-clipboard and warning |
| Two-factor fallback in phase 3 could delay MVP | Phase 1 uses session only; 2FA is optional for phase 3 |

---

## Success Criteria

- ✅ MVP (Phase 1) ships by end of week 1
- ✅ All admin routes have unit tests (>80% coverage)
- ✅ Admin UI is tested with 3+ users (manual QA)
- ✅ Health status updates every 5 minutes (verified with monitoring)
- ✅ Audit log captures all admin actions (manual verification)
- ✅ Zero security issues found in code review
- ✅ Documentation is complete and matches implementation
