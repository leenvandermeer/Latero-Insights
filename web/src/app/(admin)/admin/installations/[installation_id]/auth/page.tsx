"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  useAdminAuthConfig,
  useUpdateAdminAuthConfig,
  useTestSsoConnection,
} from "@/hooks/use-admin";
import type { AdminAuthMode, AdminAuthPolicy, AdminSsoConfig } from "@/types/admin";
import { AdminPageHeader, AdminSectionTitle, AdminSurface } from "@/components/admin/admin-ui";

const AUTH_MODE_LABELS: Record<AdminAuthMode, string> = {
  local_only: "Local only",
  sso_with_local_fallback: "SSO with local fallback",
  sso_with_break_glass: "SSO with break-glass",
  sso_only: "SSO only",
};

const AUTH_MODE_DESCRIPTIONS: Record<AdminAuthMode, string> = {
  local_only: "Users sign in with email and password.",
  sso_with_local_fallback: "SSO is primary, with local password login still available.",
  sso_with_break_glass: "SSO is primary. Only break-glass accounts keep local login.",
  sso_only: "All users must sign in through SSO.",
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

const fieldClassName =
  "mt-2 w-full rounded-2xl px-3.5 py-2.5 text-sm outline-none transition focus:ring-2";
const fieldStyle = {
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  boxShadow: "none",
} as const;

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
    const nextSso = data.sso_config ?? DEFAULT_SSO;
    setSso(nextSso);
    setRoleMappingText(JSON.stringify(nextSso.role_mapping ?? {}, null, 2));
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
        'Role mapping must be valid JSON. Example: { "GroupName": "member" }',
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
      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading auth configuration…
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <AdminPageHeader
        eyebrow="Authentication"
        title="Auth configuration"
        actions={
          <Link
            href={`/admin/installations/${installationId}`}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to installation
          </Link>
        }
      />

      <form onSubmit={handleSave} className="space-y-6">
        <AdminSurface className="p-6">
          <AdminSectionTitle title="Auth mode" />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
            <div>
              <label
                htmlFor="auth_mode"
                className="block text-sm font-medium"
                style={{ color: "var(--color-text-muted)" }}
              >
                Mode
              </label>
              <select
                id="auth_mode"
                value={policy.auth_mode}
                onChange={(e) =>
                  handlePolicyChange("auth_mode", e.target.value as AdminAuthMode)
                }
                className={fieldClassName}
                style={fieldStyle}
              >
                {(Object.keys(AUTH_MODE_LABELS) as AdminAuthMode[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {AUTH_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            </div>

            <div
              className="rounded-2xl border px-4 py-3"
              style={{
                borderColor: "var(--color-border)",
                background: "var(--color-surface)",
              }}
            >
              <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                {AUTH_MODE_LABELS[policy.auth_mode]}
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
                {AUTH_MODE_DESCRIPTIONS[policy.auth_mode]}
              </p>
            </div>
          </div>

          {isDestructiveChange && (
            <div
              className="mt-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm"
              style={{
                borderColor: "var(--color-warning)",
                background: "var(--color-warning-bg)",
                color: "var(--color-warning-text)",
              }}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Password login will be limited. Verify SSO before saving.</span>
            </div>
          )}
        </AdminSurface>

        {isSsoMode && (
          <AdminSurface className="p-6">
            <AdminSectionTitle
              title="SSO configuration"
              action={
                <button
                  type="button"
                  disabled={!sso.issuer || testMutation.isPending}
                  onClick={handleTestConnection}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                >
                  {testMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Test connection
                </button>
              }
            />

            {testMutation.isSuccess && testMutation.data && (
              <div
                className="mb-4 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm"
                style={{
                  borderColor: testMutation.data.ok
                    ? "var(--color-success)"
                    : "var(--color-error)",
                  background: testMutation.data.ok
                    ? "var(--color-success-bg)"
                    : "var(--color-error-bg)",
                  color: testMutation.data.ok
                    ? "var(--color-success)"
                    : "var(--color-error)",
                }}
              >
                {testMutation.data.ok ? (
                  <CheckCircle className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                <span>
                  {testMutation.data.ok
                    ? `Discovery OK — ${testMutation.data.issuer}`
                    : testMutation.data.error}
                </span>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Issuer URL
                </label>
                <input
                  type="url"
                  value={sso.issuer}
                  onChange={(e) => handleSsoChange("issuer", e.target.value)}
                  placeholder="https://idp.example.com"
                  className={`${fieldClassName} font-mono`}
                  style={fieldStyle}
                />
              </div>

              <div>
                <label className="block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Client ID
                </label>
                <input
                  type="text"
                  value={sso.client_id}
                  onChange={(e) => handleSsoChange("client_id", e.target.value)}
                  placeholder="latero-control"
                  className={`${fieldClassName} font-mono`}
                  style={fieldStyle}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Client secret reference
                </label>
                <input
                  type="text"
                  value={sso.client_secret_ref ?? ""}
                  onChange={(e) =>
                    handleSsoChange("client_secret_ref", e.target.value || null)
                  }
                  placeholder="OIDC_CLIENT_SECRET"
                  className={`${fieldClassName} font-mono`}
                  style={fieldStyle}
                />
                <p className="mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Store the secret on the server and reference its variable name here.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Redirect URI
                </label>
                <input
                  type="url"
                  value={sso.redirect_uri}
                  onChange={(e) => handleSsoChange("redirect_uri", e.target.value)}
                  placeholder="https://app.example.com/api/auth/sso/callback"
                  className={`${fieldClassName} font-mono`}
                  style={fieldStyle}
                />
              </div>

              <div>
                <label className="block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Scopes
                </label>
                <input
                  type="text"
                  value={sso.scopes.join(" ")}
                  onChange={(e) =>
                    handleSsoChange("scopes", e.target.value.split(/\s+/).filter(Boolean))
                  }
                  placeholder="openid email profile"
                  className={`${fieldClassName} font-mono`}
                  style={fieldStyle}
                />
                <p className="mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Space-separated. Include <code>openid</code>.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Allowed domains <span style={{ color: "var(--color-error)" }}>*</span>
                </label>
                <input
                  type="text"
                  value={policy.allowed_domains?.join(", ") ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value
                      .split(",")
                      .map((segment) => segment.trim().toLowerCase())
                      .filter(Boolean);
                    handlePolicyChange("allowed_domains", raw.length ? raw : null);
                  }}
                  placeholder="example.com, acme.org"
                  className={`${fieldClassName} font-mono`}
                  style={fieldStyle}
                />
                {!policy.allowed_domains?.length && (
                  <p className="mt-2 text-xs" style={{ color: "var(--color-error)" }}>
                    Vereist voor SSO-domeinherkenning op de loginpagina.
                  </p>
                )}
                {!!policy.allowed_domains?.length && (
                  <p className="mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Kommagescheiden. Gebruikers met dit domein krijgen de SSO-knop te zien.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Allowed groups / roles
                </label>
                <input
                  type="text"
                  value={sso.allowed_groups?.join(", ") ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value
                      .split(",")
                      .map((segment) => segment.trim())
                      .filter(Boolean);
                    handleSsoChange("allowed_groups", raw.length ? raw : null);
                  }}
                  placeholder="latero-users, data-team"
                  className={`${fieldClassName} font-mono`}
                  style={fieldStyle}
                />
                <p className="mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Leave empty to allow all authenticated users.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Role mapping <span style={{ color: "var(--color-text-subtle)" }}>(JSON)</span>
                </label>
                <textarea
                  value={roleMappingText}
                  onChange={(e) => handleRoleMappingChange(e.target.value)}
                  rows={5}
                  className={`${fieldClassName} min-h-36 font-mono`}
                  style={fieldStyle}
                  placeholder={'{\n  "AdminGroup": "admin",\n  "ReadonlyGroup": "member"\n}'}
                />
                {roleMappingError && (
                  <p className="mt-2 text-xs" style={{ color: "var(--color-error)" }}>
                    {roleMappingError}
                  </p>
                )}
                <p className="mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Map IdP groups to Latero roles.
                </p>
              </div>

              <div className="sm:col-span-2 flex flex-wrap gap-3">
                <label
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
                >
                  <input
                    type="checkbox"
                    checked={sso.pkce_required}
                    onChange={(e) => handleSsoChange("pkce_required", e.target.checked)}
                  />
                  PKCE required
                </label>

                <label
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
                >
                  <input
                    type="checkbox"
                    checked={sso.enabled}
                    onChange={(e) => handleSsoChange("enabled", e.target.checked)}
                  />
                  SSO enabled
                </label>
              </div>
            </div>
          </AdminSurface>
        )}

        <AdminSurface className="p-6">
          <AdminSectionTitle title="Provisioning" />

          <div className="space-y-4">
            <label
              className="inline-flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-medium"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
            >
              <input
                type="checkbox"
                checked={policy.jit_provisioning}
                onChange={(e) => handlePolicyChange("jit_provisioning", e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Enable JIT provisioning
                <span className="block text-xs font-normal" style={{ color: "var(--color-text-muted)" }}>
                  Create accounts after successful SSO sign-in.
                </span>
              </span>
            </label>

            {policy.jit_provisioning && (
              <div className="max-w-xs">
                <label className="block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Default role
                </label>
                <input
                  type="text"
                  value={policy.jit_default_role}
                  onChange={(e) => handlePolicyChange("jit_default_role", e.target.value)}
                  placeholder="member"
                  className={`${fieldClassName} font-mono`}
                  style={fieldStyle}
                />
                <p className="mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Overridden by matching role mappings.
                </p>
              </div>
            )}


          </div>
        </AdminSurface>

        <AdminSurface className="p-6">
          <AdminSectionTitle title="Break-glass" />

          <label
            className="inline-flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-medium"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
          >
            <input
              type="checkbox"
              checked={policy.break_glass_enabled}
              onChange={(e) => handlePolicyChange("break_glass_enabled", e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Enable break-glass
              <span className="block text-xs font-normal" style={{ color: "var(--color-text-muted)" }}>
                Keep emergency local access for designated admin accounts.
              </span>
            </span>
          </label>
        </AdminSurface>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{ background: "var(--color-brand)", color: "var(--color-text-on-dark)" }}
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
            <span className="flex items-center gap-1.5 text-sm" style={{ color: "var(--color-success)" }}>
              <CheckCircle className="h-4 w-4" />
              Saved
            </span>
          )}

          {saveError && (
            <span className="flex items-center gap-1.5 text-sm" style={{ color: "var(--color-error)" }}>
              <XCircle className="h-4 w-4" />
              {saveError}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
