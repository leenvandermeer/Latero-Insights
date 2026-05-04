"use client";

import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  useAdminInstallations,
  useCreateInstallation,
} from "@/hooks/use-admin";
import { Building2, Plus, ExternalLink, AlertCircle, CheckCircle, Copy, UserPlus, Trash2 } from "lucide-react";
import { AdminInstallation } from "@/types/admin";

export default function AdminInstallationsPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<{
    installation_id: string;
    label: string | null;
    api_key: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    customer_name: "",
    contact_email: "",
  });

  const { data, isLoading } = useAdminInstallations(0, 100);
  const createMutation = useCreateInstallation();
  const existingCustomers = Array.from(new Set(
    (data?.installations ?? [])
      .map((inst) => (inst.label ?? "").split(" - ")[0]?.trim())
      .filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const customer = formData.customer_name.trim();
    const label = customer;
    if (!label) return;

    try {
      const result = await createMutation.mutateAsync({
        label,
        contact_email: formData.contact_email.trim() || undefined,
      }) as {
        installation_id: string;
        label: string | null;
        api_key: string;
      };
      setCreatedSecret({
        installation_id: result.installation_id,
        label: result.label ?? null,
        api_key: result.api_key,
      });
      setFormData({ customer_name: "", contact_email: "" });
      setShowCreateModal(false);
    } catch (error) {
      console.error("Failed to create installation:", error);
    }
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard permissions can fail in restricted browser contexts.
    }
  };

  const visibleInstallations = (data?.installations ?? []).filter((inst) => showArchived || inst.active);

  const handleArchiveToggle = async (installationId: string, nextActive: boolean) => {
    setArchivingId(installationId);
    try {
      const res = await fetch(`/api/v1/admin/installations/${encodeURIComponent(installationId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });

      if (!res.ok) {
        throw new Error(`Failed to update installation (${res.status})`);
      }

      await queryClient.invalidateQueries({ queryKey: ["admin", "installations"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "health"] });
    } finally {
      setArchivingId(null);
    }
  };

  const statusBadgeColor = (status: string) => {
    switch (status) {
      case "connected":
        return {backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success-text)'};
      case "degraded":
        return {backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning-text)'};
      case "offline":
        return {backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error-text)'};
      case "inactive":
        return {backgroundColor: 'var(--color-surface-alt, #f1f5f9)', color: 'var(--color-text-muted)'};
      default:
        return {backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)'};
    }
  };

  const statusIcon = (status: string) => {
    return status === "connected" ? (
      <CheckCircle className="h-4 w-4" />
    ) : status === "offline" ? (
      <AlertCircle className="h-4 w-4" />
    ) : null;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold" style={{ color: "var(--color-text)" }}>
            <Building2 className="h-8 w-8" />
            Installations
          </h1>
          <p style={{ color: "var(--color-text-muted)" }}>
            Add sites and manage customer installations
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--color-brand)" }}
        >
          <Plus className="h-4 w-4" />
          Add Site
        </button>
      </div>

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setShowArchived((value) => !value)}
          className="rounded px-3 py-1.5 text-xs font-medium"
          style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
        >
          {showArchived ? "Hide archived" : "Show archived"}
        </button>
      </div>

      {createdSecret && (
        <div className="rounded-lg border p-5" style={{borderColor: 'var(--color-success)', backgroundColor: 'var(--color-success-bg)'}}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold" style={{color: 'var(--color-success-text)'}}>Installation created</p>
              <p className="text-sm" style={{color: 'var(--color-success-text)', opacity: 0.9}}>
                {(createdSecret.label ?? createdSecret.installation_id)} is ready. Save and share this API key now.
              </p>
            </div>
            <button
              onClick={() => setCreatedSecret(null)}
              className="rounded border px-3 py-1 text-xs font-medium hover:opacity-80 transition-opacity"
              style={{borderColor: 'var(--color-success-text)', color: 'var(--color-success-text)'}}
            >
              Dismiss
            </button>
          </div>

          <div className="mt-4 rounded border bg-white p-3 dark:bg-slate-900" style={{borderColor: 'var(--color-success)'}}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">One-time API key</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="truncate font-mono text-sm text-slate-900 dark:text-slate-100">{createdSecret.api_key}</p>
              <button
                onClick={() => handleCopy(createdSecret.api_key)}
                className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/installations/${encodeURIComponent(createdSecret.installation_id)}`}
                className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-xs font-semibold hover:opacity-80 transition-opacity"
                style={{borderColor: 'var(--color-success-text)', color: 'var(--color-success-text)'}}
              >
                Open installation detail
              </Link>
              <Link
                href={`/admin/users?installation_id=${encodeURIComponent(createdSecret.installation_id)}`}
                className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-xs font-semibold hover:opacity-80 transition-opacity"
                style={{borderColor: 'var(--color-success-text)', color: 'var(--color-success-text)'}}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Continue with user onboarding
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg p-6" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <h2 className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
              Add Site
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Customer
                </label>
                <input
                  type="text"
                  list="existing-customers"
                  value={formData.customer_name}
                  onChange={(e) =>
                    setFormData({ ...formData, customer_name: e.target.value })
                  }
                  placeholder="Acme Corp"
                  className="mt-1 w-full rounded px-3 py-2"
                  style={{ border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)" }}
                  required
                />
                <datalist id="existing-customers">
                  {existingCustomers.map((customer) => (
                    <option key={customer} value={customer} />
                  ))}
                </datalist>
              </div>



              <div>
                <label className="block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Contact Email (Optional)
                </label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_email: e.target.value })
                  }
                  className="mt-1 w-full rounded px-3 py-2"
                  style={{ border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)" }}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 rounded py-2 font-medium text-white"
                  style={{ background: "var(--color-brand)" }}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Adding..." : "Add site"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded py-2 font-medium"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Installations Table */}
      <div className="rounded-lg" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
        {isLoading ? (
          <div className="p-6 text-center" style={{ color: "var(--color-text-muted)" }}>Loading...</div>
        ) : visibleInstallations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <th className="px-6 py-3 text-left font-semibold" style={{ color: "var(--color-text)" }}>
                    Label
                  </th>
                  <th className="px-6 py-3 text-left font-semibold" style={{ color: "var(--color-text)" }}>
                    Status
                  </th>
                  <th className="px-6 py-3 text-left font-semibold" style={{ color: "var(--color-text)" }}>
                    Users
                  </th>
                  <th className="px-6 py-3 text-left font-semibold" style={{ color: "var(--color-text)" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleInstallations.map((inst: AdminInstallation) => (
                  <tr
                    key={inst.installation_id}
                    style={{ borderBottom: "1px solid var(--color-border)" }}
                  >
                    <td className="px-6 py-3">
                      <Link
                        href={`/admin/installations/${inst.installation_id}`}
                        className="font-medium hover:underline"
                        style={{ color: "var(--color-text)" }}
                      >
                        {inst.label || inst.installation_id}
                      </Link>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                        style={statusBadgeColor(inst.status)}
                      >
                        {statusIcon(inst.status)}
                        {inst.status}
                      </span>
                    </td>
                    <td className="px-6 py-3" style={{ color: "var(--color-text-muted)" }}>
                      {inst.user_count}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/installations/${inst.installation_id}`}
                          className="inline-flex items-center rounded bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                        >
                          View
                        </Link>
                        <Link
                          href={`/admin/installations/${inst.installation_id}#danger-zone`}
                          className="inline-flex items-center rounded border px-3 py-1.5 text-xs font-semibold hover:opacity-80 transition-opacity"
                          style={{ borderColor: "var(--color-error, #dc2626)", color: "var(--color-error, #dc2626)" }}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Clear data
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center" style={{ color: "var(--color-text-muted)" }}>
            {showArchived ? "No installations found." : "No active installations found. Create one to get started."}
          </div>
        )}
      </div>
    </div>
  );
}
