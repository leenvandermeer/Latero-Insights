"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
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

export default function AdminUsersPage() {
  const { data: usersData, isLoading } = useAdminUsers();
  const { data: installationsData } = useAdminInstallations(0, 200);
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
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    generatePassword: true,
    isAdmin: false,
    installationIds: [] as string[],
  });
  const [editFormData, setEditFormData] = useState({
    isAdmin: false,
    installationIds: [] as string[],
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const installationId = params.get("installation_id")?.trim();
    if (!installationId) {
      return;
    }

    setFormData((previous) => {
      if (previous.installationIds.includes(installationId)) {
        return previous;
      }

      return {
        ...previous,
        installationIds: [...previous.installationIds, installationId],
      };
    });
  }, []);

  const installations = installationsData?.installations ?? [];

  const installationLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const inst of installations) {
      map[inst.installation_id] = inst.label ?? inst.installation_id;
    }
    return map;
  }, [installations]);

  const selectedInstallationSet = useMemo(
    () => new Set(formData.installationIds),
    [formData.installationIds],
  );

  const toggleInstallation = (installationId: string) => {
    setFormData((previous) => {
      if (previous.installationIds.includes(installationId)) {
        return {
          ...previous,
          installationIds: previous.installationIds.filter((id) => id !== installationId),
        };
      }

      return {
        ...previous,
        installationIds: [...previous.installationIds, installationId],
      };
    });
  };

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      generatePassword: true,
      isAdmin: false,
      installationIds: [],
    });
  };

  const openEditModal = (user: AdminUser) => {
    setEditingUser(user);
    setEditFormData({
      isAdmin: user.is_admin,
      installationIds: user.installations.map((installation) => installation.installation_id),
    });
    setShowEditModal(true);
  };

  const toggleEditInstallation = (installationId: string) => {
    setEditFormData((previous) => {
      if (previous.installationIds.includes(installationId)) {
        return {
          ...previous,
          installationIds: previous.installationIds.filter((id) => id !== installationId),
        };
      }

      return {
        ...previous,
        installationIds: [...previous.installationIds, installationId],
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const payload = {
      email: formData.email.trim(),
      password: formData.generatePassword ? undefined : formData.password,
      generate_password: formData.generatePassword,
      installation_ids: formData.installationIds,
      is_admin: formData.isAdmin,
    };

    const result = await createUserMutation.mutateAsync(payload);
    setGeneratedCredentials(result);
    setShowCreateModal(false);
    resetForm();
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Browser clipboard may be blocked by policy; ignore silently.
    }
  };

  const handleUpdateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingUser) {
      return;
    }

    await updateUserMutation.mutateAsync({
      userId: editingUser.user_id,
      installation_ids: editFormData.installationIds,
      is_admin: editFormData.isAdmin,
    });

    setShowEditModal(false);
    setEditingUser(null);
  };

  const handleResetPassword = async (user: AdminUser) => {
    const result = await resetPasswordMutation.mutateAsync({ userId: user.user_id });
    setResetResult(result);
  };

  const handleDeactivateUser = (user: AdminUser) => {
    setDeactivateTarget(user);
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-slate-900 dark:text-white">
            <Users className="h-8 w-8" />
            User Management
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manage users across all installations
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          <Plus className="h-4 w-4" />
          Onboard User
        </button>
      </div>

      {generatedCredentials && (
        <div className="rounded-lg border p-5" style={{borderColor: 'var(--color-success)', backgroundColor: 'var(--color-success-bg)'}}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold" style={{color: 'var(--color-success-text)'}}>User provisioned</p>
              <p className="text-sm" style={{color: 'var(--color-success-text)', opacity: 0.9}}>
                {generatedCredentials.user.email} is now assigned to {generatedCredentials.user.installations.length} installation(s).
              </p>
            </div>
            <button
              onClick={() => setGeneratedCredentials(null)}
              className="rounded border px-3 py-1 text-xs font-medium hover:opacity-80 transition-opacity"
              style={{borderColor: 'var(--color-success-text)', color: 'var(--color-success-text)'}}
            >
              Dismiss
            </button>
          </div>

          {generatedCredentials.password_generated && generatedCredentials.temporary_password && (
            <div className="mt-4 rounded border bg-white p-3 dark:bg-slate-900" style={{borderColor: 'var(--color-success)'}}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Temporary password (one-time share)</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="truncate font-mono text-sm text-slate-900 dark:text-slate-100">
                  {generatedCredentials.temporary_password}
                </p>
                <button
                  onClick={() => handleCopy(generatedCredentials.temporary_password ?? "")}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
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
        <div className="rounded-lg border p-5" style={{borderColor: 'var(--color-warning)', backgroundColor: 'var(--color-warning-bg)'}}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold" style={{color: 'var(--color-warning-text)'}}>Password reset completed</p>
              <p className="text-sm" style={{color: 'var(--color-warning-text)', opacity: 0.9}}>{resetResult.email} received a new temporary credential.</p>
            </div>
            <button
              onClick={() => setResetResult(null)}
              className="rounded border px-3 py-1 text-xs font-medium hover:opacity-80 transition-opacity"
              style={{borderColor: 'var(--color-warning-text)', color: 'var(--color-warning-text)'}}
            >
              Dismiss
            </button>
          </div>
          {resetResult.temporary_password && (
            <div className="mt-4 rounded border bg-white p-3 dark:bg-slate-900" style={{borderColor: 'var(--color-warning)'}}>

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Temporary password</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="truncate font-mono text-sm text-slate-900 dark:text-slate-100">{resetResult.temporary_password}</p>
                <button
                  onClick={() => handleCopy(resetResult.temporary_password ?? "")}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
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
          <div className="w-full max-w-xl rounded-lg bg-white p-6 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <UserPlus className="h-5 w-5" />
              Onboard User
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Create an account, assign tenant access, and optionally share a generated temporary password.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(event) => setFormData((previous) => ({ ...previous, email: event.target.value }))}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  required
                />
              </div>

              <div className="rounded border border-slate-200 p-3 dark:border-slate-700">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.generatePassword}
                    onChange={(event) => setFormData((previous) => ({ ...previous, generatePassword: event.target.checked }))}
                  />
                  Generate temporary password automatically
                </label>

                {!formData.generatePassword && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(event) => setFormData((previous) => ({ ...previous, password: event.target.value }))}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                      minLength={8}
                      required
                    />
                  </div>
                )}
              </div>

              <div className="rounded border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Tenant access</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Select one or more installations.</p>
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                  {installations.map((installation) => (
                    <label
                      key={installation.installation_id}
                      className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                    >
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {installation.label ?? installation.installation_id}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {installation.environment} · {installation.installation_id}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedInstallationSet.has(installation.installation_id)}
                        onChange={() => toggleInstallation(installation.installation_id)}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.isAdmin}
                  onChange={(event) => setFormData((previous) => ({ ...previous, isAdmin: event.target.checked }))}
                />
                <ShieldCheck className="h-4 w-4" />
                Grant admin access
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded bg-slate-900 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  disabled={createUserMutation.isPending || formData.installationIds.length === 0}
                >
                  {createUserMutation.isPending ? "Provisioning..." : "Provision user"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="flex-1 rounded border border-slate-300 py-2 font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-6 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <Pencil className="h-5 w-5" />
              Edit User Access
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {editingUser.email}
            </p>

            <form onSubmit={handleUpdateUser} className="mt-5 space-y-4">
              <div className="rounded border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Tenant access</p>
                <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
                  {installations.map((installation) => (
                    <label
                      key={`edit-${installation.installation_id}`}
                      className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                    >
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{installation.label ?? installation.installation_id}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{installation.environment} · {installation.installation_id}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={editFormData.installationIds.includes(installation.installation_id)}
                        onChange={() => toggleEditInstallation(installation.installation_id)}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={editFormData.isAdmin}
                  onChange={(event) => setEditFormData((previous) => ({ ...previous, isAdmin: event.target.checked }))}
                />
                <ShieldCheck className="h-4 w-4" />
                Grant admin access
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded bg-slate-900 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  disabled={updateUserMutation.isPending || editFormData.installationIds.length === 0}
                >
                  {updateUserMutation.isPending ? "Saving..." : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                  }}
                  className="flex-1 rounded border border-slate-300 py-2 font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {createUserMutation.error && (
        <div className="rounded-lg border p-4 text-sm" style={{borderColor: 'var(--color-error)', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error-text)'}}>
          {(createUserMutation.error as Error).message}
        </div>
      )}

      {updateUserMutation.error && (
        <div className="rounded-lg border p-4 text-sm" style={{borderColor: 'var(--color-error)', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error-text)'}}>
          {(updateUserMutation.error as Error).message}
        </div>
      )}

      {resetPasswordMutation.error && (
        <div className="rounded-lg border p-4 text-sm" style={{borderColor: 'var(--color-error)', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error-text)'}}>
          {(resetPasswordMutation.error as Error).message}
        </div>
      )}

      {deactivateUserMutation.error && (
        <div className="rounded-lg border p-4 text-sm" style={{borderColor: 'var(--color-error)', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error-text)'}}>
          {(deactivateUserMutation.error as Error).message}
        </div>
      )}

      {deactivationMessage && (
        <div className="rounded-lg border p-4 text-sm" style={{borderColor: 'var(--color-success)', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success-text)'}}>
          {deactivationMessage}
        </div>
      )}

      {/* Deactivate confirm dialog */}
      {deactivateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl p-6 shadow-xl" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
            <h3 className="text-sm font-semibold mb-1 text-slate-900 dark:text-white">Remove user?</h3>
            <p className="text-xs mb-1 text-slate-600 dark:text-slate-400">
              <span className="font-semibold">{deactivateTarget.email}</span> will be set to inactive and all active sessions will be revoked.
            </p>
            <p className="text-xs mb-5 text-slate-500 dark:text-slate-500">This action cannot be undone from the UI.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeactivateTarget(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeactivate}
                disabled={deactivateUserMutation.isPending}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
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
          <div className="w-full max-w-sm rounded-xl p-6 shadow-xl" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text)" }}>Reset 2FA?</h3>
            <p className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>
              This will remove the 2FA configuration for <span className="font-semibold">{reset2FATarget.email}</span>.
              They will need to set up 2FA again on next login.
            </p>
            <p className="text-xs mb-5" style={{ color: "var(--color-text-subtle, var(--color-text-muted))" }}>Use this when a user has lost access to their authenticator app.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReset2FATarget(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmReset2FA}
                disabled={reset2FAMutation.isPending}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                style={{ background: "var(--color-warning, #d97706)" }}
              >
                {reset2FAMutation.isPending ? "Resetting..." : "Reset 2FA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {isLoading ? (
          <div className="p-6 text-center text-slate-500">Loading...</div>
        ) : usersData?.users && usersData.users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-3 text-left font-semibold text-slate-900 dark:text-white">Email</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900 dark:text-white">Role</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900 dark:text-white">Tenant Access</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersData.users.map((user) => (
                  <tr
                    key={user.user_id}
                    className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-6 py-3 text-slate-900 dark:text-white">{user.email}</td>
                    <td className="px-6 py-3">
                      <span
                        className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={user.is_admin ? {backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning-text)'} : {}}
                      >
                        {user.is_admin ? "Admin" : "Member"}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {user.installations.map((membership) => (
                          <span
                            key={`${user.user_id}-${membership.installation_id}`}
                            className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            title={membership.installation_id}
                          >
                            {installationLabelMap[membership.installation_id] ?? membership.installation_id}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit access
                        </button>
                        <button
                          onClick={() => handleResetPassword(user)}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          disabled={resetPasswordMutation.isPending}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Reset password
                        </button>
                        {user.two_factor_enabled && (
                          <button
                            onClick={() => setReset2FATarget(user)}
                            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium hover:opacity-80 transition-opacity"
                            style={{ borderColor: "var(--color-warning)", color: "var(--color-warning-text, #92400e)" }}
                            disabled={reset2FAMutation.isPending}
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Reset 2FA
                          </button>
                        )}
                        <button
                          onClick={() => handleDeactivateUser(user)}
                          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium hover:opacity-80 transition-opacity"
                          style={{borderColor: 'var(--color-error)', color: 'var(--color-error)'}}
                          disabled={deactivateUserMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove user
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-600" />
            <p className="mt-3 text-slate-600 dark:text-slate-400">No users found</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">Onboard your first tenant user to complete customer setup.</p>
          </div>
        )}
      </div>
    </div>
  );
}
