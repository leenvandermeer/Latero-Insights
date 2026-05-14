"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, Pencil, Plus, Shield, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import {
  useAdminInstallations,
  useAdminUsers,
  useCreateAdminUser,
  useDeactivateAdminUser,
  useResetAdminUserPassword,
  useUpdateAdminUser,
  useResetAdmin2FA,
} from "@/hooks/use-admin";
import type { AdminPasswordResetResult, AdminUser, AdminUserProvisionResult } from "@/types/admin";
import { AdminPageHeader, AdminSectionTitle, AdminStatCard, AdminSurface } from "@/components/admin/admin-ui";

type InstallationEntry = { installation_id: string; role: "member" | "admin" };

function TenantAccessList({
  installations,
  entries,
  labelMap,
  filtered,
  query,
  onQueryChange,
  onToggle,
  onRoleChange,
  error,
}: {
  installations: { installation_id: string; label: string | null; environment: string }[];
  entries: InstallationEntry[];
  labelMap: Record<string, string>;
  filtered: typeof installations;
  query: string;
  onQueryChange: (v: string) => void;
  onToggle: (id: string) => void;
  onRoleChange: (id: string, role: "member" | "admin") => void;
  error: boolean;
}) {
  const checkedIds = new Set(entries.map((e) => e.installation_id));
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>Tenant access</p>
      <input
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search tenants"
        className="mt-2 w-full rounded-xl px-3 py-2 text-sm"
        style={{ border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)" }}
      />
      {installations.length > 0 ? (
        <div className="mt-2 max-h-52 space-y-2 overflow-y-auto">
          {filtered.map((inst) => {
            const checked = checkedIds.has(inst.installation_id);
            const entry = entries.find((e) => e.installation_id === inst.installation_id);
            return (
              <div
                key={inst.installation_id}
                className="rounded-xl px-3 py-2 text-sm"
                style={{ border: `1px solid ${checked ? "var(--color-brand)" : "var(--color-border)"}`, background: "var(--color-card)" }}
              >
                <label className="flex cursor-pointer items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium" style={{ color: "var(--color-text)" }}>
                      {inst.label ?? inst.installation_id}
                    </p>
                    <p className="truncate text-xs" style={{ color: "var(--color-text-subtle)" }}>
                      {inst.environment} · {inst.installation_id}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(inst.installation_id)}
                    className="shrink-0"
                  />
                </label>
                {checked && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Role:</span>
                    <select
                      value={entry?.role ?? "member"}
                      onChange={(e) => onRoleChange(inst.installation_id, e.target.value as "member" | "admin")}
                      className="rounded-lg px-2 py-1 text-xs font-medium"
                      style={{ border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)" }}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="rounded-xl border px-3 py-3 text-sm" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
              No tenants match this search.
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2 rounded-xl border px-3 py-3 text-sm" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
          No tenants available for assignment.
        </div>
      )}
      {error && (
        <p className="mt-2 text-xs" style={{ color: "var(--color-text-subtle)" }}>
          Tenant catalog could not be loaded. Showing known assignments only.
        </p>
      )}
    </div>
  );
}

function PlatformAdminToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="rounded-2xl border p-3"
      style={{
        borderColor: checked ? "var(--color-warning)" : "var(--color-border)",
        background: checked ? "var(--color-warning-bg)" : "var(--color-surface)",
      }}
    >
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <Shield className="h-4 w-4" style={{ color: checked ? "var(--color-warning-text)" : "var(--color-text-muted)" }} />
        <span className="text-sm font-medium" style={{ color: checked ? "var(--color-warning-text)" : "var(--color-text)" }}>
          Platform administrator
        </span>
      </label>
      {checked && (
        <p className="mt-2 text-xs" style={{ color: "var(--color-warning-text)" }}>
          Platform administrators have full access to all tenants and this admin console. Only grant this to operators who need it.
        </p>
      )}
    </div>
  );
}

function UserRow({
  user,
  labelMap,
  onEdit,
  onResetPassword,
  onReset2FA,
  onDeactivate,
  resetPasswordPending,
  reset2FAPending,
  deactivatePending,
}: {
  user: AdminUser;
  labelMap: Record<string, string>;
  onEdit: (u: AdminUser) => void;
  onResetPassword: (u: AdminUser) => void;
  onReset2FA: (u: AdminUser) => void;
  onDeactivate: (u: AdminUser) => void;
  resetPasswordPending: boolean;
  reset2FAPending: boolean;
  deactivatePending: boolean;
}) {
  return (
    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
      <td className="px-6 py-3" style={{ color: "var(--color-text)" }}>{user.email}</td>
      <td className="px-6 py-3">
        <div className="flex flex-wrap gap-1.5">
          {user.installations.map((m) => (
            <span
              key={`${user.user_id}-${m.installation_id}`}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs"
              style={{ background: "var(--color-surface)", color: "var(--color-text-muted)" }}
              title={m.installation_id}
            >
              {labelMap[m.installation_id] ?? m.installation_id}
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                style={
                  m.role === "admin"
                    ? { background: "var(--color-warning-bg)", color: "var(--color-warning-text)" }
                    : { background: "var(--color-surface)", color: "var(--color-text-subtle)" }
                }
              >
                {m.role}
              </span>
            </span>
          ))}
        </div>
      </td>
      <td className="px-6 py-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onEdit(user)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit access
          </button>
          <button
            onClick={() => onResetPassword(user)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
            disabled={resetPasswordPending}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Reset password
          </button>
          {user.two_factor_enabled && (
            <button
              onClick={() => onReset2FA(user)}
              className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium hover:opacity-80 transition-opacity"
              style={{ borderColor: "var(--color-warning)", color: "var(--color-warning-text, #92400e)" }}
              disabled={reset2FAPending}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Reset 2FA
            </button>
          )}
          <button
            onClick={() => onDeactivate(user)}
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium hover:opacity-80 transition-opacity"
            style={{ borderColor: "var(--color-error)", color: "var(--color-error)" }}
            disabled={deactivatePending}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminUsersPage() {
  const { data: usersData, isLoading } = useAdminUsers();
  const { data: installationsData, error: installationsError } = useAdminInstallations(0, 200);
  const createUserMutation = useCreateAdminUser();
  const updateUserMutation = useUpdateAdminUser();
  const resetPasswordMutation = useResetAdminUserPassword();
  const deactivateUserMutation = useDeactivateAdminUser();
  const reset2FAMutation = useResetAdmin2FA();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<AdminUser | null>(null);
  const [reset2FATarget, setReset2FATarget] = useState<AdminUser | null>(null);
  const [generatedCredentials, setGeneratedCredentials] = useState<AdminUserProvisionResult | null>(null);
  const [resetResult, setResetResult] = useState<AdminPasswordResetResult | null>(null);
  const [deactivationMessage, setDeactivationMessage] = useState<string | null>(null);
  const [createTenantQuery, setCreateTenantQuery] = useState("");
  const [editTenantQuery, setEditTenantQuery] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    generatePassword: true,
    isAdmin: false,
    installations: [] as InstallationEntry[],
  });
  const [editFormData, setEditFormData] = useState({
    isAdmin: false,
    installations: [] as InstallationEntry[],
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const installationId = params.get("installation_id")?.trim();
    if (!installationId) return;
    setFormData((prev) => {
      if (prev.installations.some((e) => e.installation_id === installationId)) return prev;
      return { ...prev, installations: [...prev.installations, { installation_id: installationId, role: "member" }] };
    });
  }, []);

  const allUsers = usersData?.users ?? [];
  const platformAdmins = allUsers.filter((u) => u.is_admin);
  const regularUsers = allUsers.filter((u) => !u.is_admin);

  const installations = useMemo(() => {
    if ((installationsData?.installations?.length ?? 0) > 0) {
      return installationsData?.installations ?? [];
    }
    const seen = new Set<string>();
    const fallback = [] as Array<{
      installation_id: string;
      label: string | null;
      environment: string;
      tier: string;
      active: boolean;
      status: "connected" | "degraded" | "offline" | "unknown" | "inactive";
      message_count_24h: number;
      error_rate_pct: number;
      user_count: number;
    }>;
    for (const user of allUsers) {
      for (const membership of user.installations) {
        if (seen.has(membership.installation_id)) continue;
        seen.add(membership.installation_id);
        fallback.push({
          installation_id: membership.installation_id,
          label: membership.installation_id,
          environment: membership.installation_id.split("_")[0] ?? "tenant",
          tier: "unknown",
          active: true,
          status: "unknown",
          message_count_24h: 0,
          error_rate_pct: 0,
          user_count: 0,
        });
      }
    }
    return fallback;
  }, [allUsers, installationsData?.installations]);

  const installationLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const inst of installations) map[inst.installation_id] = inst.label ?? inst.installation_id;
    return map;
  }, [installations]);

  const filteredCreateInstallations = useMemo(() => {
    const q = createTenantQuery.trim().toLowerCase();
    if (!q) return installations;
    return installations.filter((i) =>
      [i.label ?? "", i.installation_id, i.environment].join(" ").toLowerCase().includes(q),
    );
  }, [createTenantQuery, installations]);

  const filteredEditInstallations = useMemo(() => {
    const q = editTenantQuery.trim().toLowerCase();
    if (!q) return installations;
    return installations.filter((i) =>
      [i.label ?? "", i.installation_id, i.environment].join(" ").toLowerCase().includes(q),
    );
  }, [editTenantQuery, installations]);

  const toggleInstallation = (id: string) => {
    setFormData((prev) => {
      if (prev.installations.some((e) => e.installation_id === id)) {
        return { ...prev, installations: prev.installations.filter((e) => e.installation_id !== id) };
      }
      return { ...prev, installations: [...prev.installations, { installation_id: id, role: "member" }] };
    });
  };

  const setInstallationRole = (id: string, role: "member" | "admin") => {
    setFormData((prev) => ({
      ...prev,
      installations: prev.installations.map((e) => e.installation_id === id ? { ...e, role } : e),
    }));
  };

  const toggleEditInstallation = (id: string) => {
    setEditFormData((prev) => {
      if (prev.installations.some((e) => e.installation_id === id)) {
        return { ...prev, installations: prev.installations.filter((e) => e.installation_id !== id) };
      }
      return { ...prev, installations: [...prev.installations, { installation_id: id, role: "member" }] };
    });
  };

  const setEditInstallationRole = (id: string, role: "member" | "admin") => {
    setEditFormData((prev) => ({
      ...prev,
      installations: prev.installations.map((e) => e.installation_id === id ? { ...e, role } : e),
    }));
  };

  const resetForm = () => {
    setFormData({ email: "", password: "", generatePassword: true, isAdmin: false, installations: [] });
    setCreateTenantQuery("");
  };

  const openEditModal = (user: AdminUser) => {
    setEditingUser(user);
    setEditFormData({
      isAdmin: user.is_admin,
      installations: user.installations.map((m) => ({
        installation_id: m.installation_id,
        role: m.role === "admin" ? "admin" : "member",
      })),
    });
    setEditTenantQuery("");
    setShowEditModal(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await createUserMutation.mutateAsync({
      email: formData.email.trim(),
      password: formData.generatePassword ? undefined : formData.password,
      generate_password: formData.generatePassword,
      installations: formData.installations,
      is_admin: formData.isAdmin,
    });
    setGeneratedCredentials(result);
    setShowCreateModal(false);
    resetForm();
  };

  const handleCopy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); } catch { /* ignored */ }
  };

  const handleUpdateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;
    await updateUserMutation.mutateAsync({
      userId: editingUser.user_id,
      installations: editFormData.installations,
      is_admin: editFormData.isAdmin,
    });
    setShowEditModal(false);
    setEditingUser(null);
  };

  const handleResetPassword = async (user: AdminUser) => {
    const result = await resetPasswordMutation.mutateAsync({ userId: user.user_id });
    setResetResult(result);
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    const result = await deactivateUserMutation.mutateAsync({ userId: deactivateTarget.user_id });
    setDeactivationMessage(`${result.email} is now inactive.`);
    setDeactivateTarget(null);
  };

  const confirmReset2FA = async () => {
    if (!reset2FATarget) return;
    await reset2FAMutation.mutateAsync({ userId: reset2FATarget.user_id });
    setReset2FATarget(null);
  };

  const tableHeader = (
    <thead>
      <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
        <th className="px-6 py-3 text-left font-semibold" style={{ color: "var(--color-text)" }}>Email</th>
        <th className="px-6 py-3 text-left font-semibold" style={{ color: "var(--color-text)" }}>Tenant access</th>
        <th className="px-6 py-3 text-left font-semibold" style={{ color: "var(--color-text)" }}>Actions</th>
      </tr>
    </thead>
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Access governance"
        title="Users"
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
            style={{ background: "var(--color-brand)", color: "var(--color-text-on-dark)" }}
          >
            <Plus className="h-4 w-4" />
            Onboard user
          </button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <AdminStatCard label="Provisioned users" value={allUsers.length} meta="Accounts currently managed in the platform" />
        <AdminStatCard label="Platform admins" value={platformAdmins.length} meta="Users with operator privileges" />
        <AdminStatCard label="Installations" value={installations.length} meta="Tenants available for access assignment" />
      </div>

      {generatedCredentials && (
        <div className="rounded-3xl border p-5" style={{ borderColor: "var(--color-success)", backgroundColor: "var(--color-success-bg)" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--color-success-text)" }}>User provisioned</p>
              <p className="text-sm" style={{ color: "var(--color-success-text)", opacity: 0.9 }}>
                {generatedCredentials.user.email} is now assigned to {generatedCredentials.user.installations.length} installation(s).
              </p>
            </div>
            <button
              onClick={() => setGeneratedCredentials(null)}
              className="rounded-full border px-3 py-1.5 text-xs font-medium hover:opacity-80 transition-opacity"
              style={{ borderColor: "var(--color-success-text)", color: "var(--color-success-text)" }}
            >
              Dismiss
            </button>
          </div>
          {generatedCredentials.password_generated && generatedCredentials.temporary_password && (
            <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: "var(--color-success)", background: "var(--color-card)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>Temporary password (one-time share)</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="truncate font-mono text-sm" style={{ color: "var(--color-text)" }}>{generatedCredentials.temporary_password}</p>
                <button
                  onClick={() => handleCopy(generatedCredentials.temporary_password ?? "")}
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-medium"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {resetResult && (
        <div className="rounded-3xl border p-5" style={{ borderColor: "var(--color-warning)", backgroundColor: "var(--color-warning-bg)" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--color-warning-text)" }}>Password reset completed</p>
              <p className="text-sm" style={{ color: "var(--color-warning-text)", opacity: 0.9 }}>{resetResult.email} received a new temporary credential.</p>
            </div>
            <button
              onClick={() => setResetResult(null)}
              className="rounded-full border px-3 py-1.5 text-xs font-medium hover:opacity-80 transition-opacity"
              style={{ borderColor: "var(--color-warning-text)", color: "var(--color-warning-text)" }}
            >
              Dismiss
            </button>
          </div>
          {resetResult.temporary_password && (
            <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: "var(--color-warning)", background: "var(--color-card)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>Temporary password</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="truncate font-mono text-sm" style={{ color: "var(--color-text)" }}>{resetResult.temporary_password}</p>
                <button
                  onClick={() => handleCopy(resetResult.temporary_password ?? "")}
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-medium"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-[28px] p-5" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-card)" }}>
            <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--color-text)" }}>
              <UserPlus className="h-5 w-5" />
              New user
            </h2>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  className="mt-1 w-full rounded-xl px-3 py-2"
                  style={{ border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)" }}
                  required
                />
              </div>

              <div className="rounded-2xl border p-3" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
                <label className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  <input
                    type="checkbox"
                    checked={formData.generatePassword}
                    onChange={(e) => setFormData((prev) => ({ ...prev, generatePassword: e.target.checked }))}
                  />
                  Generate temporary password automatically
                </label>
                {!formData.generatePassword && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>Password</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                      className="mt-1 w-full rounded-xl px-3 py-2"
                      style={{ border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)" }}
                      minLength={8}
                      required
                    />
                  </div>
                )}
              </div>

              <TenantAccessList
                installations={installations}
                entries={formData.installations}
                labelMap={installationLabelMap}
                filtered={filteredCreateInstallations}
                query={createTenantQuery}
                onQueryChange={setCreateTenantQuery}
                onToggle={toggleInstallation}
                onRoleChange={setInstallationRole}
                error={!!installationsError}
              />

              <PlatformAdminToggle
                checked={formData.isAdmin}
                onChange={(v) => setFormData((prev) => ({ ...prev, isAdmin: v }))}
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-full py-2.5 text-sm font-semibold disabled:opacity-50"
                  style={{ background: "var(--color-brand)", color: "var(--color-text-on-dark)" }}
                  disabled={createUserMutation.isPending || formData.installations.length === 0}
                >
                  {createUserMutation.isPending ? "Provisioning..." : "Provision user"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className="flex-1 rounded-full py-2.5 text-sm font-semibold"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-[28px] p-5" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-card)" }}>
            <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--color-text)" }}>
              <Pencil className="h-5 w-5" />
              Edit access
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>{editingUser.email}</p>

            <form onSubmit={handleUpdateUser} className="mt-4 space-y-3">
              <TenantAccessList
                installations={installations}
                entries={editFormData.installations}
                labelMap={installationLabelMap}
                filtered={filteredEditInstallations}
                query={editTenantQuery}
                onQueryChange={setEditTenantQuery}
                onToggle={toggleEditInstallation}
                onRoleChange={setEditInstallationRole}
                error={!!installationsError}
              />

              <PlatformAdminToggle
                checked={editFormData.isAdmin}
                onChange={(v) => setEditFormData((prev) => ({ ...prev, isAdmin: v }))}
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-full py-2.5 text-sm font-semibold disabled:opacity-50"
                  style={{ background: "var(--color-brand)", color: "var(--color-text-on-dark)" }}
                  disabled={updateUserMutation.isPending || editFormData.installations.length === 0}
                >
                  {updateUserMutation.isPending ? "Saving..." : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingUser(null); }}
                  className="flex-1 rounded-full py-2.5 text-sm font-semibold"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {createUserMutation.error && (
        <div className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--color-error)", backgroundColor: "var(--color-error-bg)", color: "var(--color-error-text)" }}>
          {(createUserMutation.error as Error).message}
        </div>
      )}
      {updateUserMutation.error && (
        <div className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--color-error)", backgroundColor: "var(--color-error-bg)", color: "var(--color-error-text)" }}>
          {(updateUserMutation.error as Error).message}
        </div>
      )}
      {resetPasswordMutation.error && (
        <div className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--color-error)", backgroundColor: "var(--color-error-bg)", color: "var(--color-error-text)" }}>
          {(resetPasswordMutation.error as Error).message}
        </div>
      )}
      {deactivateUserMutation.error && (
        <div className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--color-error)", backgroundColor: "var(--color-error-bg)", color: "var(--color-error-text)" }}>
          {(deactivateUserMutation.error as Error).message}
        </div>
      )}
      {deactivationMessage && (
        <div className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--color-success)", backgroundColor: "var(--color-success-bg)", color: "var(--color-success-text)" }}>
          {deactivationMessage}
        </div>
      )}

      {/* Deactivate confirm dialog */}
      {deactivateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-[28px] p-5" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-card)" }}>
            <h3 className="mb-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>Remove user?</h3>
            <p className="mb-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
              <span className="font-semibold">{deactivateTarget.email}</span> will be set to inactive and all active sessions will be revoked.
            </p>
            <p className="mb-5 text-xs" style={{ color: "var(--color-text-subtle)" }}>This action cannot be undone from the UI.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeactivateTarget(null)}
                className="rounded-full px-3 py-1.5 text-xs font-medium"
                style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeactivate}
                disabled={deactivateUserMutation.isPending}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                style={{ background: "var(--color-error, #dc2626)" }}
              >
                {deactivateUserMutation.isPending ? "Removing..." : "Remove user"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset 2FA confirm dialog */}
      {reset2FATarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-[28px] p-5" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-card)" }}>
            <h3 className="mb-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>Reset 2FA?</h3>
            <p className="mb-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
              This will remove the 2FA configuration for <span className="font-semibold">{reset2FATarget.email}</span>. They will need to set up 2FA again on next login.
            </p>
            <p className="mb-5 text-xs" style={{ color: "var(--color-text-subtle)" }}>Use this when a user has lost access to their authenticator app.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReset2FATarget(null)}
                className="rounded-full px-3 py-1.5 text-xs font-medium"
                style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmReset2FA}
                disabled={reset2FAMutation.isPending}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                style={{ background: "var(--color-warning, #d97706)" }}
              >
                {reset2FAMutation.isPending ? "Resetting..." : "Reset 2FA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Platform Administrators */}
      {platformAdmins.length > 0 && (
        <AdminSurface className="p-5 md:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4" style={{ color: "var(--color-warning-text)" }} />
            <AdminSectionTitle title="Platform administrators" />
          </div>
          <p className="mb-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
            These users have operator-level access to all tenants and this admin console.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {tableHeader}
              <tbody>
                {platformAdmins.map((user) => (
                  <UserRow
                    key={user.user_id}
                    user={user}
                    labelMap={installationLabelMap}
                    onEdit={openEditModal}
                    onResetPassword={handleResetPassword}
                    onReset2FA={setReset2FATarget}
                    onDeactivate={setDeactivateTarget}
                    resetPasswordPending={resetPasswordMutation.isPending}
                    reset2FAPending={reset2FAMutation.isPending}
                    deactivatePending={deactivateUserMutation.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </AdminSurface>
      )}

      {/* All users */}
      <AdminSurface className="p-5 md:p-6">
        <AdminSectionTitle title="Users" />
        {isLoading ? (
          <div className="p-6 text-center" style={{ color: "var(--color-text-muted)" }}>Loading...</div>
        ) : regularUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {tableHeader}
              <tbody>
                {regularUsers.map((user) => (
                  <UserRow
                    key={user.user_id}
                    user={user}
                    labelMap={installationLabelMap}
                    onEdit={openEditModal}
                    onResetPassword={handleResetPassword}
                    onReset2FA={setReset2FATarget}
                    onDeactivate={setDeactivateTarget}
                    resetPasswordPending={resetPasswordMutation.isPending}
                    reset2FAPending={reset2FAMutation.isPending}
                    deactivatePending={deactivateUserMutation.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : !isLoading && allUsers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto h-12 w-12" style={{ color: "var(--color-text-subtle)" }} />
            <p className="mt-3" style={{ color: "var(--color-text-muted)" }}>No users found</p>
          </div>
        ) : (
          <div className="p-6 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
            All users have platform admin privileges. See the section above.
          </div>
        )}
      </AdminSurface>
    </div>
  );
}
