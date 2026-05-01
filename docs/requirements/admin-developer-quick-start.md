# Admin Dashboard — Developer Quick Start

**Related**: [LADR-028](../decisions/20260425-admin-dashboard-architecture.md), [LINS-010–LINS-014](./current-product-requirements.md#L100)  
**Phase**: 1 (MVP) — Week 1  
**Status**: Ready for Development  
**Owner**: Developer  

---

## Quick Overview

Build a **separate admin UI at `/admin`** for installation CRUD, health display, and admin session verification. This is **not** part of the main dashboard; it's operator-only infrastructure.

**End result (Phase 1):**
- ✅ Installation list + search
- ✅ Create installation form
- ✅ Installation detail view (edit, health metrics)
- ✅ System health overview dashboard
- ✅ Admin auth verification (401/403 enforcement)
- ✅ Audit logging for create/update events

---

## Architecture Decisions (TL;DR)

| Decision | Why | Impact |
|----------|-----|--------|
| **`/admin` separate route** | Keeps admin UI out of main dashboard code | Create new layout group `src/app/admin/` |
| **Session `is_admin` flag** | Reuses existing auth, no new login | Add `is_admin: boolean` to `AuthSession` type |
| **`/api/v1/admin/*` routes** | Versioned, bearer-token compatible later | All admin APIs under `src/app/api/v1/admin/` |
| **Admin middleware** | Single guard for all admin routes | Create `src/lib/admin-middleware.ts` |
| **Audit logging** | Operational observability | Log all CRUD to `insights_admin_audit_log` table |

---

## Phase 1 Implementation Roadmap

### Step 1: Database Schema (1 hour)

Run migrations to create 4 tables:

```sql
-- 1. Add is_admin to existing insights_users table
ALTER TABLE insights_users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create admin roles table
CREATE TABLE insights_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES insights_users(id) ON DELETE CASCADE,
  installation_id UUID REFERENCES insights_installations(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'member', 'admin', 'operator', 'viewer'
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, installation_id, role)
);

-- 3. Create API keys table
CREATE TABLE insights_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID NOT NULL REFERENCES insights_installations(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  rotated_at TIMESTAMP,
  revoked_at TIMESTAMP,
  last_used_at TIMESTAMP,
  created_by UUID REFERENCES insights_users(id)
);

-- 4. Create admin audit log table
CREATE TABLE insights_admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES insights_users(id),
  action VARCHAR(100) NOT NULL, -- 'create_installation', 'update_installation', 'rotate_key', etc.
  resource_type VARCHAR(100), -- 'installation', 'user', 'api_key'
  resource_id UUID,
  details JSONB, -- Captures what changed
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX (admin_user_id, created_at),
  INDEX (resource_type, resource_id)
);
```

**Files to update:**
- Place migrations in `infra/sql/init/` (PostgreSQL DDL)
- If using an ORM (Prisma, etc.), create schema update

---

### Step 2: Update Session Auth (30 minutes)

**File**: `src/lib/session-auth.ts` (or wherever `AuthSession` is defined)

```typescript
// Before
interface AuthSession {
  user_id: string;
  email: string;
  installation_ids: string[];
}

// After
interface AuthSession {
  user_id: string;
  email: string;
  installation_ids: string[];
  is_admin: boolean;        // NEW: admin flag
  admin_roles: string[];    // NEW: admin roles per installation (optional)
}
```

**Update session verification** to read `is_admin` from `insights_users`:

```typescript
export async function getSession(req: Request): Promise<AuthSession | null> {
  const session = getSessionCookie(req); // existing logic
  if (!session) return null;

  // Fetch user from DB
  const user = await db.query(
    'SELECT id, email, is_admin FROM insights_users WHERE id = $1',
    [session.user_id]
  );

  return {
    user_id: user.id,
    email: user.email,
    installation_ids: session.installation_ids,
    is_admin: user.is_admin,  // NEW
    admin_roles: [], // Phase 2 enhancement
  };
}
```

---

### Step 3: Create Admin Middleware (45 minutes)

**File**: `src/lib/admin-middleware.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from './session-auth';

/**
 * Middleware for admin routes.
 * Enforces:
 * 1. Valid session OR admin bearer token
 * 2. User has is_admin = true
 * Returns 401 (no auth) or 403 (not admin)
 */
export async function requireAdminSession(req: NextRequest) {
  const session = await getSession(req);

  // Check session
  if (!session) {
    // Fallback: check for bearer token (X-Admin-Token)
    const token = req.headers.get('x-admin-token');
    if (!token) {
      return {
        authorized: false,
        status: 401,
        message: 'Unauthorized: no session or admin token',
      };
    }
    // Phase 3: implement bearer token validation
    // For now, deny
    return {
      authorized: false,
      status: 401,
      message: 'Bearer token not yet implemented',
    };
  }

  // Check admin flag
  if (!session.is_admin) {
    return {
      authorized: false,
      status: 403,
      message: 'Forbidden: user is not admin',
    };
  }

  return {
    authorized: true,
    session,
  };
}

/**
 * Response builder for auth errors
 */
export function adminAuthError(status: 401 | 403, message: string) {
  return NextResponse.json(
    { error: message },
    { status }
  );
}
```

**File**: `src/lib/audit-log.ts` (NEW)

```typescript
import { sql } from '@vercel/postgres';

export interface AdminAction {
  admin_user_id: string;
  action: string; // 'create_installation', 'update_installation', etc.
  resource_type: string; // 'installation', 'user', 'api_key'
  resource_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
}

export async function logAdminAction(action: AdminAction) {
  try {
    await sql`
      INSERT INTO insights_admin_audit_log 
      (admin_user_id, action, resource_type, resource_id, details, ip_address)
      VALUES (
        ${action.admin_user_id},
        ${action.action},
        ${action.resource_type},
        ${action.resource_id || null},
        ${JSON.stringify(action.details || {})},
        ${action.ip_address || null}
      )
    `;
  } catch (error) {
    console.error('Failed to log admin action:', error);
    // Don't throw — logging should not block the main operation
  }
}
```

---

### Step 4: Backend API Routes (Phase 1) (2 hours)

Create these routes under `src/app/api/v1/admin/`:

#### 4a. Installations List & Create

**File**: `src/app/api/v1/admin/installations/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, adminAuthError } from '@/lib/admin-middleware';
import { logAdminAction } from '@/lib/audit-log';
import { sql } from '@vercel/postgres';

export async function GET(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.authorized) return adminAuthError(auth.status as any, auth.message);

  const { searchParams } = new URL(req.url);
  const skip = parseInt(searchParams.get('skip') || '0', 10);
  const take = parseInt(searchParams.get('take') || '50', 10);
  const status = searchParams.get('status'); // 'connected' | 'degraded' | 'offline'

  // Fetch installations with health snapshot
  const result = await sql`
    SELECT 
      id,
      label,
      environment,
      tier,
      contact_email,
      active,
      created_at,
      -- Compute status based on health metrics
      CASE 
        WHEN error_rate > 0.1 THEN 'degraded'
        WHEN error_rate IS NULL THEN 'offline'
        ELSE 'connected'
      END as status,
      last_synced_at,
      message_count_24h,
      error_rate
    FROM insights_installations
    WHERE active = true
    ORDER BY created_at DESC
    LIMIT ${take} OFFSET ${skip}
  `;

  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.authorized) return adminAuthError(auth.status as any, auth.message);

  const body = await req.json();
  const { label, environment, tier, contact_email } = body;

  // Validate required fields
  if (!label || !environment || !tier) {
    return NextResponse.json(
      { error: 'Missing required fields: label, environment, tier' },
      { status: 400 }
    );
  }

  // Generate new API key
  const apiKey = `sk-${crypto.randomUUID()}`;
  const keyHash = await hashApiKey(apiKey); // Implement hashing

  const result = await sql`
    INSERT INTO insights_installations 
    (label, environment, tier, contact_email, api_key_hash, active)
    VALUES (${label}, ${environment}, ${tier}, ${contact_email || null}, ${keyHash}, true)
    RETURNING id
  `;

  const installationId = result.rows[0].id;

  // Log action
  await logAdminAction({
    admin_user_id: auth.session.user_id,
    action: 'create_installation',
    resource_type: 'installation',
    resource_id: installationId,
    details: { label, environment, tier },
  });

  // Return key ONCE (never stored in plain text)
  return NextResponse.json(
    { installation_id: installationId, api_key: apiKey },
    { status: 201 }
  );
}
```

#### 4b. Installation Detail & Update

**File**: `src/app/api/v1/admin/installations/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, adminAuthError } from '@/lib/admin-middleware';
import { logAdminAction } from '@/lib/audit-log';
import { sql } from '@vercel/postgres';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminSession(req);
  if (!auth.authorized) return adminAuthError(auth.status as any, auth.message);

  const result = await sql`
    SELECT * FROM insights_installations WHERE id = ${params.id}
  `;

  if (result.rowCount === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(result.rows[0]);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminSession(req);
  if (!auth.authorized) return adminAuthError(auth.status as any, auth.message);

  const body = await req.json();
  const { label, environment, tier, contact_email, active } = body;

  // Partial update
  const updates: string[] = [];
  const values: unknown[] = [];

  if (label !== undefined) {
    updates.push(`label = $${updates.length + 1}`);
    values.push(label);
  }
  if (environment !== undefined) {
    updates.push(`environment = $${updates.length + 1}`);
    values.push(environment);
  }
  if (tier !== undefined) {
    updates.push(`tier = $${updates.length + 1}`);
    values.push(tier);
  }
  if (contact_email !== undefined) {
    updates.push(`contact_email = $${updates.length + 1}`);
    values.push(contact_email);
  }
  if (active !== undefined) {
    updates.push(`active = $${updates.length + 1}`);
    values.push(active);
  }

  if (updates.length === 0) {
    return NextResponse.json(
      { error: 'No fields to update' },
      { status: 400 }
    );
  }

  values.push(params.id);
  const query = `UPDATE insights_installations SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`;

  const result = await sql.query(query, values);

  if (result.rowCount === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Log action
  await logAdminAction({
    admin_user_id: auth.session.user_id,
    action: 'update_installation',
    resource_type: 'installation',
    resource_id: params.id,
    details: body,
  });

  return NextResponse.json(result.rows[0]);
}
```

#### 4c. Health & Status

**File**: `src/app/api/v1/admin/health/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { requireAdminSession, adminAuthError } from '@/lib/admin-middleware';
import { sql } from '@vercel/postgres';

export async function GET(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.authorized) return adminAuthError(auth.status as any, auth.message);

  // Compute aggregated health metrics
  const result = await sql`
    SELECT 
      COUNT(*) as total_installations,
      SUM(CASE WHEN error_rate <= 0.01 THEN 1 ELSE 0 END) as connected,
      SUM(CASE WHEN error_rate > 0.01 AND error_rate <= 0.1 THEN 1 ELSE 0 END) as degraded,
      SUM(CASE WHEN error_rate > 0.1 OR error_rate IS NULL THEN 1 ELSE 0 END) as offline,
      COALESCE(SUM(message_count_24h), 0) as total_messages_24h,
      ROUND(COALESCE(AVG(error_rate), 0)::numeric, 2) as avg_error_rate
    FROM insights_installations
    WHERE active = true
  `;

  // Check Postgres connectivity
  const healthCheck = await sql`SELECT 1`;
  const pgOk = healthCheck.rowCount > 0;

  return NextResponse.json({
    ...result.rows[0],
    postgres_connection_ok: pgOk,
    postgres_latency_ms: 5, // TODO: measure actual latency
  });
}
```

**File**: `src/app/api/v1/admin/installations/[id]/health/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { requireAdminSession, adminAuthError } from '@/lib/admin-middleware';
import { sql } from '@vercel/postgres';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminSession(req);
  if (!auth.authorized) return adminAuthError(auth.status as any, auth.message);

  const days = parseInt(new URL(req.url).searchParams.get('days') || '7', 10);

  const result = await sql`
    SELECT 
      id,
      label,
      message_count_24h,
      error_rate,
      last_synced_at,
      CASE 
        WHEN error_rate <= 0.01 THEN 'connected'
        WHEN error_rate > 0.01 AND error_rate <= 0.1 THEN 'degraded'
        ELSE 'offline'
      END as status
    FROM insights_installations
    WHERE id = ${params.id} AND active = true
  `;

  if (result.rowCount === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(result.rows[0]);
}
```

---

### Step 5: Admin Layout & Navigation (1 hour)

**File**: `src/app/admin/layout.tsx` (NEW)

```typescript
import { getSession } from '@/lib/session-auth';
import { redirect } from 'next/navigation';
import AdminSidebar from '@/components/admin/sidebar-nav';

export const metadata = {
  title: 'Admin — Latero Control',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // Enforce admin check
  if (!session || !session.is_admin) {
    redirect('/login'); // or 403 error page
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
```

**File**: `src/components/admin/sidebar-nav.tsx` (NEW)

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Users, Key, FileText } from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/installations', label: 'Installations', icon: Building2 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/api-keys', label: 'API Keys', icon: Key },
  { href: '/admin/audit', label: 'Audit Log', icon: FileText },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-gray-200 bg-white p-6">
      <h1 className="mb-8 text-xl font-bold">Latero Admin</h1>
      <nav className="space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 rounded px-4 py-2 text-sm
                ${isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

---

### Step 6: Admin Pages (Phase 1) (2 hours)

**File**: `src/app/admin/page.tsx` (Overview Dashboard)

```typescript
import { getSession } from '@/lib/session-auth';
import HealthOverview from '@/components/admin/health-overview';

export default async function AdminDashboard() {
  const session = await getSession();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of all installations</p>
      </div>

      <HealthOverview />
    </div>
  );
}
```

**File**: `src/app/admin/installations/page.tsx` (List & Create)

```typescript
'use client';

import { useState } from 'react';
import { useAdminInstallations, useCreateInstallation } from '@/hooks/use-admin-installations';
import InstallationList from '@/components/admin/installation-list';
import CreateInstallationModal from '@/components/admin/create-installation-modal';

export default function InstallationsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: installations, isLoading } = useAdminInstallations();
  const createMutation = useCreateInstallation();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Installations</h1>
          <p className="text-gray-600 mt-1">Manage all installations</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create Installation
        </button>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <InstallationList installations={installations || []} />
      )}

      {isCreateOpen && (
        <CreateInstallationModal
          onClose={() => setIsCreateOpen(false)}
          onSubmit={async (data) => {
            await createMutation.mutateAsync(data);
            setIsCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}
```

**File**: `src/app/admin/installations/[id]/page.tsx` (Detail View)

```typescript
'use client';

import { useAdminInstallation, useUpdateInstallation } from '@/hooks/use-admin-installations';
import { useParams } from 'next/navigation';
import InstallationDetailForm from '@/components/admin/installation-detail-form';
import HealthStatus from '@/components/admin/health-status';

export default function InstallationDetailPage() {
  const { id } = useParams();
  const { data: installation, isLoading } = useAdminInstallation(id as string);
  const updateMutation = useUpdateInstallation(id as string);

  if (isLoading) return <div>Loading...</div>;
  if (!installation) return <div>Installation not found</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{installation.label || 'Unnamed'}</h1>
        <p className="text-gray-600 mt-1">Manage installation settings and health</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Edit form */}
        <div className="lg:col-span-2">
          <InstallationDetailForm
            installation={installation}
            onSubmit={(data) => updateMutation.mutateAsync(data)}
          />
        </div>

        {/* Health sidebar */}
        <div>
          <HealthStatus installationId={id as string} />
        </div>
      </div>
    </div>
  );
}
```

**File**: `src/app/admin/users/page.tsx` (Placeholder)

```typescript
export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-gray-600 mt-1">User management coming in Phase 2</p>
      </div>
    </div>
  );
}
```

Similarly create placeholders for `/admin/api-keys/page.tsx` and `/admin/audit/page.tsx`.

---

### Step 7: TanStack Query Hooks (45 minutes)

**File**: `src/hooks/use-admin-installations.ts` (NEW)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export function useAdminInstallations() {
  return useQuery({
    queryKey: ['admin', 'installations'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/admin/installations');
      return response.data;
    },
  });
}

export function useAdminInstallation(id: string) {
  return useQuery({
    queryKey: ['admin', 'installations', id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/v1/admin/installations/${id}`);
      return response.data;
    },
  });
}

export function useCreateInstallation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      label: string;
      environment: string;
      tier: string;
      contact_email?: string;
    }) => {
      const response = await apiClient.post('/api/v1/admin/installations', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'installations'] });
    },
  });
}

export function useUpdateInstallation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<any>) => {
      const response = await apiClient.patch(
        `/api/v1/admin/installations/${id}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'installations', id],
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'installations'] });
    },
  });
}

