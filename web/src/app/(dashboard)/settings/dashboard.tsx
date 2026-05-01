"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useHealth } from "@/hooks";
import { fetchSettings, updateSettings } from "@/lib/api";
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import {
  Save,
  PlugZap,
} from "lucide-react";

export function SettingsDashboard() {
  const { data: health } = useHealth();
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
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
    const settings = settingsData?.settings;
    if (!settings) return;

    setForm({
      connectionMode: settings.connectionMode ?? "databricks",
      databricksHost: settings.databricksHost ?? "",
      databricksToken: settings.databricksToken ?? "",
      databricksWarehouseId: settings.databricksWarehouseId ?? "",
      databricksCatalog: settings.databricksCatalog ?? "workspace",
      databricksSchema: settings.databricksSchema ?? "meta",
      databricksEnvironment: settings.databricksEnvironment ?? "",
      cacheTtlSeconds: String(settings.cacheTtlSeconds ?? 86400),
      cacheOnly: settings.cacheOnly ?? false,
    });
  }, [settingsData]);

  const useDatabricksMode = form.connectionMode === "databricks";
  const cacheOnly = settingsData?.settings?.cacheOnly ?? false;
  const cache = health?.cache;
  const hasCachedSnapshot = Boolean((cache?.fileCount ?? 0) > 0);
  const isDatabricksLive = Boolean(health?.databricks);

  const connectionLabel = useDatabricksMode
    ? (isDatabricksLive ? "Live" : (hasCachedSnapshot ? "Live + cache" : "Unavailable"))
    : "Live";
  const connectionVariant: "success" | "warning" | "error" = useDatabricksMode
    ? (isDatabricksLive ? "success" : (hasCachedSnapshot ? "warning" : "error"))
    : "success";

  async function handleSaveSettings() {
    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    const parsedTtl = Number(form.cacheTtlSeconds);
    if (!Number.isFinite(parsedTtl) || parsedTtl < 0 || parsedTtl > 604800) {
      setSaveError("Cache TTL moet een getal zijn tussen 0 en 604800.");
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
        cacheTtlSeconds: parsedTtl,
        cacheOnly: form.cacheOnly,
      });
      const refreshed = await fetchSettings();
      const settings = refreshed.settings;
      setForm((prev) => ({
        ...prev,
        databricksToken: settings.databricksToken,
      }));
      setSaveMessage("Configuratie opgeslagen voor de huidige organisatie.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Opslaan van configuratie mislukt.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestConnection() {
    if (!useDatabricksMode) {
      setTestMessage("Databricks connection test is not available in API ingest mode.");
      setTestError(null);
      return;
    }

    setIsTestingConnection(true);
    setTestError(null);
    setTestMessage(null);
    try {
      const response = await fetch("/api/test-connection", { method: "POST", credentials: "include" });
      const data = await response.json() as { connected?: boolean; message?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? data.message ?? "Connection test failed.");
      }
      setTestMessage(data.message ?? (data.connected ? "Connection is healthy" : "Connection unavailable"));
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "Connection test failed.");
    } finally {
      setIsTestingConnection(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Configuration" title="Settings" description="Connection strategy and runtime status for your active organization" />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            Connection status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <OverviewTile
              label="Connection"
              value={connectionLabel}
              detail={useDatabricksMode
                ? (isDatabricksLive
                  ? "Databricks is live"
                  : (hasCachedSnapshot ? "Databricks unavailable, serving from cache" : "Databricks unavailable and no cache snapshot found"))
                : "API ingest is active"}
              variant={connectionVariant}
            />
            <OverviewTile
              label="Stored snapshot"
              value={cache?.newestAge != null ? formatAge(cache.newestAge) : "None"}
              detail={cache?.fileCount ? `${cache.fileCount} files` : "No snapshot available"}
              variant={cache?.fileCount ? "default" : "warning"}
            />
          </div>

          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            This page shows runtime status and integration configuration for the active organization.
          </p>

        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Connection mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Choose how this organization receives data in Insights.
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, connectionMode: "databricks" }))}
              className="rounded-lg p-4 text-left"
              style={{
                border: form.connectionMode === "databricks" ? "1px solid var(--color-brand, #1B3B6B)" : "1px solid var(--color-border)",
                background: form.connectionMode === "databricks" ? "var(--color-brand-subtle, rgba(27,59,107,0.08))" : "var(--color-card)",
              }}
            >
              <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                Databricks configuration
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                Pull and sync from Databricks SQL Warehouse.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, connectionMode: "api" }))}
              className="rounded-lg p-4 text-left"
              style={{
                border: form.connectionMode === "api" ? "1px solid var(--color-brand, #1B3B6B)" : "1px solid var(--color-border)",
                background: form.connectionMode === "api" ? "var(--color-brand-subtle, rgba(27,59,107,0.08))" : "var(--color-card)",
              }}
            >
              <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                API ingest
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                Use `/api/v1/*` endpoints as the integration path; Databricks credentials are not used.
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <PlugZap className="h-5 w-5" />
            Integration configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Settings are stored per active organization.
          </p>

          {useDatabricksMode ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Databricks host">
                <input
                  type="text"
                  value={form.databricksHost}
                  onChange={(event) => setForm((prev) => ({ ...prev, databricksHost: event.target.value }))}
                  placeholder="adb-xxxx.azuredatabricks.net"
                  className="w-full rounded-md px-3 py-2 text-sm"
                  style={{ border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-text)" }}
                />
              </Field>

              <Field label="Warehouse ID">
                <input
                  type="text"
                  value={form.databricksWarehouseId}
                  onChange={(event) => setForm((prev) => ({ ...prev, databricksWarehouseId: event.target.value }))}
                  placeholder="6f8c2f9c1c53b5d8"
                  className="w-full rounded-md px-3 py-2 text-sm"
                  style={{ border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-text)" }}
                />
              </Field>

              <Field label="Databricks token">
                <input
                  type="password"
                  value={form.databricksToken}
                  onChange={(event) => setForm((prev) => ({ ...prev, databricksToken: event.target.value }))}
                  placeholder="dapi..."
                  className="w-full rounded-md px-3 py-2 text-sm"
                  style={{ border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-text)" }}
                />
              </Field>

              <Field label="Environment label">
                <input
                  type="text"
                  value={form.databricksEnvironment}
                  onChange={(event) => setForm((prev) => ({ ...prev, databricksEnvironment: event.target.value }))}
                  placeholder="dev | staging | prod"
                  className="w-full rounded-md px-3 py-2 text-sm"
                  style={{ border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-text)" }}
                />
              </Field>

              <Field label="Catalog">
                <input
                  type="text"
                  value={form.databricksCatalog}
                  onChange={(event) => setForm((prev) => ({ ...prev, databricksCatalog: event.target.value }))}
                  className="w-full rounded-md px-3 py-2 text-sm"
                  style={{ border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-text)" }}
                />
              </Field>

              <Field label="Schema">
                <input
                  type="text"
                  value={form.databricksSchema}
                  onChange={(event) => setForm((prev) => ({ ...prev, databricksSchema: event.target.value }))}
                  className="w-full rounded-md px-3 py-2 text-sm"
                  style={{ border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-text)" }}
                />
              </Field>
            </div>
          ) : (
            <div
              className="rounded-md px-3 py-2.5 text-sm"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
            >
              API ingest mode is active. Configure installations and API keys via admin, then push data to `/api/v1/*` endpoints.
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Cache TTL (seconds)">
              <input
                type="number"
                min={0}
                max={604800}
                value={form.cacheTtlSeconds}
                onChange={(event) => setForm((prev) => ({ ...prev, cacheTtlSeconds: event.target.value }))}
                className="w-full rounded-md px-3 py-2 text-sm"
                style={{ border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-text)" }}
              />
            </Field>

            <label className="flex items-center gap-2 rounded-md px-3 py-2 text-sm" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
              <input
                type="checkbox"
                checked={form.cacheOnly}
                onChange={(event) => setForm((prev) => ({ ...prev, cacheOnly: event.target.checked }))}
              />
              <span style={{ color: "var(--color-text)" }}>Snapshot-only mode</span>
            </label>
          </div>

          {(saveMessage || saveError || testMessage || testError) && (
            <div className="space-y-1 text-xs">
              {saveMessage && <p style={{ color: "var(--color-success, #059669)" }}>{saveMessage}</p>}
              {saveError && <p style={{ color: "var(--color-error, #dc2626)" }}>{saveError}</p>}
              {testMessage && <p style={{ color: "var(--color-text-muted)" }}>{testMessage}</p>}
              {testError && <p style={{ color: "var(--color-error, #dc2626)" }}>{testError}</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-60"
              style={{ background: "var(--color-brand, #1B3B6B)", color: "#fff" }}
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save settings"}
            </button>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTestingConnection || !useDatabricksMode}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-60"
              style={{ border: "1px solid var(--color-border)", color: "var(--color-text)", background: "var(--color-surface)" }}
            >
              <PlugZap className="h-4 w-4" />
              {isTestingConnection ? "Testing..." : "Test Databricks"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function OverviewTile({
  label,
  value,
  detail,
  variant,
}: {
  label: string;
  value: string;
  detail: string;
  variant: "default" | "success" | "warning" | "error";
}) {
  return (
    <div
      className="rounded-xl p-4 space-y-2"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          {label}
        </p>
        <Badge variant={variant}>{value}</Badge>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        {detail}
      </p>
    </div>
  );
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}