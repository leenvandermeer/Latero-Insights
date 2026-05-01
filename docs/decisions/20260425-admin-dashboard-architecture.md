# LADR-028 — Admin Dashboard: installation and multi-tenant lifecycle management

Datum: 2026-04-25  
Status: ACCEPTED

## Context

Latero Control has implemented multi-org session authentication (email/password
login, session cookie, per-user installation list) and multi-tenant read APIs
(LADR-027). However, there is no operational UI for:

1. Creating and managing installations (name, environment, tier, contact)
2. Viewing health status per installation (database connectivity, API
   responsiveness, cache metrics)
3. Managing users across all installations (roles, membership)
4. Tracking and rotating API keys, with last-accessed timestamps
5. Auditing administrative actions (who, what, when)

Currently, installation creation and token management require direct database
access or manual tooling. This creates barriers to self-service and observability.

## Decision

Layer2 Meta Insights will implement a **separate admin dashboard** for
operator-only management of installations and multi-tenant lifecycle, distinct
from the main dashboard UI.

### 1. Route Strategy

- **Admin namespace**: `/admin/*` routes (page, API, and auth boundary)
- **Separate layout**: `src/app/admin/layout.tsx` (not part of `(dashboard)` group)
- **Auth model**: Extends session-cookie auth with admin role verification
  - Session `AuthSession` gains `is_admin: boolean` field
  - Admin-only middleware checks both session validity and `is_admin` flag
  - Fallback: admin bearer token (`X-Admin-Token` header) for external tooling
    (e.g., infrastructure automation)

### 2. Admin Page Structure

```
src/app/admin/
  ├── layout.tsx               # Admin shell (sidebar, navigation, auth boundary)
  ├── page.tsx                 # Overview dashboard (health, stats)
  ├── installations/
  │   ├── page.tsx             # List + search + create
  │   ├── [id]/
  │   │   ├── page.tsx         # Detail view (edit, health timeline)
  │   │   └── health/
  │   │       └── page.tsx     # Expanded health metrics
  ├── users/
  │   ├── page.tsx             # Members across all installations
  │   └── [id]/
  │       └── page.tsx         # User detail + modify role
  ├── api-keys/
  │   └── page.tsx             # Token management (list, rotate, revoke)
  └── audit/
      └── page.tsx             # Paginated activity log
```

### 3. Admin API Routes (Backend)

All routes require admin session verification or bearer token. Response codes:
- `401 Unauthorized` — no session or admin token
- `403 Forbidden` — session exists but user is not admin
- `404 Not Found` — installation/resource does not exist

#### 3.1 Installation Management

**`GET /api/v1/admin/installations`**
- Query params: `skip=0`, `take=50`, `status=connected|degraded|offline` (optional)
- Response: `InstallationSummary[]` with health snapshot
- Schema:
  ```typescript
  interface InstallationSummary {
    installation_id: string;
    label: string | null;
    environment: 'dev' | 'staging' | 'prod';
    tier: 'free' | 'pro' | 'enterprise';
    contact_email?: string;
    active: boolean;
    status: 'connected' | 'degraded' | 'offline';
    last_synced_at: string | null;
    message_count_24h: number;
    error_rate_pct: number | null;
  }
  ```

**`POST /api/v1/admin/installations`**
- Body:
  ```typescript
  {
    label: string;           // e.g. "Production EU"
    environment: string;     // 'dev' | 'staging' | 'prod'
    tier: string;           // 'free' | 'pro' | 'enterprise'
    contact_email?: string;
  }
  ```
- Response: `{ installation_id: string; api_key: string; }` (key shown once)

**`PATCH /api/v1/admin/installations/[id]`**
- Body (partial update):
  ```typescript
  {
    label?: string;
    environment?: string;
    tier?: string;
    contact_email?: string;
    active?: boolean;         // Soft archive/reactivate
  }
  ```
- Response: Updated `InstallationSummary`

**`POST /api/v1/admin/installations/[id]/rotate-key`**
- Body: `{}` (empty)
- Response: `{ new_api_key: string; }` (shown once)

#### 3.2 Health & Status

