"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Copy, Save, ShieldCheck } from "lucide-react";
import { useAdminInstallation, useUpdateInstallation } from "@/hooks/use-admin";

export default function AdminInstallationDetailPage() {
  const params = useParams<{ installation_id: string }>();
  const installationId = String(params?.installation_id ?? "");

  const { data, isLoading } = useAdminInstallation(installationId);
  const updateMutation = useUpdateInstallation(installationId);

  const installation = data?.installation;

  const [form, setForm] = useState({
    label: "",
    contact_email: "",
    active: true,
  });

  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);

  async function doRotateKey() {
    setShowRotateConfirm(false);
    setRotating(true);
    setNewApiKey(null);
    const newToken = "sk_live_" + crypto.randomUUID().replace(/-/g, "");
    const res = await fetch(`/api/v1/admin/installations/${installationId}/rotate-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_token: newToken }),
      credentials: "include",
    });
    if (res.ok) {
      setNewApiKey(newToken);
    }
    setRotating(false);
  }

  useEffect(() => {
    if (!installation) return;
    setForm({
      label: installation.label ?? "",
      contact_email: installation.contact_email ?? "",
      active: installation.active,
    });
  }, [installation]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    await updateMutation.mutateAsync({
      label: form.label,
      contact_email: form.contact_email,
      active: form.active,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading installation...</p>
      </div>
    );
  }

  if (!installation) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Installation not found</h1>
        <Link href="/admin/installations" className="text-sm text-slate-700 underline dark:text-slate-300">
          Back to installations
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/installations"
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to installations
          </Link>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-slate-900 dark:text-white">
            <Building2 className="h-8 w-8" />
            {installation.label ?? installation.installation_id}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {installation.installation_id}
          </p>
        </div>
        <Link
          href={`/admin/installations/${installation.installation_id}/auth`}
          className="inline-flex items-center gap-2 rounded border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ShieldCheck className="h-4 w-4" />
          Auth configuration
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6">
          <button
            disabled={rotating}
            className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
          >
            {rotating ? "Generating..." : "Generate new API key"}
          </button>
        </div>

        {showRotateConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-xl p-6 shadow-xl" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
              <h3 className="text-sm font-semibold mb-1 text-slate-900 dark:text-white">Rotate API key?</h3>
              <p className="text-xs mb-5 text-slate-500 dark:text-slate-400">
                The current key will be immediately invalidated. Any client using it will stop working until the new key is configured.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowRotateConfirm(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={doRotateKey}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                  style={{ background: "var(--color-error, #dc2626)" }}
                >
                  Rotate key
                </button>
              </div>
            </div>
          </div>
        )}

        {newApiKey && (
          <div className="rounded-lg border p-5 my-4" style={{borderColor: 'var(--color-warning)', backgroundColor: 'var(--color-warning-bg)'}}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold" style={{color: 'var(--color-warning-text)'}}>API key rotated</p>
                <p className="text-sm" style={{color: 'var(--color-warning-text)', opacity: 0.9}}>Share this key with the organisation. It is only visible once — the previous key is now invalid.</p>
              </div>
              <button
                onClick={() => setNewApiKey(null)}
                className="rounded border px-3 py-1 text-xs font-medium hover:opacity-80 transition-opacity"
                style={{borderColor: 'var(--color-warning-text)', color: 'var(--color-warning-text)'}}
              >
                Dismiss
              </button>
            </div>
            <div className="mt-4 rounded border bg-white p-3 dark:bg-slate-900" style={{borderColor: 'var(--color-warning)'}}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">API key (one-time share)</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="truncate font-mono text-sm text-slate-900 dark:text-slate-100">{newApiKey}</p>
                <button
                  onClick={() => navigator.clipboard.writeText(newApiKey)}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
              </div>
            </div>
          </div>
        )}
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Installation settings</h2>
        <form onSubmit={handleSave} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Label</label>
            <input
              type="text"
              value={form.label}
              onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Contact email</label>
            <input
              type="email"
              value={form.contact_email}
              onChange={(event) => setForm((prev) => ({ ...prev, contact_email: event.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
              />
              Installation active
            </label>
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="inline-flex items-center gap-2 rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              <Save className="h-4 w-4" />
              {updateMutation.isPending ? "Saving..." : "Save changes"}
            </button>

            {updateMutation.isSuccess && (
              <p className="text-sm" style={{color: 'var(--color-success)'}}>Saved</p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
