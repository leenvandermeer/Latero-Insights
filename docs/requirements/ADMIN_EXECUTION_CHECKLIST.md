# Admin Feature: Execution Checklist (Phase 1 MVP)

**LADR**: [LADR-028](../decisions/20260425-admin-dashboard-architecture.md)  
**Requirements**: [LINS-010 → LINS-014](./current-product-requirements.md#L100)  
**Status**: READY FOR DEVELOPMENT  
**Effort**: 4–5 days  

---

## Pre-Development

- [ ] Read [LADR-028](../decisions/20260425-admin-dashboard-architecture.md) fully
- [ ] Read [admin-developer-quick-start.md](./admin-developer-quick-start.md)
- [ ] Confirm database credentials for PostgreSQL  
- [ ] Ensure Next.js project is at v15 with App Router
- [ ] Verify TanStack Query v5 is installed

---

## Database Setup (1 hour)

- [ ] Run 4 migrations (is_admin column, 3 new tables)
  - [ ] `insights_users.is_admin`
  - [ ] `insights_user_roles`
  - [ ] `insights_api_keys`
  - [ ] `insights_admin_audit_log`
- [ ] Verify tables exist: `psql ... -c "\dt insights_*"`

---

## Session Auth Update (30 min)

- [ ] Update `AuthSession` interface: add `is_admin: boolean`
- [ ] Update session fetching logic to read `is_admin` from DB
- [ ] Test: `console.log(session.is_admin)` on login

---

## Admin Middleware (45 min)

- [ ] Create `src/lib/admin-middleware.ts`
  - [ ] `requireAdminSession()` function
  - [ ] `adminAuthError()` helper
- [ ] Create `src/lib/audit-log.ts`
  - [ ] `logAdminAction()` function with DB insert
- [ ] Test: Call middleware from a simple test route

---

## API Routes (2 hours)

- [ ] `GET/POST /api/v1/admin/installations`
- [ ] `GET/PATCH /api/v1/admin/installations/[id]`
- [ ] `GET /api/v1/admin/health`
- [ ] `GET /api/v1/admin/installations/[id]/health`

**For each route:**
- [ ] Add `requireAdminSession()` check at top
- [ ] Handle response codes (400, 401, 403, 404)
- [ ] Log mutations with `logAdminAction()`
- [ ] Test with curl or Postman

---

## Admin Layout (1 hour)

- [ ] Create `src/app/admin/layout.tsx`
  - [ ] Enforce admin check; redirect if not admin
- [ ] Create `src/components/admin/sidebar-nav.tsx`
  - [ ] Navigation items (Dashboard, Installations, Users, API Keys, Audit)
  - [ ] Active state styling
  - [ ] Responsive (hamburger on mobile)

---

## Admin Pages (2 hours)

- [ ] `src/app/admin/page.tsx` — Overview dashboard
- [ ] `src/app/admin/installations/page.tsx` — List + search
- [ ] `src/app/admin/installations/[id]/page.tsx` — Detail + edit form
- [ ] `src/app/admin/users/page.tsx` — Placeholder ("Coming soon")
- [ ] `src/app/admin/api-keys/page.tsx` — Placeholder
- [ ] `src/app/admin/audit/page.tsx` — Placeholder

---

## Components (1 hour)

- [ ] `src/components/admin/health-badge.tsx`
- [ ] `src/components/admin/form-input.tsx`
- [ ] `src/components/admin/form-select.tsx`
- [ ] `src/components/admin/card.tsx` (optional for phase 1)

---

## TanStack Query Hooks (45 min)

- [ ] `src/hooks/use-admin-installations.ts`
  - [ ] `useAdminInstallations()`
  - [ ] `useAdminInstallation(id)`
  - [ ] `useCreateInstallation()`
  - [ ] `useUpdateInstallation(id)`
- [ ] `src/hooks/use-admin-health.ts`
  - [ ] `useAdminHealth()`

---

## Testing (1 hour)

- [ ] Add test admin user: `UPDATE insights_users SET is_admin = true WHERE email = 'test@example.com'`
- [ ] Test as admin:
  - [ ] Navigate to `/admin` — loads dashboard
  - [ ] Create installation — verify in DB and audit log
  - [ ] Edit installation — verify PATCH works and audit log recorded
- [ ] Test as non-admin:
  - [ ] Navigate to `/admin` — redirects to 403 or login
  - [ ] Call API directly — returns 403
- [ ] Build test: `npm run build` — zero errors
- [ ] Type check: `npm run type-check` — no errors

---

## Code Quality

- [ ] No hardcoded credentials in code
- [ ] All API calls go through typed client (`apiClient`)
- [ ] Audit logging calls don't throw (wrapped in try/catch)
- [ ] Responsive design works on mobile (<640px)
- [ ] No inline styles; use Tailwind classes

---

## Documentation

- [ ] Add JSDoc comments to all middleware/hooks
- [ ] Update `.env.example` with any new vars
- [ ] Link to LADR-028 in all admin files
- [ ] Add summary to CHANGELOG.md

---

## Definition of Done (MVP)

✅ All checkboxes above complete  
✅ Zero TypeScript errors  
✅ Admin can CRUD installations  
✅ Health metrics display correctly  
✅ Audit log captures all mutations  
✅ Auth guards are in place  
✅ Manual QA passed by at least 2 developers  

---

## Next Phase (Phase 2)

After MVP ships:
- [ ] User management page
- [ ] API key rotation + revocation  
- [ ] Full audit log with filters
- [ ] Confirm dialogs for destructive actions
- [ ] See [admin-implementation-checklist.md](./admin-implementation-checklist.md#phase-2--week-2)

---

**Total Estimate**: 4–5 full days (or 1 week with interruptions)  
**Owner**: [Developer Name]  
**Start Date**: [DATE]  
**Target Completion**: [DATE]  