export function useAdminHealth() {
  return useQuery({
    queryKey: ['admin', 'health'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/admin/health');
      return response.data;
    },
  });
}
```

---

### Step 8: Reusable Components (Phase 1) (1 hour)

**File**: `src/components/admin/health-badge.tsx`

```typescript
interface HealthBadgeProps {
  status: 'connected' | 'degraded' | 'offline';
}

export default function HealthBadge({ status }: HealthBadgeProps) {
  const styles = {
    connected: 'bg-emerald-100 text-emerald-800',
    degraded: 'bg-yellow-100 text-yellow-800',
    offline: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${styles[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
```

**File**: `src/components/admin/form-input.tsx`

```typescript
interface FormInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function FormInput({ label, ...props }: FormInputProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        {...props}
        className="w-full px-3 py-2 border border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}
```

---

## Key Guardrails

1. **Auth is mandatory**: Every admin route MUST call `requireAdminSession()` first.
2. **Log all mutations**: Use `logAdminAction()` for create/update/delete.
3. **API keys shown once**: Never retrieve plain API keys from the database.
4. **No direct customer data access**: Admin can see installations but must use InstallationPicker to access dashboard.
5. **Soft-delete only**: Never hard-delete installations; set `active = false`.
6. **Partial updates**: Use PATCH, not PUT, for flexibility.

---

## Testing Checklist (Before Merging)

- [ ] Create admin user in database: `UPDATE insights_users SET is_admin = true WHERE email = 'admin@example.com'`
- [ ] Login as admin; `/admin` loads without redirect
- [ ] Login as non-admin; `/admin` redirects to 403
- [ ] Create installation via form; check `insights_installations` table
- [ ] Edit installation; verify audit log entry
- [ ] Verify health metrics computed correctly
- [ ] Run `npm run build` — zero errors
- [ ] Test pagination (if > 50 installations)

---

## References

- **[LADR-028](../decisions/20260425-admin-dashboard-architecture.md)** — Full architecture decision
- **[admin-implementation-checklist.md](./admin-implementation-checklist.md)** — Phase 2 & 3 details
- **[admin-dashboard-feature.md](./admin-dashboard-feature.md)** — UX patterns & design
- **[LINS-010–LINS-014](./current-product-requirements.md#L100)** — Normative requirements

---

**Next**: After Phase 1 completes, move to [User Management & API Key Rotation (Phase 2)](./admin-implementation-checklist.md#phase-2--week-2).
