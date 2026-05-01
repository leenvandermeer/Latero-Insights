# Security Guidelines — Latero Control

**Last Updated:** 2026-04-25  
**Version:** 1.0

## Multi-Tenant Security Model

Latero Control enforces **strict tenant isolation** as a foundational principle. All user data, configurations, and assets are scoped to a single installation (tenant) and must never leak across tenant boundaries.

### Core Principle: LINS-016 — Strict Tenant Data Isolation

**Requirement:** Data from one tenant MUST NOT be visible in another tenant's context.

- **Enforcement Layer:** Server-side validation on all read/write operations
- **Scope Mechanism:** `active_installation_id` from authenticated session
- **Admin Exception:** Cross-tenant aggregation only available in `/api/v1/admin/*` routes with admin role verification

See [LINS-016](current-product-requirements.md#lins-016--strict-tenant-data-isolation) for formal specification.

## Implementation Checklist

Every API route, data store, and cache layer must verify:

### ✅ API Routes

- [ ] Route has `requireSession()` call to extract `active_installation_id`
- [ ] Route returns 401 for unauthenticated requests
- [ ] Route filters all queries by `active_installation_id`
- [ ] Route validates ownership before CREATE/UPDATE/DELETE operations
- [ ] Route does NOT accept `installation_id` or `tenant_id` as user input; always uses session value

### ✅ Data Storage (localStorage, files, databases)

- [ ] Keys are namespaced by `installation_id` (e.g., `insights-dashboard-store-v1:{installation_id}`)
- [ ] No global keys shared across installations
- [ ] On installation switch, data store is reloaded for new tenant context
- [ ] Cleanup/migration: old data from previous tenant is not visible

### ✅ Caching

- [ ] Cache keys include `installation_id` component
- [ ] Cache hit cannot return data from different installation
- [ ] Cache invalidation on installation switch

### ✅ Admin Routes (`/api/v1/admin/*`)

- [ ] All routes call `requireAdminSession()` to verify `is_admin` flag
- [ ] Admin can view **cross-tenant** data with explicit authorization
- [ ] Admin actions are logged to audit trail with installation context

## Security Audit Checklist — LADR-029

Completed security fixes (2026-04-25):

### Shared Widget Library (`GET/POST/PATCH/DELETE /api/widgets/shared*`)
- ✅ Added `requireSession()` to all endpoints
- ✅ Added `installation_id: string` to `SharedWidgetDef` type
- ✅ GET endpoint filters by `installation_id`
- ✅ POST/PATCH/DELETE validate widget ownership
- ✅ Type system enforces tenant isolation

### Personal Dashboards (localStorage)
- ✅ Created `getStorageKey(installationId)` helper
- ✅ Updated `loadStore()` / `saveStore()` to accept `installationId`
- ✅ `DashboardProvider` uses `useInstallation()` hook
- ✅ Dashboard state reloads on installation switch
- ✅ No cross-tenant dashboard leakage

### Core Endpoints
- ✅ `/api/settings` — added `requireSession()`
- ✅ `/api/sync/databricks` — added `requireSession()`
- ✅ `/api/dashboards/system` — validated per-installation filtering

## Ongoing Security Best Practices

### For Developers

When adding new endpoints or features:

1. **Always call `requireSession()`** if user context is needed
   ```typescript
   const session = await requireSession(request);
   const installationId = session.active_installation_id;
   ```

2. **Never accept installation ID from client**
   ```typescript
   // ❌ WRONG
   const installationId = request.nextUrl.searchParams.get("installation_id");

   // ✅ RIGHT
   const session = await requireSession(request);
   const installationId = session.active_installation_id;
   ```

3. **Validate ownership before mutations**
   ```typescript
   // Before UPDATE or DELETE, verify the resource belongs to active installation
   const resource = await db.query(
     "SELECT * FROM widgets WHERE id = $1 AND installation_id = $2",
     [widgetId, installationId]
   );
   if (!resource) return 403; // Forbidden
   ```

4. **Test cross-tenant boundaries**
   - Create two test users in different installations
   - Verify User A cannot access User B's data via:
     - Direct API calls
     - Query parameter manipulation
     - Session hijacking attempts
     - Cache poisoning

### For Operations

- **Runtime Settings:** Databricks credentials stored in `.cache/settings.json` are **shared across installations**. Secure file system access is **required**.
- **Audit Logging:** All admin actions are logged to `insights_admin_audit_log`. Monitor for:
  - Bulk data exports
  - API key creation/rotation
  - User role changes
  - Cross-tenant queries

## Known Limitations

- **Shared Widget Library (global):** By design, the shared widget library is system-wide. Operators can publish widgets for all installations. If tenant separation is needed for widgets, use personal/system dashboard overrides.
- **System Dashboards:** Dashboard layout overrides are stored per-dashboard ID (e.g., `system:pipelines`), not per-installation. Operator edits affect all tenants using that system dashboard. This is intentional; custom layouts use personal dashboards.

## Incident Response

If a potential cross-tenant data leakage is suspected:

1. **Immediately disable** the affected feature (take the route offline if necessary)
2. **Check audit logs** for which users/installations were affected
3. **Review the code** for tenant filtering logic
4. **Add test coverage** for the specific scenario
5. **Verify fix** before re-enabling

## References

- [LINS-016 — Strict Tenant Data Isolation](current-product-requirements.md#lins-016--strict-tenant-data-isolation)
- [LADR-029 — Tenant Data Isolation Security Hardening](../decisions/20260425-tenant-data-isolation-security-hardening.md)
- [LADR-028 — Admin Dashboard Architecture](../decisions/20260425-admin-dashboard-architecture.md)
- [Session Authentication](../../web/src/lib/session-auth.ts)
- [Admin Authentication](../../web/src/lib/admin-auth.ts)
