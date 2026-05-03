"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Info,
} from "lucide-react";
import {
  useAdminAuthConfig,
  useUpdateAdminAuthConfig,
  useTestSsoConnection,
} from "@/hooks/use-admin";
import type { AdminAuthMode, AdminAuthPolicy, AdminSsoConfig } from "@/types/admin";

const AUTH_MODE_LABELS: Record<AdminAuthMode, string> = {
  local_only: "Local only",
  sso_with_local_fallback: "SSO with local fallback",
  sso_with_break_glass: "SSO with break-glass",
  sso_only: "SSO only",
};

const AUTH_MODE_DESCRIPTIONS: Record<AdminAuthMode, string> = {
  local_only: "Users sign in with email and password. No SSO.",
  sso_with_local_fallback:
    "Users sign in via SSO. Local password login is also available.",
  sso_with_break_glass:
    "Users sign in via SSO. Only designated break-glass accounts can use local login.",
  sso_only:
    "All users must sign in via SSO. Local login is disabled for all accounts.",
};

const SSO_MODES: AdminAuthMode[] = [
  "sso_only",
  "sso_with_break_glass",
  "sso_with_local_fallback",
];

const DEFAULT_POLICY: AdminAuthPolicy = {
  auth_mode: "local_only",
  jit_provisioning: false,
  jit_default_role: "member",
  allowed_domains: null,
  break_glass_enabled: false,
};

const DEFAULT_SSO: AdminSsoConfig = {
  issuer: "",
  client_id: "",
  client_secret_ref: null,
  redirect_uri: "",
  scopes: ["openid", "email", "profile"],
  allowed_groups: null,
  pkce_required: true,
  enabled: false,
  role_mapping: {},
};

