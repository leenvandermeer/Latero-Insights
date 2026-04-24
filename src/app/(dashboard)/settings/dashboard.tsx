"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useHealth, useDateRange } from "@/hooks";
import { refreshCache, clearCache, fetchSettings, updateSettings } from "@/lib/api";
import type { SettingsUpdateRequest } from "@/lib/api";
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  DateRangePicker,
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
  CircleHelp,
  ShieldCheck,
  CloudOff,
  Webhook,
  Copy,
  ArrowDownToLine,
} from "lucide-react";

export function SettingsDashboard() {
  const queryClient = useQueryClient();
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useHealth();
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });
  const { from, to, setRange } = useDateRange();

  // Ingest connector health
  const { data: ingestHealth } = useQuery<{ status: string; database: boolean }>({ 
    queryKey: ["v1-health"],
    queryFn: async () => { const r = await fetch("/api/v1/health"); return r.json(); },
    refetchInterval: 30_000,
    retry: false,
  });

  // Form state
  const [form, setForm] = useState<SettingsUpdateRequest>({});
  const [tokenVisible, setTokenVisible] = useState(false);
  const [tokenValue, setTokenValue] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
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

  const handleSyncFromDatabricks = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/sync/databricks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const result: { synced: { pipeline_runs: number; dq_checks: number; lineage: number }; duration_ms: number } = await res.json();
      if (!res.ok) {
        const errResult = result as unknown as { error: string };
        setFeedback({ type: "error", message: errResult.error ?? "Sync failed" });
      } else {
        const { synced } = result;
        setFeedback({
          type: "success",
          message: `Sync complete (${result.duration_ms}ms): ${synced.pipeline_runs} pipeline runs, ${synced.dq_checks} DQ checks, ${synced.lineage} lineage hops`,
        });
        queryClient.invalidateQueries();
      }
    } catch (err) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Sync failed" });
    } finally {
      setSyncing(false);
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

  const cache = health?.cache;
  const snapshotModeLabel = form.cacheOnly ? "Snapshot only" : "Live with snapshot fallback";
  const snapshotCoverage =
    cache?.coverageFrom && cache?.coverageTo
      ? `${formatDateLabel(cache.coverageFrom)} - ${formatDateLabel(cache.coverageTo)}`
      : "No stored date range";
  const snapshotContents = cache?.sources.length ? cache.sources.map(snapshotSourceLabel).join(", ") : "No stored content";
  const connectionLabel = health?.databricks ? "Connected" : (form.cacheOnly ? "Snapshot only" : "Unavailable");
  const connectionVariant: "success" | "warning" | "error" = health?.databricks ? "success" : (form.cacheOnly ? "warning" : "error");
  const environmentLabel = form.databricksEnvironment?.trim() || "Auto-detect";

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Configuration" title="Settings" description="Connection, serving mode, and stored snapshot behavior" />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Current State
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            <OverviewTile
              label="Databricks"
              value={connectionLabel}
              detail={health?.databricks ? "Live connection available" : (form.cacheOnly ? "Using stored snapshot only" : "Live connection unavailable")}
              variant={connectionVariant}
            />
            <OverviewTile
              label="Serving mode"
              value={snapshotModeLabel}
              detail={form.cacheOnly ? "Never query Databricks" : "Databricks first, snapshot on failure"}
              variant={form.cacheOnly ? "warning" : "success"}
            />
            <OverviewTile
              label="Environment"
              value={environmentLabel}
              detail={form.databricksEnvironment?.trim() ? "Exact environment filter" : "Single real environment expected"}
              variant="default"
            />
            <OverviewTile
              label="Stored snapshot"
              value={cache?.newestAge != null ? formatAge(cache.newestAge) : "None"}
              detail={snapshotCoverage}
              variant={cache?.fileCount ? "default" : "warning"}
            />
            <OverviewTile
              label="API Ingest"
              value={ingestHealth?.database ? "Connected" : "Unavailable"}
              detail={ingestHealth?.database ? "Postgres reachable" : "POSTGRES_URL not configured or DB offline"}
              variant={ingestHealth?.database ? "success" : "warning"}
            />
          </div>

          <div
            className="grid grid-cols-1 gap-3 rounded-xl p-4 lg:grid-cols-[1.2fr_1fr]"
            style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
          >
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>What this means</p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text)" }}>
                Databricks is the source of truth. The stored snapshot exists to keep dashboards readable when live access is temporarily unavailable.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>Current stored content</p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text)" }}>{snapshotContents}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
              <CardTitle className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Databricks Connection
                </span>
                {!healthLoading && health && <Badge variant={connectionVariant}>{connectionLabel}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
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
                    label="Environment"
                    description="Only show metadata for this exact environment value"
                    value={form.databricksEnvironment ?? ""}
                    onChange={(v) => updateField("databricksEnvironment", v)}
                    placeholder="dev-free"
                  />

                  <div className="rounded-lg px-3 py-2 text-xs flex gap-2" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                    <CircleHelp className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>Example values are `dev-free`, `acc`, or `prd`. Leave blank only if these tables contain exactly one real environment.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── API Ingest Connector ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Webhook className="h-5 w-5" />
                  API Ingest Connector
                </span>
                <Badge variant={ingestHealth?.database ? "success" : "warning"}>
                  {ingestHealth?.database ? "Connected" : "Unavailable"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Push pipeline runs, DQ checks, and lineage events directly into Latero Insights via the ingest API.
                Use this alongside or instead of the Databricks pull connector.
              </p>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>Ingest endpoints</p>
                <IngestEndpoint label="Pipeline runs" path="/api/v1/pipeline-runs" />
                <IngestEndpoint label="DQ checks" path="/api/v1/dq-checks" />
                <IngestEndpoint label="Lineage" path="/api/v1/lineage" />
              </div>

              <div className="rounded-lg px-4 py-3 text-xs space-y-2" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                <p className="font-medium" style={{ color: "var(--color-text)" }}>How to use</p>
                <ol className="space-y-1 list-decimal list-inside" style={{ color: "var(--color-text-muted)" }}>
                  <li>Register an installation in Postgres to get an <code className="font-mono">installation_id</code> and Bearer token.</li>
                  <li>Send <code className="font-mono">POST</code> requests with <code className="font-mono">Authorization: Bearer &lt;token&gt;</code>.</li>
                  <li>Include <code className="font-mono">installation_id</code> in each payload.</li>
                </ol>
              </div>

              {!ingestHealth?.database && (
                <div className="rounded-lg px-4 py-3 text-xs flex gap-2" style={{ background: "var(--color-error-light, #FEF2F2)", border: "1px solid var(--color-error, #EF4444)", color: "var(--color-error, #EF4444)" }}>
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>Postgres is unreachable. Set <code className="font-mono">POSTGRES_URL</code> in your environment and run <code className="font-mono">npm run infra:up</code> for local development.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Serving Mode ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                How Data Is Served
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
                    <span className="text-sm font-semibold" style={{ color: !form.cacheOnly ? "var(--color-accent)" : "var(--color-text)" }}>Live + fallback</span>
                    {!form.cacheOnly && <span className="ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ background: "var(--color-accent)", color: "#fff" }}>Active</span>}
                  </div>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Read from Databricks first. If Databricks is unavailable, use the last successful stored snapshot.
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
                    <span className="text-sm font-semibold" style={{ color: form.cacheOnly ? "var(--color-accent)" : "var(--color-text)" }}>Snapshot only</span>
                    {form.cacheOnly && <span className="ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ background: "var(--color-accent)", color: "#fff" }}>Active</span>}
                  </div>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Never query Databricks. Always use the most recent stored snapshot.
                  </p>
                </button>
              </div>

              {/* Contextual info */}
              <div className="rounded-lg px-4 py-3 text-xs space-y-1" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                {!form.cacheOnly ? (
                  <>
                    <p style={{ color: "var(--color-text)" }}><span className="font-medium">Live with snapshot fallback:</span> Databricks remains the source of truth. Every successful live read refreshes the stored snapshot.</p>
                    <p style={{ color: "var(--color-text-muted)" }}>If the connection fails later, the UI can continue on the last successful snapshot instead of going empty.</p>
                  </>
                ) : (
                  <>
                    <p style={{ color: "var(--color-text)" }}><span className="font-medium">Snapshot-only mode:</span> no Databricks queries are made. Dashboards show the last successful stored snapshot.</p>
                    <p style={{ color: "var(--color-text-muted)" }}>Switch back to Live + fallback when you want to refresh from Databricks again.</p>
                  </>
                )}
              </div>

              {/* Snapshot retention */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>Snapshot retention</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    Snapshots older than this are ignored and can no longer be used as fallback.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={604800}
                    value={form.cacheTtlSeconds ?? 86400}
                    onChange={(e) => updateField("cacheTtlSeconds", parseInt(e.target.value, 10) || 0)}
                    className="w-32 rounded-md border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    style={{ borderColor: "var(--color-border)" }}
                  />
                  <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    seconds ({Math.round((form.cacheTtlSeconds ?? 86400) / 3600)}h)
                  </span>
                </div>
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
                <ShieldCheck className="h-5 w-5" />
                Stored Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Status grid */}
              {cache ? (
                <div className="grid grid-cols-2 gap-3">
                  <StatBox label="Serving mode" value={snapshotModeLabel} />
                  <StatBox label="Retention" value={`${Math.round(cache.ttlSeconds / 3600)}h`} />
                  {cache.newestAge != null && (
                    <StatBox label="Last snapshot" value={formatAge(cache.newestAge)} icon={<Clock className="h-4 w-4" />} />
                  )}
                  {cache.oldestAge != null && (
                    <StatBox label="Oldest retained" value={formatAge(cache.oldestAge)} icon={<Clock className="h-4 w-4" />} />
                  )}
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No snapshot status available.</p>
              )}

              {cache && (
                <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                  <SummaryRow label="Coverage" value={snapshotCoverage} />
                  <SummaryRow label="Contents" value={snapshotContents} />
                  <SummaryRow label="Internal files" value={String(cache.fileCount)} />
                  <SummaryRow label="Distinct sources" value={String(cache.sourceCount)} />
                </div>
              )}

              {/* Action rows */}
              <div className="space-y-3">
                {/* Refresh from Databricks */}
                <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                  <div className="flex items-start gap-3">
                    <RefreshCw className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--color-accent)" }} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>Refresh snapshot from Databricks</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Fetch fresh data for the selected date range and overwrite the stored snapshot for those sources.</p>
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

                {/* Sync from Databricks to Postgres */}
                <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                  <div className="flex items-start gap-3">
                    <ArrowDownToLine className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--color-accent)" }} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>Sync from Databricks to Postgres</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Pull data from Databricks and store it in Postgres for the selected date range. All API routes then read from Postgres.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DateRangePicker from={from} to={to} onChange={setRange} />
                    <button
                      onClick={handleSyncFromDatabricks}
                      disabled={syncing || !health?.databricks}
                      className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 disabled:opacity-40"
                      style={{ backgroundColor: "var(--color-accent)" }}
                      title={!health?.databricks ? "Databricks connection unavailable" : undefined}
                    >
                      {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
                      {syncing ? "Syncing…" : "Sync to Postgres"}
                    </button>
                  </div>
                </div>

                {/* Clear cache */}
                <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>                  <CloudOff className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--color-error, #EF4444)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>Clear Stored Snapshot</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                      {!form.cacheOnly
                        ? "Removes all stored snapshots. Live mode will fetch fresh data from Databricks the next time each page is opened."
                        : "Removes all stored snapshots. Snapshot-only mode will have nothing to show until you switch back to Live + fallback and refresh again."}
                    </p>
                    <button
                      onClick={handleClear}
                      disabled={clearing}
                      className="mt-2 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all hover:-translate-y-0.5 disabled:opacity-40"
                      style={{ border: "1px solid var(--color-error, #EF4444)", color: "var(--color-error, #EF4444)", background: "transparent" }}
                    >
                      {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      {clearing ? "Clearing…" : "Clear Snapshot"}
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
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>{label}</p>
        <Badge variant={variant}>{value}</Badge>
      </div>
      <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{value}</p>
      <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{detail}</p>
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <span className="text-xs text-right" style={{ color: "var(--color-text)" }}>{value}</span>
    </div>
  );
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" });
}

function IngestEndpoint({ label, path }: { label: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs"
      style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
    >
      <div className="min-w-0">
        <p className="font-medium" style={{ color: "var(--color-text)" }}>{label}</p>
        <p className="font-mono truncate" style={{ color: "var(--color-text-muted)" }}>{path}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 rounded p-1 transition-colors hover:bg-muted"
        aria-label={`Copy ${label} endpoint`}
      >
        {copied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />}
      </button>
    </div>
  );
}

function snapshotSourceLabel(source: string): string {
  switch (source) {
    case "pipelines": return "Pipelines";
    case "quality": return "Quality";
    case "lineage": return "OpenLineage";
    case "lineage-entities": return "Lineage graph";
    case "lineage-attributes": return "Lineage columns";
    default: return source;
  }
}
