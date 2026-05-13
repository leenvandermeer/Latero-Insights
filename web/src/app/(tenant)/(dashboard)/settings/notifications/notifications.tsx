"use client";

import { useEffect, useState } from "react";
import { useInstallation } from "@/contexts/installation-context";
import { PageHeader } from "@/components/ui";
import { Bell, Slack, AlertCircle, Loader2, CheckCircle2, AlertTriangle, Mail, Zap, Eye, EyeOff } from "lucide-react";

interface NotificationConfig {
  enabled: boolean;
  min_severity: "informational" | "significant" | "breaking";
  channels: {
    slack?: { enabled: boolean; webhook_url?: string; severity_filter?: string };
    pagerduty?: { enabled: boolean; token?: string; service_id?: string; severity_filter?: string };
    email?: { enabled: boolean; recipients?: string[]; severity_filter?: string };
  };
}

interface TestResult {
  channel: string;
  ok: boolean;
  message: string;
}

export function NotificationsSettings() {
  const { installation } = useInstallation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, TestResult | null>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [config, setConfig] = useState<NotificationConfig>({
    enabled: false,
    min_severity: "significant",
    channels: {
      slack: { enabled: false, webhook_url: "", severity_filter: "significant" },
      pagerduty: { enabled: false, token: "", service_id: "", severity_filter: "significant" },
      email: { enabled: false, recipients: [], severity_filter: "significant" },
    },
  });

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings/notifications");
      if (!res.ok) throw new Error(`Failed to fetch config: ${res.status}`);
      const data = (await res.json()) as NotificationConfig;
      setConfig(data);
      setSaveError(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to load notification settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(null);

      const res = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const error = (await res.json()) as { error?: string };
        throw new Error(error.error || `Failed to save config: ${res.status}`);
      }

      setSaveSuccess("Notification settings saved successfully");
      setTimeout(() => setSaveSuccess(null), 5000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTestChannel = async (channel: string) => {
    try {
      setTesting((prev) => ({ ...prev, [channel]: true }));
      const res = await fetch("/api/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });

      const data = (await res.json()) as TestResult;
      setTestResults((prev) => ({ ...prev, [channel]: data }));
      setTimeout(() => {
        setTestResults((prev) => ({ ...prev, [channel]: null }));
      }, 5000);
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [channel]: {
          channel,
          ok: false,
          message: err instanceof Error ? err.message : "Test failed",
        },
      }));
    } finally {
      setTesting((prev) => ({ ...prev, [channel]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--color-accent)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Bell} title="Drift Notifications" subtitle="Configure how drift events are delivered to your team" />

      {saveError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm" style={{ color: "var(--color-error)" }}>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {saveError}
          </div>
        </div>
      )}

      {saveSuccess && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3 text-sm" style={{ color: "var(--color-success)" }}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {saveSuccess}
          </div>
        </div>
      )}

      {/* Main Enable/Disable Toggle */}
      <section className="rounded-3xl p-5 md:p-6" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              Enable Notifications
            </h2>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              Turn drift notifications on or off globally
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
              className="h-5 w-5 rounded border-2"
              style={{ borderColor: "var(--color-border)", accentColor: "var(--color-accent)" }}
            />
          </label>
        </div>
      </section>

      {/* Min Severity Filter */}
      <section className="rounded-3xl p-5 md:p-6" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            Minimum Severity Level
          </h2>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            Only send notifications for drift events with this severity or higher
          </p>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {["informational", "significant", "breaking"].map((sev) => (
            <button
              key={sev}
              onClick={() => setConfig((prev) => ({ ...prev, min_severity: sev as any }))}
              className="rounded-lg px-3 py-2 text-xs font-medium transition-all"
              style={{
                background: config.min_severity === sev ? "var(--color-accent)" : "var(--color-surface)",
                color: config.min_severity === sev ? "white" : "var(--color-text)",
                border: `1px solid ${config.min_severity === sev ? "var(--color-accent)" : "var(--color-border)"}`,
              }}
            >
              {sev.charAt(0).toUpperCase() + sev.slice(1)}
            </button>
          ))}
        </div>
      </section>

      {/* Slack Channel */}
      <ChannelCard
        title="Slack"
        icon={Slack}
        channel="slack"
        config={config}
        setConfig={setConfig}
        testing={testing}
        testResult={testResults.slack}
        onTest={() => handleTestChannel("slack")}
        showPassword={showPasswords.slack}
        setShowPassword={(show) => setShowPasswords((prev) => ({ ...prev, slack: show }))}
        fields={[
          {
            key: "webhook_url",
            label: "Webhook URL",
            type: "password",
            placeholder: "https://hooks.slack.com/services/...",
          },
        ]}
      />

      {/* PagerDuty Channel */}
      <ChannelCard
        title="PagerDuty"
        icon={Zap}
        channel="pagerduty"
        config={config}
        setConfig={setConfig}
        testing={testing}
        testResult={testResults.pagerduty}
        onTest={() => handleTestChannel("pagerduty")}
        showPassword={showPasswords.pagerduty}
        setShowPassword={(show) => setShowPasswords((prev) => ({ ...prev, pagerduty: show }))}
        fields={[
          {
            key: "token",
            label: "API Token",
            type: "password",
            placeholder: "Bearer token",
          },
          {
            key: "service_id",
            label: "Service ID",
            type: "text",
            placeholder: "PXXXXX",
          },
        ]}
      />

      {/* Email Channel */}
      <ChannelCard
        title="Email"
        icon={Mail}
        channel="email"
        config={config}
        setConfig={setConfig}
        testing={testing}
        testResult={testResults.email}
        onTest={() => handleTestChannel("email")}
        showPassword={showPasswords.email}
        setShowPassword={(show) => setShowPasswords((prev) => ({ ...prev, email: show }))}
        fields={[
          {
            key: "recipients",
            label: "Recipients",
            type: "textarea",
            placeholder: "alerts@example.com, oncall@example.com",
            isArray: true,
          },
        ]}
      />

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleSaveConfig}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all disabled:opacity-50"
          style={{
            background: "var(--color-accent)",
            color: "white",
          }}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Settings"
          )}
        </button>
      </div>
    </div>
  );
}