export default function AdminInstallationAuthPage() {
  const params = useParams<{ installation_id: string }>();
  const installationId = String(params?.installation_id ?? "");

  const { data, isLoading } = useAdminAuthConfig(installationId);
  const updateMutation = useUpdateAdminAuthConfig(installationId);
  const testMutation = useTestSsoConnection(installationId);

  const [policy, setPolicy] = useState<AdminAuthPolicy>(DEFAULT_POLICY);
  const [sso, setSso] = useState<AdminSsoConfig>(DEFAULT_SSO);
  const [roleMappingText, setRoleMappingText] = useState("{}");
  const [roleMappingError, setRoleMappingError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setPolicy(data.auth_policy ?? DEFAULT_POLICY);
    const s = data.sso_config ?? DEFAULT_SSO;
    setSso(s);
    setRoleMappingText(JSON.stringify(s.role_mapping ?? {}, null, 2));
  }, [data]);

  const isSsoMode = SSO_MODES.includes(policy.auth_mode);
  const isDestructiveChange =
    policy.auth_mode === "sso_only" || policy.auth_mode === "sso_with_break_glass";

  function handlePolicyChange<K extends keyof AdminAuthPolicy>(
    key: K,
    value: AdminAuthPolicy[K],
  ) {
    setPolicy((prev) => ({ ...prev, [key]: value }));
    setSaveError(null);
  }

  function handleSsoChange<K extends keyof AdminSsoConfig>(
    key: K,
    value: AdminSsoConfig[K],
  ) {
    setSso((prev) => ({ ...prev, [key]: value }));
    setSaveError(null);
  }

  function parseRoleMapping(): Record<string, string> | null {
    try {
      const parsed = JSON.parse(roleMappingText);
      if (typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      return parsed as Record<string, string>;
    } catch {
      return null;
    }
  }

  function handleRoleMappingChange(text: string) {
    setRoleMappingText(text);
    setRoleMappingError(null);
    setSaveError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);

    const roleMapping = parseRoleMapping();
    if (roleMapping === null) {
      setRoleMappingError(
        "Role mapping must be valid JSON (object). Example: { \"GroupName\": \"member\" }",
      );
      return;
    }

    const allowedDomains = policy.allowed_domains?.length
      ? policy.allowed_domains
      : null;

    const allowedGroups = sso.allowed_groups?.length ? sso.allowed_groups : null;

    try {
      await updateMutation.mutateAsync({
        auth_policy: { ...policy, allowed_domains: allowedDomains },
        sso_config: isSsoMode
          ? { ...sso, allowed_groups: allowedGroups, role_mapping: roleMapping }
          : undefined,
      });
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save. Please try again.",
      );
    }
  }

  async function handleTestConnection() {
    if (!sso.issuer) return;
    testMutation.reset();
    testMutation.mutate(sso.issuer);
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading auth configuration…
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <Link
          href={`/admin/installations/${installationId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to installation
        </Link>
        <h1 className="flex items-center gap-3 text-3xl font-bold text-slate-900 dark:text-white">
          <ShieldCheck className="h-8 w-8" />
          Authentication
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Configure how users of this installation authenticate.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Auth mode */}
        <section className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
            Auth mode
          </h2>

          <div className="max-w-sm">
            <label
              htmlFor="auth_mode"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Auth mode
            </label>
            <select
              id="auth_mode"
              value={policy.auth_mode}
              onChange={(e) =>
                handlePolicyChange("auth_mode", e.target.value as AdminAuthMode)
              }
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              {(Object.keys(AUTH_MODE_LABELS) as AdminAuthMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {AUTH_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {AUTH_MODE_DESCRIPTIONS[policy.auth_mode]}
            </p>
          </div>

          {isDestructiveChange && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Changing to <strong>{AUTH_MODE_LABELS[policy.auth_mode]}</strong> will disable
                password login for most users in this organisation. Ensure SSO is working before
                saving.
              </span>
            </div>
          )}
        </section>

        {/* SSO configuration */}
        {isSsoMode && (
          <section className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
              SSO configuration
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Issuer URL
                </label>
                <input
                  type="url"
                  value={sso.issuer}
                  onChange={(e) => handleSsoChange("issuer", e.target.value)}
                  placeholder="https://idp.example.com"
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Client ID
                </label>
                <input
                  type="text"
                  value={sso.client_id}
                  onChange={(e) => handleSsoChange("client_id", e.target.value)}
                  placeholder="latero-control"
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Client secret — environment variable name
                </label>
                <input
                  type="text"
                  value={sso.client_secret_ref ?? ""}
                  onChange={(e) =>
                    handleSsoChange("client_secret_ref", e.target.value || null)
                  }
                  placeholder="OIDC_CLIENT_SECRET"
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  The client secret itself is never stored here. Set it as an environment variable on
                  the server. Enter the variable name that contains it.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Redirect URI
                </label>
                <input
                  type="url"
                  value={sso.redirect_uri}
                  onChange={(e) => handleSsoChange("redirect_uri", e.target.value)}
                  placeholder="https://app.example.com/api/auth/sso/callback"
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Scopes
                </label>
                <input
                  type="text"
                  value={sso.scopes.join(" ")}
                  onChange={(e) =>
                    handleSsoChange("scopes", e.target.value.split(/\s+/).filter(Boolean))
                  }
                  placeholder="openid email profile"
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Space-separated. Must include <code>openid</code>.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Allowed groups / roles
                </label>
                <input
                  type="text"
                  value={sso.allowed_groups?.join(", ") ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    handleSsoChange("allowed_groups", raw.length ? raw : null);
                  }}
                  placeholder="latero-users, data-team"
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Comma-separated. If set, only users in these groups can log in. Leave empty to
                  allow all authenticated users.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Role mapping{" "}
                  <span className="font-normal text-slate-400">(JSON)</span>
                </label>
                <textarea
                  value={roleMappingText}
                  onChange={(e) => handleRoleMappingChange(e.target.value)}
                  rows={5}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  placeholder={'{\n  "AdminGroup": "admin",\n  "ReadonlyGroup": "member"\n}'}
                />
                {roleMappingError && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {roleMappingError}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Maps IdP group names to Latero installation roles. Admin escalation via SSO claims
                  is not permitted.
                </p>
              </div>

              <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={sso.pkce_required}
                    onChange={(e) => handleSsoChange("pkce_required", e.target.checked)}
                  />
                  PKCE required
                </label>

                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={sso.enabled}
                    onChange={(e) => handleSsoChange("enabled", e.target.checked)}
                  />
                  SSO enabled
                </label>
              </div>
            </div>

            {/* Test connection */}
            <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={!sso.issuer || testMutation.isPending}
                  onClick={handleTestConnection}
                  className="inline-flex items-center gap-2 rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {testMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Test connection
                </button>

                {testMutation.isSuccess && testMutation.data && (
                  <span className="flex items-center gap-1.5 text-sm">
                    {testMutation.data.ok ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-green-700 dark:text-green-400">
                          Discovery OK — {testMutation.data.issuer}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-red-700 dark:text-red-400">
                          {testMutation.data.error}
                        </span>
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* JIT provisioning */}
        <section className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
            Provisioning
          </h2>

          <div className="space-y-4">
            <label className="inline-flex items-start gap-3 text-sm font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={policy.jit_provisioning}
                onChange={(e) => handlePolicyChange("jit_provisioning", e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Enable JIT provisioning
                <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                  Automatically create accounts for new users after a successful SSO login.
                </span>
              </span>
            </label>

            {policy.jit_provisioning && (
              <div className="max-w-xs pl-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Default role
                </label>
                <input
                  type="text"
                  value={policy.jit_default_role}
                  onChange={(e) => handlePolicyChange("jit_default_role", e.target.value)}
                  placeholder="member"
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Role assigned to newly provisioned users. Overridden by role mapping if a group
                  matches.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Allowed domains
              </label>
              <input
                type="text"
                value={policy.allowed_domains?.join(", ") ?? ""}
                onChange={(e) => {
                  const raw = e.target.value
                    .split(",")
                    .map((s) => s.trim().toLowerCase())
                    .filter(Boolean);
                  handlePolicyChange("allowed_domains", raw.length ? raw : null);
                }}
                placeholder="example.com, acme.org"
                className="mt-1 w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm font-mono dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Comma-separated. Used to match this installation in the login flow. Leave empty if
                not using domain-based SSO discovery.
              </p>
            </div>
          </div>
        </section>

        {/* Break-glass */}
        <section className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
            Break-glass
          </h2>

          <label className="inline-flex items-start gap-3 text-sm font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={policy.break_glass_enabled}
              onChange={(e) => handlePolicyChange("break_glass_enabled", e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Enable break-glass
              <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                Allow designated local admin accounts to bypass SSO and use password login. Use for
                emergency access and incident response.
              </span>
            </span>
          </label>
        </section>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="inline-flex items-center gap-2 rounded bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </button>

          {updateMutation.isSuccess && !saveError && (
            <span className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              Saved
            </span>
          )}

          {saveError && (
            <span className="flex items-center gap-1.5 text-sm text-red-700 dark:text-red-400">
              <XCircle className="h-4 w-4" />
              {saveError}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
