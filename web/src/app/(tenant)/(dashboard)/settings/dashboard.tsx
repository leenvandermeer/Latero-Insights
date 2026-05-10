"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useHealth } from "@/hooks";
import { useInstallation } from "@/contexts/installation-context";
import { fetchSettings, updateSettings } from "@/lib/api";
import type { ApiHealthResponse } from "@/lib/api";
import { PageHeader } from "@/components/ui";
import { Save, PlugZap, Settings2, CheckCircle2, AlertTriangle, RefreshCw, Loader2, Database, Cloud, FileArchive, Wrench } from "lucide-react";

function SectionCard({
  title,
  icon: Icon,
  subtitle,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl p-5 md:p-6" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl p-2.5" style={{ background: "var(--color-surface)" }}>
          <Icon className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
        </div>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function SummaryTile({ label, value, meta }: { label: string; value: string; meta?: string }) {
  return (
    <div className="rounded-2xl px-4 py-3" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </p>
      <p className="mt-2 text-sm font-medium" style={{ color: "var(--color-text)" }}>
        {value}
      </p>
      {meta ? (
        <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
          {meta}
        </p>
      ) : null}
    </div>
  );
}

export function SettingsDashboard() {
  const { data: health, refetch: refetchHealth } = useHealth();
  const { installation } = useInstallation();
  const installationId = installation?.installation_id ?? null;
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; empty?: boolean; message: string } | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnoseResult, setDiagnoseResult] = useState<Record<string, unknown> | null>(null);
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

  const { data: settingsData, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["settings", installationId],
    queryFn: fetchSettings,
    staleTime: 0,
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
      setSaveMessage("Settings saved.");
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
      if (ok) {
        queryClient.setQueryData(["health"], (old: ApiHealthResponse | undefined) =>
          old ? { ...old, databricks: true } : old
        );
        await refetchHealth();
      }
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
      const data = await res.json() as { synced?: Record<string, number>; duration_ms?: number; error?: string; range?: { from: string; to: string } };
      if (!res.ok) {
        setSyncResult({ ok: false, message: data.error ?? "Sync failed." });
      } else {
        const counts = data.synced ?? {};
        const total = Object.values(counts).reduce((s, n) => s + n, 0);
        if (total === 0) {
          setSyncResult({
            ok: true,
            empty: true,
            message: `Sync complete — no new records found. Existing data unchanged. (${Math.round((data.duration_ms ?? 0) / 1000)}s)`,
          });
        } else {
          setSyncResult({ ok: true, message: `Synced ${total} records in ${Math.round((data.duration_ms ?? 0) / 1000)}s` });
        }

        if (data.range?.from && data.range?.to) {
          const { from, to } = data.range;
          await Promise.all([
            fetch(`/api/pipelines?from=${from}&to=${to}`, { credentials: "include" }),
            fetch(`/api/quality?from=${from}&to=${to}`, { credentials: "include" }),
            fetch(`/api/lineage?from=${from}&to=${to}`, { credentials: "include" }),
          ]);
        }

        await queryClient.invalidateQueries();
        await refetchHealth();
      }
    } catch (err) {
      setSyncResult({ ok: false, message: err instanceof Error ? err.message : "Sync failed." });
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleDiagnose() {
    setIsDiagnosing(true);
    setDiagnoseResult(null);
    try {
      const res = await fetch("/api/sync/databricks/diagnose", { credentials: "include" });
      const data = await res.json() as Record<string, unknown>;
      setDiagnoseResult(data);
    } catch (err) {
      setDiagnoseResult({ error: err instanceof Error ? err.message : "Diagnose failed." });
    } finally {
      setIsDiagnosing(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="Settings" icon={Settings2} />

      <section className="rounded-3xl p-5 md:p-6" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
        <div className="max-w-2xl">
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "rgba(27,59,107,0.10)", color: "var(--color-brand, #1b3b6b)" }}>
              Admin settings
            </span>
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "var(--color-sidebar-hover)", color: "var(--color-text-muted)" }}>
              Runtime configuration
            </span>
          </div>
          <h2 className="text-lg font-medium" style={{ color: "var(--color-text)" }}>
            Connection, sync, and snapshot behavior
          </h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            Configure how Latero Control connects to upstream metadata sources and how cached snapshots are handled for this installation.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
          <SummaryTile
            label="Connection mode"
            value={isDatabricks ? "Databricks sync" : "API ingest"}
          />
          <SummaryTile
            label="Live connection"
            value={isDatabricksLive ? "Connected" : "Unavailable"}
            meta={isDatabricks ? "Based on latest health check" : "Not applicable in API mode"}
          />
          <SummaryTile
            label="Snapshot cache"
            value={cacheFiles > 0 ? `${cacheFiles} files` : "No snapshot"}
            meta={cacheAge != null ? formatAge(cacheAge) : "No recent cache age available"}
          />
          <SummaryTile
            label="TTL"
            value={`${form.cacheTtlSeconds}s`}
            meta={form.cacheOnly ? "Snapshot-only mode enabled" : "Live reads with cache fallback"}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <SectionCard
            title="Data source mode"
            icon={Database}
            subtitle="Choose whether this installation pulls metadata from Databricks or receives events through API ingest."
          >
            <div className="flex flex-wrap gap-2">
              {(["databricks", "api"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={isLoadingSettings}
                  onClick={() => setForm((p) => ({ ...p, connectionMode: mode }))}
                  className="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                  style={{
                    border: `1px solid ${!isLoadingSettings && form.connectionMode === mode ? "var(--color-brand, #1B3B6B)" : "var(--color-border)"}`,
                    background: !isLoadingSettings && form.connectionMode === mode ? "var(--color-brand-subtle, rgba(27,59,107,0.08))" : "transparent",
                    color: !isLoadingSettings && form.connectionMode === mode ? "var(--color-brand, #1B3B6B)" : "var(--color-text-muted)",
                    opacity: isLoadingSettings ? 0.5 : 1,
                  }}
                >
                  {mode === "databricks" ? "Databricks sync" : "API ingest"}
                </button>
              ))}
            </div>
          </SectionCard>

          {isDatabricks ? (
            <SectionCard
              title="Databricks connection"
              icon={Cloud}
              subtitle="Provide the warehouse, catalog, schema, and token details used for metadata sync."
            >
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
            </SectionCard>
          ) : (
            <SectionCard
              title="API ingest mode"
              icon={Cloud}
              subtitle="This installation expects metadata pushes from Latero runtimes through the server-side API surface."
            >
              <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                API ingest mode is active. Push data through <code className="text-xs">/api/v1/*</code> endpoints. API key lifecycle is managed in admin flows.
              </div>
            </SectionCard>
          )}
        </div>

        <div className="space-y-4">
          <SectionCard
            title="Cache and snapshot behavior"
            icon={FileArchive}
            subtitle="Control how long snapshots stay valid and whether this installation should run in snapshot-only mode."
          >
            <div className="flex flex-wrap items-center gap-4">
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
              <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: "var(--color-text)" }}>
                <input
                  type="checkbox"
                  checked={form.cacheOnly}
                  onChange={(e) => setForm((p) => ({ ...p, cacheOnly: e.target.checked }))}
                />
                Snapshot-only mode
              </label>
            </div>
          </SectionCard>

          <SectionCard
            title="Operational actions"
            icon={Wrench}
            subtitle="Save configuration, verify connectivity, run a sync, or collect diagnostics."
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60"
                style={{ background: "var(--color-brand, #1B3B6B)", color: "#fff" }}
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? "Saving…" : "Save settings"}
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
              {isDatabricks && (
                <button
                  type="button"
                  onClick={handleDiagnose}
                  disabled={isDiagnosing}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)", background: "transparent" }}
                >
                  {isDiagnosing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {isDiagnosing ? "Diagnosing…" : "Diagnose"}
                </button>
              )}
            </div>

            {(saveMessage || saveError || testResult || syncResult) && (
              <div className="mt-4 space-y-2 text-xs">
                {saveMessage && <p style={{ color: "var(--color-success, #10b981)" }}>{saveMessage}</p>}
                {saveError && <p style={{ color: "var(--color-error, #ef4444)" }}>{saveError}</p>}
                {testResult && (
                  <p style={{ color: testResult.ok ? "var(--color-success, #10b981)" : "var(--color-error, #ef4444)" }}>
                    {testResult.message}
                  </p>
                )}
                {syncResult && (
                  <p style={{ color: syncResult.ok && !syncResult.empty ? "var(--color-success, #10b981)" : syncResult.empty ? "var(--color-warning, #f59e0b)" : "var(--color-error, #ef4444)" }}>
                    {syncResult.message}
                  </p>
                )}
              </div>
            )}
          </SectionCard>

          {diagnoseResult && (
            <SectionCard
              title="Diagnose output"
              icon={Wrench}
              subtitle="Structured diagnostic information returned by the sync diagnostic endpoint."
            >
              <pre
                className="max-h-80 overflow-auto rounded-lg p-3 text-xs"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {JSON.stringify(diagnoseResult, null, 2)}
              </pre>
              <button
                type="button"
                onClick={() => setDiagnoseResult(null)}
                className="mt-3 text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                Clear
              </button>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, inline }: { label: string; children: React.ReactNode; inline?: boolean }) {
  return (
    <label className={inline ? "flex items-center gap-2" : "flex flex-col gap-2"}>
      <span className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}