function ChannelCard({
  title,
  icon: Icon,
  channel,
  config,
  setConfig,
  testing,
  testResult,
  onTest,
  showPassword,
  setShowPassword,
  fields,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  channel: string;
  config: NotificationConfig;
  setConfig: (updater: (prev: NotificationConfig) => NotificationConfig) => void;
  testing: Record<string, boolean>;
  testResult?: TestResult;
  onTest: () => void;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  fields: Array<{ key: string; label: string; type: string; placeholder: string; isArray?: boolean }>;
}) {
  const channelConfig = config.channels[channel as keyof typeof config.channels];
  if (!channelConfig) return null;

  return (
    <section className="rounded-3xl p-5 md:p-6" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-2.5" style={{ background: "var(--color-surface)" }}>
            <Icon className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
          </div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {title}
          </h2>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={channelConfig.enabled}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                channels: {
                  ...prev.channels,
                  [channel]: { ...channelConfig, enabled: e.target.checked },
                },
              }))
            }
            className="h-5 w-5 rounded border-2"
            style={{ borderColor: "var(--color-border)", accentColor: "var(--color-accent)" }}
          />
        </label>
      </div>

      {channelConfig.enabled && (
        <>
          {fields.map((field) => {
            const value = channelConfig[field.key as keyof typeof channelConfig] ?? "";
            const isPassword = field.type === "password" && !showPassword;

            return (
              <div key={field.key} className="mb-4">
                <label className="block text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                  {field.label}
                </label>
                <div className="relative mt-2">
                  {field.type === "textarea" ? (
                    <textarea
                      value={Array.isArray(value) ? value.join(", ") : ""}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          channels: {
                            ...prev.channels,
                            [channel]: {
                              ...channelConfig,
                              [field.key]: e.target.value.split(",").map((s) => s.trim()),
                            },
                          },
                        }))
                      }
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full rounded-lg border px-3 py-2 text-xs focus:outline-none"
                      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
                    />
                  ) : (
                    <input
                      type={isPassword ? "password" : field.type}
                      value={typeof value === "string" ? value : ""}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          channels: {
                            ...prev.channels,
                            [channel]: { ...channelConfig, [field.key]: e.target.value },
                          },
                        }))
                      }
                      placeholder={field.placeholder}
                      className="w-full rounded-lg border px-3 py-2 text-xs focus:outline-none pr-10"
                      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
                    />
                  )}
                  {field.type === "password" && (
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      title={showPassword ? "Hide" : "Show"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
                      ) : (
                        <Eye className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div className="mb-4">
            <label className="block text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              Severity Filter
            </label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {["informational", "significant", "breaking"].map((sev) => (
                <button
                  key={sev}
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      channels: {
                        ...prev.channels,
                        [channel]: { ...channelConfig, severity_filter: sev },
                      },
                    }))
                  }
                  className="rounded px-2 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: channelConfig.severity_filter === sev ? "var(--color-accent)" : "var(--color-surface)",
                    color: channelConfig.severity_filter === sev ? "white" : "var(--color-text)",
                    border: `1px solid ${channelConfig.severity_filter === sev ? "var(--color-accent)" : "var(--color-border)"}`,
                  }}
                >
                  {sev.charAt(0).toUpperCase() + sev.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--color-border)" }}>
            <button
              onClick={onTest}
              disabled={testing[channel]}
              className="flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50"
              style={{
                background: "var(--color-surface)",
                color: "var(--color-text)",
              }}
            >
              {testing[channel] ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Testing...
                </>
              ) : (
                "Send Test"
              )}
            </button>
            {testResult && (
              <div className="flex items-center gap-2 text-xs">
                {testResult.ok ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" style={{ color: "var(--color-success)" }} />
                    <span style={{ color: "var(--color-success)" }}>{testResult.message}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3" style={{ color: "var(--color-error)" }} />
                    <span style={{ color: "var(--color-error)" }}>{testResult.message}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
