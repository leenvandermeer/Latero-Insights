"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useHealth, useDateRange } from "@/hooks";
import { refreshCache, clearCache, fetchSettings, updateSettings, seedDemoData } from "@/lib/api";
import type { SettingsUpdateRequest } from "@/lib/api";
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  DateRangePicker,
  ErrorMessage,
} from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  HardDrive,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Wifi,
  WifiOff,
  Loader2,
  Save,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";

export function SettingsDashboard() {
  const queryClient = useQueryClient();
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useHealth();
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });
  const { from, to, setRange } = useDateRange();

  // Form state
  const [form, setForm] = useState<SettingsUpdateRequest>({});
  const [tokenVisible, setTokenVisible] = useState(false);
  const [tokenValue, setTokenValue] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Sync form with loaded settings
  useEffect(() => {
    if (settingsData?.settings) {
      const s = settingsData.settings;
      setForm({
        databricksHost: s.databricksHost,
        databricksWarehouseId: s.databricksWarehouseId,
        databricksCatalog: s.databricksCatalog,
        databricksSchema: s.databricksSchema,
        databricksEnvironment: s.databricksEnvironment,
        cacheTtlSeconds: s.cacheTtlSeconds,
        cacheOnly: s.cacheOnly,
      });
      setTokenValue(s.databricksToken); // masked
    }
  }, [settingsData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (data: SettingsUpdateRequest) => updateSettings(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries();
      setFeedback({ type: "success", message: result.message ?? "Settings saved" });
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (err) => {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Save failed" });
    },
  });

  const handleSave = useCallback(() => {
    const data: SettingsUpdateRequest = { ...form };
    // Only send token if user changed it (not the masked value)
    if (tokenValue && !tokenValue.startsWith("••")) {
      data.databricksToken = tokenValue;
    }
    saveMutation.mutate(data);
  }, [form, tokenValue, saveMutation]);

  const updateField = <K extends keyof SettingsUpdateRequest>(key: K, value: SettingsUpdateRequest[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const MAX_ATTEMPTS = 4;
  const RETRY_DELAY_MS = 3000;

  const handleTestConnection = async () => {
    setTesting(true);
    setFeedback(null);
    setTestStatus(null);

    let lastMessage = "Test failed";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      setTestStatus(`Attempt ${attempt} of ${MAX_ATTEMPTS}…`);
      try {
        const res = await fetch("/api/test-connection", { method: "POST" });
        const result: { connected: boolean; retryable?: boolean; message: string } = await res.json();

        if (result.connected) {
          setFeedback({ type: "success", message: result.message });
          refetchHealth();
          setTesting(false);
          setTestStatus(null);
          return;
        }

        lastMessage = result.message;

        // Only retry when the API says it's worth it and there are attempts left
        if (!result.retryable || attempt === MAX_ATTEMPTS) break;

        setTestStatus(`Warehouse is starting — retrying in ${RETRY_DELAY_MS / 1000}s (${attempt}/${MAX_ATTEMPTS})…`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      } catch (err) {
        lastMessage = err instanceof Error ? err.message : "Test failed";
        break;
      }
    }

    setFeedback({ type: "error", message: lastMessage });
    setTesting(false);
    setTestStatus(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setFeedback(null);
    try {
      const result = await refreshCache({ from, to });
      setFeedback({
        type: "success",
        message: `Cache refreshed: ${Object.entries(result.results).map(([k, v]) => `${k}: ${v}`).join(", ")}`,
      });
      queryClient.invalidateQueries();
    } catch (err) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Refresh failed" });
    } finally {
      setRefreshing(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    setFeedback(null);
    try {
      const result = await clearCache();
      setFeedback({ type: "success", message: `Cache cleared: ${result.cleared} entries removed` });
      queryClient.invalidateQueries();
    } catch (err) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Clear failed" });
    } finally {
      setClearing(false);
    }
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    setFeedback(null);
    try {
      const result = await seedDemoData();
      const counts = result.seeded;
      setFeedback({
        type: "success",
        message: `Demo data loaded: ${counts.pipelines} pipeline runs, ${counts.quality} quality checks, ${counts.lineage} lineage hops`,
      });
      queryClient.invalidateQueries();
      refetchHealth();
      setForm((prev) => ({ ...prev, cacheOnly: true }));
    } catch (err) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Seed failed" });
    } finally {
      setSeeding(false);
    }
  };

  const cache = health?.cache;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Configuration" title="Settings" description="Connection, cache, and configuration" />

      {/* Feedback toast */}
      {feedback && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-center gap-2 rounded-lg p-3 text-sm"
          style={feedback.type === "success"
            ? { backgroundColor: "var(--color-success-light)", color: "var(--color-success)" }
            : { backgroundColor: "var(--color-error-light)", color: "var(--color-error)" }
          }
        >
          {feedback.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
          {feedback.message}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">

        {/* ── Left column: Connection + Data Source + Save ── */}
        <div className="space-y-6">

          {/* ── Databricks Connection ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Databricks Connection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status indicator */}
              {!healthLoading && health && (
                <div className="flex items-center gap-2 mb-2">
                  {health.databricks ? (
                    <>
                      <Wifi className="h-4 w-4 text-emerald-600" />
                      <Badge variant="success">Connected</Badge>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-4 w-4 text-red-500" />
                      <Badge variant="error">Disconnected</Badge>
                    </>
                  )}
                </div>
              )}

              {settingsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading settings...
                </div>
              ) : (
                <div className="space-y-3">
                  <SettingsField
                    label="Host"
                    description="Workspace hostname (without https://)"
                    value={form.databricksHost ?? ""}
                    onChange={(v) => updateField("databricksHost", v)}
                    placeholder="adb-1234567890.12.azuredatabricks.net"
                  />

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Token</label>
                    <p className="text-xs text-muted-foreground">Personal Access Token (PAT)</p>
                    <div className="flex gap-2">
                      <input
                        type={tokenVisible ? "text" : "password"}
                        value={tokenValue}
                        onChange={(e) => setTokenValue(e.target.value)}
                        placeholder="dapi..."
                        className="flex-1 rounded-md border px-3 py-2 text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        style={{ borderColor: "var(--color-border)" }}
                      />
                      <button
                        type="button"
                        onClick={() => setTokenVisible(!tokenVisible)}
                        className="rounded-md border p-2 hover:bg-muted transition-colors"
                        style={{ borderColor: "var(--color-border)" }}
                        aria-label={tokenVisible ? "Hide token" : "Show token"}
                      >
                        {tokenVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {settingsData?.settings.tokenSet && tokenValue.startsWith("••") && (
                      <p className="text-xs text-muted-foreground">Token is set. Enter a new value to change it.</p>
                    )}
                  </div>

                  <SettingsField
                    label="SQL Warehouse ID"
                    description="From SQL Warehouses → Connection details → HTTP path"
                    value={form.databricksWarehouseId ?? ""}
                    onChange={(v) => updateField("databricksWarehouseId", v)}
                    placeholder="abc123def456"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <SettingsField
                      label="Catalog"
                      value={form.databricksCatalog ?? "workspace"}
                      onChange={(v) => updateField("databricksCatalog", v)}
                      placeholder="workspace"
                    />
                    <SettingsField
                      label="Schema"
                      value={form.databricksSchema ?? "meta"}
                      onChange={(v) => updateField("databricksSchema", v)}
                      placeholder="meta"
                    />
                  </div>

                  <SettingsField
                    label="Environment Scope"
                    description="Only return live rows for this exact environment value"
                    value={form.databricksEnvironment ?? ""}
                    onChange={(v) => updateField("databricksEnvironment", v)}
                    placeholder="dev-free"
                  />

                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Leave blank only if your meta tables contain exactly one non-demo environment. This app will auto-detect that single value; otherwise live results stay ambiguous.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Data Source ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Source
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mode toggle */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => updateField("cacheOnly", false)}
                  className="flex flex-col items-start gap-1.5 rounded-xl p-4 border-2 transition-all text-left"
                  style={{
                    borderColor: !form.cacheOnly ? "var(--color-accent)" : "var(--color-border)",
                    background: !form.cacheOnly ? "rgba(200,137,42,0.06)" : "var(--color-card)",
                  }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Wifi className="h-4 w-4 shrink-0" style={{ color: !form.cacheOnly ? "var(--color-accent)" : "var(--color-text-muted)" }} />
                    <span className="text-sm font-semibold" style={{ color: !form.cacheOnly ? "var(--color-accent)" : "var(--color-text)" }}>Live</span>
                    {!form.cacheOnly && <span className="ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ background: "var(--color-accent)", color: "#fff" }}>Active</span>}
                  </div>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Always fetch from Databricks. Cache stores a local copy for offline fallback.
                  </p>
                </button>

                <button
                  onClick={() => updateField("cacheOnly", true)}
                  className="flex flex-col items-start gap-1.5 rounded-xl p-4 border-2 transition-all text-left"
                  style={{
                    borderColor: form.cacheOnly ? "var(--color-accent)" : "var(--color-border)",
                    background: form.cacheOnly ? "rgba(200,137,42,0.06)" : "var(--color-card)",
                  }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <HardDrive className="h-4 w-4 shrink-0" style={{ color: form.cacheOnly ? "var(--color-accent)" : "var(--color-text-muted)" }} />
                    <span className="text-sm font-semibold" style={{ color: form.cacheOnly ? "var(--color-accent)" : "var(--color-text)" }}>Cache only</span>
                    {form.cacheOnly && <span className="ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ background: "var(--color-accent)", color: "#fff" }}>Active</span>}
                  </div>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Serve last known data without querying Databricks. Safe for demos and offline use.
                  </p>
                </button>
              </div>

              {/* Contextual info */}
              <div className="rounded-lg px-4 py-3 text-xs space-y-1" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                {!form.cacheOnly ? (
                  <>
                    <p style={{ color: "var(--color-text)" }}><span className="font-medium">Live mode:</span> each page load queries Databricks and refreshes the cache. If Databricks is unreachable, the last cached data is shown automatically.</p>
                    <p style={{ color: "var(--color-text-muted)" }}>Clearing the cache forces a fresh Databricks fetch on next load.</p>
                  </>
                ) : (
                  <>
                    <p style={{ color: "var(--color-text)" }}><span className="font-medium">Cache-only mode:</span> no Databricks queries are made. Dashboards show the last data that was loaded into cache.</p>
                    <p style={{ color: "var(--color-text-muted)" }}>Switch to Live to re-sync with Databricks. Load Demo Data to fill the cache with synthetic data.</p>
                  </>
                )}
              </div>

              {/* Cache TTL */}
              <div className="flex items-center gap-3 pt-1">
                <label className="text-sm font-medium shrink-0" style={{ color: "var(--color-text-muted)" }}>Cache TTL</label>
                <input
                  type="number"
                  min={0}
                  max={604800}
                  value={form.cacheTtlSeconds ?? 86400}
                  onChange={(e) => updateField("cacheTtlSeconds", parseInt(e.target.value, 10) || 0)}
                  className="w-24 rounded-md border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  style={{ borderColor: "var(--color-border)" }}
                />
                <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  seconds ({Math.round((form.cacheTtlSeconds ?? 86400) / 3600)}h)
                </span>
              </div>
            </CardContent>
          </Card>

          {/* ── Save / Test buttons ── */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
              style={{ backgroundColor: "var(--color-primary)", boxShadow: "0 2px 8px rgba(27,59,107,0.25)" }}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saveMutation.isPending ? "Saving..." : "Save Settings"}
            </button>

            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all hover:-translate-y-0.5 disabled:opacity-40"
              style={{ border: "1px solid var(--color-accent)", color: "var(--color-accent)", background: "transparent" }}
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
              {testing ? (testStatus ?? "Connecting…") : "Test Connection"}
            </button>
          </div>

        </div>{/* end left column */}

        {/* ── Right column: Cache Management (sticky) ── */}
        <div className="sticky top-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Cache Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Status grid */}
              {cache ? (
                <div className="grid grid-cols-2 gap-3">
                  <StatBox label="Cached entries" value={String(cache.entries)} />
                  <StatBox label="TTL" value={`${Math.round(cache.ttlSeconds / 3600)}h`} />
                  {cache.newestAge != null && (
                    <StatBox label="Last updated" value={formatAge(cache.newestAge)} icon={<Clock className="h-4 w-4" />} />
                  )}
                  {cache.oldestAge != null && (
                    <StatBox label="Oldest entry" value={formatAge(cache.oldestAge)} icon={<Clock className="h-4 w-4" />} />
                  )}
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No cache status available.</p>
              )}

              {/* Action rows */}
              <div className="space-y-3">
                {/* Refresh from Databricks */}
                <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                  <div className="flex items-start gap-3">
                    <RefreshCw className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--color-accent)" }} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>Refresh from Databricks</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Fetches fresh data for the selected date range. Requires Live mode.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DateRangePicker from={from} to={to} onChange={setRange} />
                    <button
                      onClick={handleRefresh}
                      disabled={refreshing || form.cacheOnly}
                      className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 disabled:opacity-40"
                      style={{ backgroundColor: "var(--color-accent)" }}
                      title={form.cacheOnly ? "Switch to Live mode to refresh from Databricks" : undefined}
                    >
                      {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      {refreshing ? "Refreshing…" : "Refresh"}
                    </button>
                  </div>
                </div>

                {/* Demo data */}
                <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                  <Sparkles className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--color-accent)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>Load Demo Data</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Fills cache with demo data. No Databricks connection needed. Enables Cache-only mode.</p>
                    <button
                      onClick={async () => { await handleSeedDemo(); updateField("cacheOnly", true); }}
                      disabled={seeding}
                      className="mt-2 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all hover:-translate-y-0.5 disabled:opacity-40"
                      style={{ border: "1px solid var(--color-accent)", color: "var(--color-accent)", background: "transparent" }}
                    >
                      {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {seeding ? "Loading…" : "Load Demo Data"}
                    </button>
                  </div>
                </div>

                {/* Clear cache */}
                <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                  <Trash2 className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--color-error, #EF4444)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>Clear Cache</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                      {!form.cacheOnly
                        ? "Removes all cached data. Fresh data will be fetched from Databricks on next load."
                        : "Removes all cached data. Dashboards will be empty until you load demo data or switch to Live."}
                    </p>
                    <button
                      onClick={handleClear}
                      disabled={clearing}
                      className="mt-2 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all hover:-translate-y-0.5 disabled:opacity-40"
                      style={{ border: "1px solid var(--color-error, #EF4444)", color: "var(--color-error, #EF4444)", background: "transparent" }}
                    >
                      {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      {clearing ? "Clearing…" : "Clear Cache"}
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>{/* end right column */}

      </div>{/* end two-column grid */}
    </div>
  );
}

// ── Sub-components ──

function SettingsField({
  label,
  description,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        style={{ borderColor: "var(--color-border)" }}
      />
    </div>
  );
}

function StatBox({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-xl font-bold flex items-center gap-1">
        {icon}
        {value}
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
