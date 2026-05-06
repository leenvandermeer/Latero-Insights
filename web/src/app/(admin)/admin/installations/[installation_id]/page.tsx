"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Copy, Save, ShieldCheck, Trash2 } from "lucide-react";
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

  // LINS-018: Clear installation data
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearConfirmInput, setClearConfirmInput] = useState("");
  const [isClearing, setIsClearing] = useState(false);
  const [clearResult, setClearResult] = useState<{ ok: boolean; message: string } | null>(null);

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

  async function doClearData() {
    setIsClearing(true);
    setClearResult(null);
    try {
      const res = await fetch(`/api/v1/admin/installations/${installationId}/data`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: installationId }),
        credentials: "include",
      });
      const data = await res.json() as { success?: boolean; total_deleted?: number; error?: string };
      if (res.ok && data.success) {
        setClearResult({ ok: true, message: `Cleared — ${data.total_deleted ?? 0} records deleted.` });
        setShowClearConfirm(false);
        setClearConfirmInput("");
      } else {
        setClearResult({ ok: false, message: data.error ?? "Clear failed." });
      }
    } catch (err) {
      setClearResult({ ok: false, message: err instanceof Error ? err.message : "Clear failed." });
    } finally {
      setIsClearing(false);
    }
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
            className="mb-2 inline-flex items-center gap-1 text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to installations
          </Link>
          <h1 className="flex items-center gap-3 text-3xl font-bold" style={{ color: "var(--color-text)" }}>
            <Building2 className="h-8 w-8" />
            {installation.label ?? installation.installation_id}
          </h1>
          <p style={{ color: "var(--color-text-muted)" }}>
            {installation.installation_id}
          </p>
        </div>
        <Link
          href={`/admin/installations/${installation.installation_id}/auth`}
          className="inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-medium"
          style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
        >
          <ShieldCheck className="h-4 w-4" />
          Auth configuration
        </Link>
      </div>

      <div className="rounded-lg p-6" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowRotateConfirm(true)}
            disabled={rotating}
            className="rounded px-4 py-2 text-sm font-semibold text-white transition-colors"
            style={{ background: "var(--color-brand)" }}
          >
            {rotating ? "Generating..." : "Generate new API key"}
          </button>
        </div>

        {showRotateConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-xl p-6 shadow-xl" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
              <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text)" }}>Rotate API key?</h3>
              <p className="text-xs mb-5" style={{ color: "var(--color-text-muted)" }}>
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
            <div className="mt-4 rounded border p-3" style={{ background: "var(--color-surface)", borderColor: "var(--color-warning)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>API key (one-time share)</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="truncate font-mono text-sm" style={{ color: "var(--color-text)" }}>{newApiKey}</p>
                <button
                  onClick={() => navigator.clipboard.writeText(newApiKey)}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
              </div>
            </div>
          </div>
        )}
        <h2 className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>Installation settings</h2>
        <form onSubmit={handleSave} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>Label</label>
            <input
              type="text"
              value={form.label}
              onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
              className="mt-1 w-full rounded px-3 py-2"
              style={{ border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)" }}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>Contact email</label>
            <input
              type="email"
              value={form.contact_email}
              onChange={(event) => setForm((prev) => ({ ...prev, contact_email: event.target.value }))}
              className="mt-1 w-full rounded px-3 py-2"
              style={{ border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)" }}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
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
              className="inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--color-brand)" }}
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

      {/* LINS-018: Danger Zone */}
      <div id="danger-zone" className="rounded-lg border-2 p-6 space-y-4" style={{ borderColor: "var(--color-error, #dc2626)" }}>
        <div className="flex items-center gap-2">
          <Trash2 className="h-4 w-4" style={{ color: "var(--color-error, #dc2626)" }} />
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--color-error, #dc2626)" }}>
            Danger Zone
          </h2>
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>Clear operational data</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              Permanently removes all runs, entities, lineage and DQ results for this installation.
              The installation definition, users and API key are preserved. This action is irreversible.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setShowClearConfirm(true); setClearResult(null); }}
            className="shrink-0 rounded px-3 py-1.5 text-xs font-semibold text-white"
            style={{ background: "var(--color-error, #dc2626)" }}
          >
            Clear data…
          </button>
        </div>

        {clearResult && (
          <p className="text-xs" style={{ color: clearResult.ok ? "var(--color-success, #059669)" : "var(--color-error, #dc2626)" }}>
            {clearResult.message}
          </p>
        )}
      </div>

      {/* Clear data confirmation modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl p-6 shadow-xl space-y-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 shrink-0" style={{ color: "var(--color-error)" }} />
              <h3 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Clear installation data?</h3>
            </div>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              This will permanently delete all operational data for <strong>{installationId}</strong>. Runs, entities, lineage and DQ results will be erased. This cannot be undone.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                Type <code className="rounded px-1 py-0.5" style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>{installationId}</code> to confirm
              </label>
              <input
                type="text"
                value={clearConfirmInput}
                onChange={(e) => setClearConfirmInput(e.target.value)}
                className="w-full rounded px-3 py-2 text-xs"
                style={{ border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)" }}
                placeholder={installationId}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowClearConfirm(false); setClearConfirmInput(""); }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                Cancel
              </button>
              <button
                onClick={doClearData}
                disabled={clearConfirmInput !== installationId || isClearing}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                style={{ background: "var(--color-error, #dc2626)" }}
              >
                {isClearing ? "Clearing…" : "Yes, delete all data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
