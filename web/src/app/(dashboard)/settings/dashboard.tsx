"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useHealth } from "@/hooks";
import { fetchSettings, updateSettings } from "@/lib/api";
import { PageHeader } from "@/components/ui";
import { Save, PlugZap, Settings2, CheckCircle2, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";

export function SettingsDashboard() {
  const { data: health, refetch: refetchHealth } = useHealth();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [form, setForm] = useState({
    connectionMode: "databricks" as "databricks" | "api",
    databricksHost: "",
    databricksToken: "",
    databricksWarehouseId: "",
    databricksCatalog: "workspace",
    databricksSchema: "meta",
    databricksEnvironment: "",
    cacheTtlSeconds: "86400",
    cacheOnly: false,
  });

  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  useEffect(() => {
    const s = settingsData?.settings;
    if (!s) return;
    setForm({
      connectionMode: s.connectionMode ?? "databricks",
      databricksHost: s.databricksHost ?? "",
      databricksToken: s.databricksToken ?? "",
      databricksWarehouseId: s.databricksWarehouseId ?? "",
      databricksCatalog: s.databricksCatalog ?? "workspace",
      databricksSchema: s.databricksSchema ?? "meta",
      databricksEnvironment: s.databricksEnvironment ?? "",
      cacheTtlSeconds: String(s.cacheTtlSeconds ?? 86400),
      cacheOnly: s.cacheOnly ?? false,
    });
  }, [settingsData]);

  const isDatabricks = form.connectionMode === "databricks";
  const isDatabricksLive = Boolean(health?.databricks);
  const cacheFiles = health?.cache?.fileCount ?? 0;
  const cacheAge = health?.cache?.newestAge;

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    const ttl = Number(form.cacheTtlSeconds);
    if (!Number.isFinite(ttl) || ttl < 0 || ttl > 604800) {
      setSaveError("Cache TTL must be between 0 and 604800.");
      setIsSaving(false);
      return;
    }
    try {
      await updateSettings({
        connectionMode: form.connectionMode,
        databricksHost: form.databricksHost.trim(),
        databricksToken: form.databricksToken.trim(),
        databricksWarehouseId: form.databricksWarehouseId.trim(),
        databricksCatalog: form.databricksCatalog.trim(),
        databricksSchema: form.databricksSchema.trim(),
        databricksEnvironment: form.databricksEnvironment.trim(),
        cacheTtlSeconds: ttl,
        cacheOnly: form.cacheOnly,
      });
      const refreshed = await fetchSettings();
      setForm((prev) => ({ ...prev, databricksToken: refreshed.settings.databricksToken }));
      setSaveMessage("Saved.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestConnection() {
    setIsTestingConnection(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/test-connection", { method: "POST", credentials: "include" });
      const data = await res.json() as { connected?: boolean; message?: string; error?: string };
      const ok = res.ok && Boolean(data.connected);
      setTestResult({
        ok,
        message: data.message ?? data.error ?? (data.connected ? "Connected" : "Failed"),
      });
      if (ok) void refetchHealth();
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : "Connection test failed." });
    } finally {
      setIsTestingConnection(false);
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync/databricks", { method: "POST", credentials: "include" });
      const data = await res.json() as { synced?: Record<string, number>; duration_ms?: number; error?: string };
      if (!res.ok) {
        setSyncResult({ ok: false, message: data.error ?? "Sync failed." });
      } else {
        const counts = data.synced ?? {};
        const total = Object.values(counts).reduce((s, n) => s + n, 0);
        setSyncResult({ ok: true, message: `Synced ${total} records in ${Math.round((data.duration_ms ?? 0) / 1000)}s` });
        await queryClient.invalidateQueries();
      }
    } catch (err) {
      setSyncResult({ ok: false, message: err instanceof Error ? err.message : "Sync failed." });
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" icon={Settings2} />

      {/* Status row */}
      <div
        className="flex items-center gap-4 rounded-lg px-4 py-3 text-sm"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <StatusDot ok={isDatabricksLive} label={isDatabricksLive ? "Databricks connected" : "Databricks unavailable"} />
        <span style={{ width: 1, height: 16, background: "var(--color-border)", flexShrink: 0 }} />
        <span style={{ color: "var(--color-text-muted)" }}>
          {cacheFiles > 0
            ? `Snapshot: ${cacheFiles} files${cacheAge != null ? ` · ${formatAge(cacheAge)}` : ""}`
            : "No snapshot"}
        </span>
      </div>

      {/* Data source */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
          Data source
        </h2>
        <div className="flex gap-2">
          {(["databricks", "api"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setForm((p) => ({ ...p, connectionMode: mode }))}
              className="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={{
                border: `1px solid ${form.connectionMode === mode ? "var(--color-brand, #1B3B6B)" : "var(--color-border)"}`,
                background: form.connectionMode === mode ? "var(--color-brand-subtle, rgba(27,59,107,0.08))" : "transparent",
                color: form.connectionMode === mode ? "var(--color-brand, #1B3B6B)" : "var(--color-text-muted)",
              }}
            >
              {mode === "databricks" ? "Databricks sync" : "API ingest"}
            </button>
          ))}
        </div>
      </section>

      {/* Connection fields */}
      {isDatabricks ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
            Databricks
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Host">
              <input
                type="text"
                value={form.databricksHost}
                onChange={(e) => setForm((p) => ({ ...p, databricksHost: e.target.value }))}
                placeholder="adb-xxxx.azuredatabricks.net"
              />
            </Field>
            <Field label="Warehouse ID">
              <input
                type="text"
                value={form.databricksWarehouseId}
                onChange={(e) => setForm((p) => ({ ...p, databricksWarehouseId: e.target.value }))}
                placeholder="6f8c2f9c1c53b5d8"
              />
            </Field>
            <Field label="Token">
              <input
                type="password"
                value={form.databricksToken}
                onChange={(e) => setForm((p) => ({ ...p, databricksToken: e.target.value }))}
                placeholder="dapi..."
              />
            </Field>
            <Field label="Environment">
              <input
                type="text"
                value={form.databricksEnvironment}
                onChange={(e) => setForm((p) => ({ ...p, databricksEnvironment: e.target.value }))}
                placeholder="dev · staging · prod"
              />
            </Field>
            <Field label="Catalog">
              <input
                type="text"
                value={form.databricksCatalog}
                onChange={(e) => setForm((p) => ({ ...p, databricksCatalog: e.target.value }))}
              />
            </Field>
            <Field label="Schema">
              <input
                type="text"
                value={form.databricksSchema}
                onChange={(e) => setForm((p) => ({ ...p, databricksSchema: e.target.value }))}
              />
            </Field>
          </div>
        </section>
      ) : (
        <section>
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
          >
            API ingest mode — push data via <code className="text-xs">/api/v1/*</code> endpoints. Manage API keys in Admin.
          </div>
        </section>
      )}

      {/* Cache */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
          Cache
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <Field label="TTL (seconds)" inline>
            <input
              type="number"
              min={0}
              max={604800}
              value={form.cacheTtlSeconds}
              onChange={(e) => setForm((p) => ({ ...p, cacheTtlSeconds: e.target.value }))}
              className="w-28"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--color-text)" }}>
            <input
              type="checkbox"
              checked={form.cacheOnly}
              onChange={(e) => setForm((p) => ({ ...p, cacheOnly: e.target.checked }))}
            />
            Snapshot-only mode
          </label>
        </div>
      </section>

      {/* Feedback */}
      {(saveMessage || saveError || testResult || syncResult) && (
        <div className="space-y-1 text-xs">
          {saveMessage && <p style={{ color: "var(--color-success, #059669)" }}>{saveMessage}</p>}
          {saveError && <p style={{ color: "var(--color-error, #dc2626)" }}>{saveError}</p>}
          {testResult && (
            <p style={{ color: testResult.ok ? "var(--color-success, #059669)" : "var(--color-error, #dc2626)" }}>
              {testResult.message}
            </p>
          )}
          {syncResult && (
            <p style={{ color: syncResult.ok ? "var(--color-success, #059669)" : "var(--color-error, #dc2626)" }}>
              {syncResult.message}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60"
          style={{ background: "var(--color-brand, #1B3B6B)", color: "#fff" }}
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? "Saving…" : "Save"}
        </button>
        {isDatabricks && (
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTestingConnection}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text)", background: "var(--color-surface)" }}
          >
            <PlugZap className="h-3.5 w-3.5" />
            {isTestingConnection ? "Testing…" : "Test connection"}
          </button>
        )}
        {isDatabricks && (
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text)", background: "var(--color-surface)" }}
          >
            {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {isSyncing ? "Syncing…" : "Sync now"}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, inline }: { label: string; children: React.ReactNode; inline?: boolean }) {
  return (
    <label className={inline ? "flex items-center gap-2" : "space-y-1.5"}>
      <span className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: ok ? "#059669" : "var(--color-text-muted)" }}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}