**`GET /api/v1/admin/health`**
- Aggregated metrics across all installations
- Response:
  ```typescript
  {
    total_installations: number;
    connected: number;
    degraded: number;
    offline: number;
    total_messages_24h: number;
    avg_error_rate: number;
    postgres_connection_ok: boolean;
    postgres_latency_ms: number;
  }
  ```

**`GET /api/v1/admin/installations/[id]/health`**
- Detailed metrics and timeline for one installation
- Query params: `days=7` (default)
- Response:
  ```typescript
  {
    installation_id: string;
    status: 'connected' | 'degraded' | 'offline';
    last_synced_at: string;
    message_count_24h: number;
    error_rate_pct: number;
    postgres_latency_ms: number;
    api_response_time_p95_ms: number;
    cache_hit_ratio: number;  // 0.0 to 1.0
    timeline: Array<{
      timestamp: string;
      status: string;
      metric_value?: number;
      message?: string;
    }>;
  }
  ```

#### 3.3 User Management

**`GET /api/v1/admin/users`**
- Query params: `skip=0`, `take=50`, `installation_id?` (filter by installation)
- Response:
  ```typescript
  interface AdminUserSummary {
    user_id: string;
    email: string;
    is_admin: boolean;
    created_at: string;
    installations: Array<{
      installation_id: string;
      role: string;  // 'member' | 'admin' | ...
      since: string;
    }>;
  }
  ```

**`PATCH /api/v1/admin/users/[id]/roles`**
- Body: `{ installation_id: string; role: string; }`
- Response: Updated `AdminUserSummary`

**`DELETE /api/v1/admin/users/[id]/installations/[installation_id]`**
- Remove user from specific installation
- Response: `{ success: boolean; }`

#### 3.4 API Key Tracking

**`GET /api/v1/admin/api-keys`**
- Query params: `installation_id?`, `skip=0`, `take=50`
- Response:
  ```typescript
  interface ApiKeyInfo {
    key_id: string;
    installation_id: string;
    label?: string;
    last_four: string;        // Last 4 chars of key
    created_at: string;
    expires_at: string | null;
    last_used_at: string | null;
    revoked_at: string | null;
  }
  ```

**`POST /api/v1/admin/api-keys/[key_id]/rotate`**
- Response: `{ new_api_key: string; }` (shown once)

#### 3.5 Audit Log

**`GET /api/v1/admin/audit-log`**
- Query params: `skip=0`, `take=100`, `user_id?`, `installation_id?`, `action?`, `from_date?`, `to_date?`
- Response:
  ```typescript
  interface AuditLogEntry {
    event_id: string;
    timestamp: string;
    user_id: string;
    user_email: string;
    action: string;  // e.g. 'create_installation', 'rotate_key', 'modify_user'
    resource_type: string;
    resource_id: string;
    details: Record<string, any>;
    ip_address?: string;
  }
  ```

### 4. Database Schema Extensions

New tables (in addition to existing session-auth schema from LADR-027):

#### 4.1 `insights_user_roles`

```sql
CREATE TABLE insights_user_roles (
  user_id UUID NOT NULL REFERENCES insights_users(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL,  -- 'admin' | 'operator' | 'viewer'
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES insights_users(user_id),
  PRIMARY KEY (user_id, role)
);
```

#### 4.2 `insights_api_keys` (per-installation tokens)

```sql
CREATE TABLE insights_api_keys (
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
```

#### 4.3 `insights_admin_audit_log`

```sql
CREATE TABLE insights_admin_audit_log (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES insights_users(user_id),
  action TEXT NOT NULL,  -- 'create_installation', 'rotate_key', etc.
  resource_type TEXT,    -- 'installation' | 'user' | 'api_key'
  resource_id TEXT,
  details JSONB,
  ip_address INET,
  INDEX (timestamp DESC),
  INDEX (user_id),
  INDEX (resource_type, resource_id)
);
```

### 5. Admin Session & Auth Model

#### 5.1 Session Extension

`AuthSession` interface gains:

