"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Key, Plus, Trash2, Copy, Check, RefreshCw, AlertTriangle } from "lucide-react";

interface Installation {
  installation_id: string;
  label: string | null;
  environment: string;
  subscription_tier: string;
  valid_until: string | null;
  active: boolean;
  created_at: string;
}

interface CreateResult {
  installation_id: string;
  environment: string;
  label: string | null;
  subscription_tier: string;
  api_key: string;
}

async function fetchInstallations(adminToken: string): Promise<Installation[]> {
  const res = await fetch("/api/v1/installations", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const data = await res.json() as { installations: Installation[] };
  return data.installations;
}

async function createInstallation(
  adminToken: string,
  payload: { installation_id: string; environment: string; label?: string; subscription_tier: string },
): Promise<CreateResult> {
  const res = await fetch("/api/v1/installations", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json() as { error: string };
    throw new Error(err.error ?? `${res.status}`);
  }
  return res.json() as Promise<CreateResult>;
}

async function revokeInstallation(adminToken: string, installationId: string): Promise<void> {
  const res = await fetch(`/api/v1/installations/${encodeURIComponent(installationId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!res.ok) throw new Error(`${res.status}`);
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="ml-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

export function InstallationsManager({ adminToken }: { adminToken: string }) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<CreateResult | null>(null);
  const [form, setForm] = useState({
    installation_id: "",
    environment: "production",
    label: "",
    subscription_tier: "trial",
  });
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const { data: installations, isLoading, error, refetch } = useQuery({
    queryKey: ["v1-installations", adminToken],
    queryFn: () => fetchInstallations(adminToken),
    enabled: !!adminToken,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) =>
      createInstallation(adminToken, {
        ...payload,
        label: payload.label || undefined,
      }),
    onSuccess: (result) => {
      setNewKey(result);
      setShowCreate(false);
      setForm({ installation_id: "", environment: "production", label: "", subscription_tier: "trial" });
      void queryClient.invalidateQueries({ queryKey: ["v1-installations"] });
    },
    onError: (err) => {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Create failed" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeInstallation(adminToken, id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["v1-installations"] }),
    onError: (err) => {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Revoke failed" });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Key size={16} className="text-[var(--color-primary)]" />
          <CardTitle className="text-sm font-semibold">API Installations</CardTitle>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void refetch()}
            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => { setShowCreate(true); setNewKey(null); }}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={12} />
            New
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">

        {/* One-time token display */}
        {newKey && (
          <div className="p-3 rounded border border-[var(--color-warning)] bg-[var(--color-warning-muted,_#fffbeb)] text-xs space-y-1">
            <div className="flex items-center gap-1 font-semibold text-[var(--color-warning)]">
              <AlertTriangle size={13} />
              Save this key — it cannot be retrieved later
            </div>
            <div className="font-mono text-[var(--color-text)] break-all">
              {newKey.api_key}
              <CopyButton value={newKey.api_key} />
            </div>
            <div className="text-[var(--color-text-muted)]">
              Installation: <span className="font-mono">{newKey.installation_id}</span>
            </div>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div
            className={`text-xs p-2 rounded ${
              feedback.type === "error"
                ? "bg-[var(--color-error-muted,_#fef2f2)] text-[var(--color-error)]"
                : "bg-[var(--color-success-muted,_#f0fdf4)] text-[var(--color-success)]"
            }`}
          >
            {feedback.message}
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <div className="p-3 rounded border border-[var(--color-border)] space-y-2 text-xs">
            <div className="font-semibold text-[var(--color-text)]">New installation</div>
            {[
              { label: "Installation ID *", key: "installation_id", placeholder: "latero-prod-nl" },
              { label: "Label", key: "label", placeholder: "Production NL" },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <div className="text-[var(--color-text-muted)] mb-0.5">{label}</div>
                <input
                  className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-xs"
                  placeholder={placeholder}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="text-[var(--color-text-muted)] mb-0.5">Environment</div>
                <select
                  className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-xs"
                  value={form.environment}
                  onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))}
                >
                  <option value="production">production</option>
                  <option value="staging">staging</option>
                  <option value="development">development</option>
                </select>
              </div>
              <div className="flex-1">
                <div className="text-[var(--color-text-muted)] mb-0.5">Tier</div>
                <select
                  className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-xs"
                  value={form.subscription_tier}
                  onChange={(e) => setForm((f) => ({ ...f, subscription_tier: e.target.value }))}
                >
                  <option value="trial">trial</option>
                  <option value="starter">starter</option>
                  <option value="enterprise">enterprise</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.installation_id || createMutation.isPending}
                className="px-3 py-1 rounded bg-[var(--color-primary)] text-white text-xs disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating…" : "Create"}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-1 rounded border border-[var(--color-border)] text-xs text-[var(--color-text-muted)]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Installations list */}
        {isLoading && <div className="text-xs text-[var(--color-text-muted)]">Loading…</div>}
        {error && (
          <div className="text-xs text-[var(--color-error)]">
            {error instanceof Error ? error.message : "Failed to load"}
          </div>
        )}
        {installations && installations.length === 0 && (
          <div className="text-xs text-[var(--color-text-muted)]">No installations yet.</div>
        )}
        {installations?.map((inst) => (
          <div
            key={inst.installation_id}
            className="flex items-center justify-between p-2 rounded border border-[var(--color-border)] text-xs"
          >
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-medium text-[var(--color-text)] truncate">
                  {inst.installation_id}
                </span>
                <Badge
                  variant={inst.active ? "success" : "error"}
                  className="text-[10px] py-0 px-1"
                >
                  {inst.active ? "active" : "revoked"}
                </Badge>
                <Badge variant="muted" className="text-[10px] py-0 px-1">
                  {inst.subscription_tier}
                </Badge>
              </div>
              <div className="text-[var(--color-text-muted)]">
                {inst.label && <span>{inst.label} · </span>}
                {inst.environment} ·{" "}
                {new Date(inst.created_at).toLocaleDateString()}
                {inst.valid_until && (
                  <span> · expires {new Date(inst.valid_until).toLocaleDateString()}</span>
                )}
              </div>
            </div>
            {inst.active && (
              <button
                onClick={() => {
                  if (confirm(`Revoke installation '${inst.installation_id}'?`)) {
                    revokeMutation.mutate(inst.installation_id);
                  }
                }}
                disabled={revokeMutation.isPending}
                className="ml-2 p-1 rounded text-[var(--color-error)] hover:bg-[var(--color-error-muted,_#fef2f2)] transition-colors disabled:opacity-50"
                title="Revoke"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