```typescript
export interface AuthSession {
  user_id: string;
  email: string;
  two_factor_enabled: boolean;
  active_installation_id: string;
  installations: SessionInstallation[];
  is_admin: boolean;              // NEW
  admin_roles: string[];          // NEW ['admin', 'operator']
}
```

#### 5.2 Admin Middleware

New middleware function for route protection:

```typescript
export async function requireAdminSession(
  request: NextRequest,
): Promise<AuthSession> {
  // Check session cookie
  const session = await requireSession(request);
  if (!session.is_admin) {
    throw new Error('Forbidden: admin role required');
  }
  
  // Optional: check X-Admin-Token header for external tooling
  const adminToken = request.headers.get('X-Admin-Token');
  if (adminToken && !session) {
    // Verify against admin bearer token table
    // (future enhancement)
  }
  
  return session;
}
```

### 6. Health Check Strategy

Health status is computed on-demand per installation:

```typescript
async function checkInstallationHealth(
  installationId: string,
): Promise<{ status: string; metrics: Record<string, any> }> {
  // 1. Check Postgres connectivity and latency
  // 2. Count recent messages (from pipeline_runs, data_quality_checks, data_lineage)
  // 3. Calculate error rate from ingest_audit
  // 4. Query cache metrics (if applicable)
  // 5. Aggregate into 'connected' | 'degraded' | 'offline'
  
  // Thresholds (configurable):
  // - latency > 1000ms → degraded
  // - error_rate > 10% → degraded
  // - no messages in 24h → offline (optional)
}
```

Caching: health status is cached for 5 minutes per installation to avoid
excessive database load.

### 7. Implementation Phasing

#### Phase 1 (MVP) — Week 1
- ✅ Session schema + `is_admin` role verification
- ✅ Admin middleware + `/admin` layout
- ✅ `GET /api/v1/admin/installations` + `POST` (create)
- ✅ Installation list UI (table, search, create button)
- ✅ Installation detail page (edit form)
- ✅ Basic health display (status badge, last synced)

#### Phase 2 — Week 2
- User management UI + API
- API key rotation UI + API
- Audit log UI + API (basic)

#### Phase 3 (Nice-to-have)
- Advanced health metrics (timeline, charts)
- Bulk actions (archive multiple)
- Two-factor admin verification
- Admin token (bearer-based) for automation

### 8. Guardrails

- **No admin bypass of data isolation.** Admin sees installation list and health,
  but does not automatically see all data across installations. Reading data
  requires switching context via InstallationPicker (LADR-027).
- **Admin actions are audited.** All create/update/delete actions log to
  `insights_admin_audit_log`.
- **Secrets shown once.** New API keys and rotated keys are returned in the
  response once; they are never stored in plaintext or displayed again.
- **No hardcoded admin users.** Admin role is granted via database or
  provisioned during initial setup; there is no fallback hardcoded admin.
- **Separate namespace prevents accidental coupling.** The `/admin` routes and
  components are completely separate from the `(dashboard)` layout group,
  reducing risk of auth bypass.

## Consequences

Positive:
- Closes the gap between multi-tenant capability and operator observability
- Enables self-service installation onboarding (without manual tooling)
- Provides audit trail for compliance and debugging
- API key lifecycle is trackable and auditable

Trade-offs:
- Admin schema adds three new tables (small footprint)
- Health checks add periodic database load (mitigated by caching)
- Two-factor admin verification (phase 3) will require additional UI/auth logic

Backward compatibility:
- Single-tenant deployments see the admin UI if the user has `is_admin=true`
  (default on first setup)
- Existing session auth is not disrupted
- `/admin` is a new route; no changes to existing dashboard routes

## Follow-up

1. **Phase 3 enhancements**: two-factor admin verification, admin bearer tokens,
   advanced metrics
2. **Billing integration**: tie installations to payment method, enforce tier
   limits (SaaS-specific)
3. **Okta/SAML admin sync**: sync admin roles from identity provider

## Related ADRs

- LADR-027: Installation-aware UX (multi-tenancy groundwork)
- LADR-025: Insights SaaS ingest backend
- LADR-004: Runtime settings store

