"use client";

import { useState, useRef, type FormEvent } from "react";
import { KeyRound, ShieldCheck, ShieldOff, Copy, Check, AlertTriangle, Mail, Building2, Users, Star, Lock, Eye, EyeOff } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { useInstallation } from "@/contexts/installation-context";

type SetupStep = "idle" | "qr" | "confirm" | "backup";

interface InitiateResponse {
  qr_code: string;
  secret: string;
  encrypted_secret: string;
}

interface SetupState {
  qrCode: string;
  secret: string;
  encryptedSecret: string;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  meta,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  meta?: string;
}) {
  return (
    <div className="rounded-2xl px-4 py-3" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          {label}
        </p>
      </div>
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

export function AccountDashboard() {
  const { user, installation, installations, defaultInstallationId } = useInstallation();

  // 2FA state
  const [step, setStep] = useState<SetupStep>("idle");
  const [setupState, setSetupState] = useState<SetupState | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [confirmCode, setConfirmCode] = useState("");
  const [disableCode, setDisableCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDisable, setShowDisable] = useState(false);

  // Change password state
  const [cpCurrentPassword, setCpCurrentPassword] = useState("");
  const [cpNewPassword, setCpNewPassword] = useState("");
  const [cpConfirm, setCpConfirm] = useState("");
  const [cpShowPass, setCpShowPass] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState<string | null>(null);
  const [cpSuccess, setCpSuccess] = useState(false);

  const codeInputRef = useRef<HTMLInputElement>(null);

  const twoFactorEnabled = user?.two_factor_enabled ?? false;
  const installationLabel = installation?.label ?? installation?.installation_id ?? "No active organization";
  const installationEnvironment = installation?.environment ?? "unknown";
  const isDefaultInstallation = installation?.installation_id === defaultInstallationId;

  async function handleInitiate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/2fa/setup/initiate", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as InitiateResponse & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not start setup. Please try again.");
        return;
      }
      setSetupState({
        qrCode: data.qr_code,
        secret: data.secret,
        encryptedSecret: data.encrypted_secret,
      });
      setStep("qr");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!setupState) return;
    const code = confirmCode.trim().replace(/\s/g, "");
    if (code.length < 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/2fa/setup/confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encrypted_secret: setupState.encryptedSecret, code }),
      });
      const data = (await res.json()) as { backup_codes?: string[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Verification failed. Please try again.");
        return;
      }
      setBackupCodes(data.backup_codes ?? []);
      setStep("backup");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    const code = disableCode.trim().replace(/\s/g, "");
    if (!code) {
      setError("Enter your current TOTP code or a backup code.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/2fa", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as { disabled?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not disable 2FA. Check your code.");
        return;
      }
      setShowDisable(false);
      setDisableCode("");
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function copySecret() {
    if (!setupState) return;
    void navigator.clipboard.writeText(setupState.secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyBackupCodes() {
    void navigator.clipboard.writeText(backupCodes.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (cpNewPassword.length < 8) {
      setCpError("New password must be at least 8 characters.");
      return;
    }
    if (cpNewPassword !== cpConfirm) {
      setCpError("Passwords do not match.");
      return;
    }
    setCpLoading(true);
    setCpError(null);
    setCpSuccess(false);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: cpCurrentPassword, newPassword: cpNewPassword }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) {
        setCpError(data.error ?? "Could not change password. Please try again.");
        return;
      }
      setCpSuccess(true);
      setCpCurrentPassword("");
      setCpNewPassword("");
      setCpConfirm("");
    } catch {
      setCpError("Network error. Please try again.");
    } finally {
      setCpLoading(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="Account" />

      <section
        className="rounded-3xl p-5 md:p-6"
        style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
      >
        <div className="max-w-2xl">
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "rgba(27,59,107,0.10)", color: "var(--color-brand, #1b3b6b)" }}>
              Personal account
            </span>
            {twoFactorEnabled ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "var(--color-success-subtle, #d1fae5)", color: "var(--color-success, #10b981)" }}>
                <ShieldCheck className="h-3 w-3" />
                Security active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "var(--color-warning-subtle, #fef3c7)", color: "var(--color-warning, #d97706)" }}>
                <ShieldOff className="h-3 w-3" />
                Security setup incomplete
              </span>
            )}
          </div>
          <h2 className="text-lg font-medium" style={{ color: "var(--color-text)" }}>
            Your account and tenant access
          </h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            Manage personal security and confirm which workspace you are currently using.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <SummaryCard
            icon={Mail}
            label="Email"
            value={user?.email ?? "Signed-in user"}
          />
          <SummaryCard
            icon={Building2}
            label="Active workspace"
            value={installationLabel}
            meta={installationEnvironment}
          />
          <SummaryCard
            icon={Users}
            label="Workspace access"
            value={`${installations.length} workspace${installations.length !== 1 ? "s" : ""}`}
            meta={isDefaultInstallation ? "Current workspace is your default." : "Current workspace differs from your default."}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div
          className="rounded-xl p-6 space-y-4"
          style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="rounded-lg p-2"
                style={{ background: twoFactorEnabled ? "var(--color-success-subtle, #d1fae5)" : "var(--color-surface)" }}
              >
                <KeyRound
                  className="h-4 w-4"
                  style={{ color: twoFactorEnabled ? "var(--color-success, #10b981)" : "var(--color-text-muted)" }}
                />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                  Two-factor authentication
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {twoFactorEnabled
                    ? "Enabled. Your account is protected with an authenticator app."
                    : "Not enabled yet. Add an extra layer of security to your account."}
                </p>
              </div>
            </div>
            {twoFactorEnabled ? (
              <span
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{ background: "var(--color-success-subtle, #d1fae5)", color: "var(--color-success, #10b981)" }}
              >
                <ShieldCheck className="h-3 w-3" />
                Active
              </span>
            ) : null}
          </div>

          {error && (
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs"
              style={{ background: "var(--color-error-subtle, #fee2e2)", color: "var(--color-error, #ef4444)", border: "1px solid rgba(239,68,68,0.18)" }}
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!twoFactorEnabled && step === "idle" && (
            <div className="rounded-2xl p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                Recommended next step
              </p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                Set up an authenticator app now so your account is protected before your next sign-in.
              </p>
              <button
                onClick={handleInitiate}
                disabled={loading}
                className="mt-4 rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
                style={{ background: "var(--color-accent)", color: "#fff" }}
              >
                {loading ? "Loading…" : "Enable two-factor authentication"}
              </button>
            </div>
          )}

          {step === "qr" && setupState && (
            <div className="space-y-4">
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Scan this QR code with your authenticator app, or enter the secret manually.
              </p>
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={setupState.qrCode} alt="TOTP QR code" width={200} height={200} className="rounded-lg" />
              </div>
              <div>
                <p className="mb-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Manual setup code
                </p>
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                >
                  <code className="flex-1 break-all text-xs font-mono tracking-widest" style={{ color: "var(--color-text)" }}>
                    {setupState.secret}
                  </code>
                  <button
                    onClick={copySecret}
                    className="shrink-0 rounded p-1 transition-opacity hover:opacity-70"
                    title="Copy secret"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium" style={{ color: "var(--color-text)" }}>
                  Enter the 6-digit code to verify setup
                </label>
                <input
                  ref={codeInputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleConfirm(); }}
                  className="w-full rounded-lg px-3 py-2.5 text-center text-sm font-mono tracking-widest"
                  style={{ background: "#fff", border: "1px solid var(--color-border)", color: "var(--color-text)", outline: "none" }}
                  placeholder="000000"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setStep("idle"); setSetupState(null); setConfirmCode(""); setError(null); }}
                  className="rounded-lg px-4 py-2 text-sm font-medium"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleConfirm()}
                  disabled={loading || confirmCode.length < 6}
                  className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
                  style={{ background: "var(--color-accent)", color: "#fff" }}
                >
                  {loading ? "Verifying…" : "Verify and enable"}
                </button>
              </div>
            </div>
          )}

          {step === "backup" && (
            <div className="space-y-4">
              <div
                className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs"
                style={{ background: "var(--color-warning-subtle, #fef3c7)", color: "var(--color-warning, #d97706)", border: "1px solid rgba(245,158,11,0.22)" }}
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <strong>Save these backup codes now.</strong> They are shown only once and cannot be recovered.
                </span>
              </div>
              <div
                className="grid grid-cols-1 gap-1.5 rounded-lg p-4"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                {backupCodes.map((code) => (
                  <code key={code} className="text-sm font-mono tracking-widest" style={{ color: "var(--color-text)" }}>
                    {code}
                  </code>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyBackupCodes}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy codes
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-lg px-4 py-2 text-sm font-medium"
                  style={{ background: "var(--color-accent)", color: "#fff" }}
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {twoFactorEnabled && step === "idle" && (
            <div className="space-y-3">
              {!showDisable ? (
                <button
                  onClick={() => { setShowDisable(true); setError(null); }}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
                  style={{ border: "1px solid rgba(239,68,68,0.22)", color: "var(--color-error, #ef4444)" }}
                >
                  <ShieldOff className="h-3.5 w-3.5" />
                  Disable two-factor authentication
                </button>
              ) : (
                <div className="space-y-3 rounded-lg p-4" style={{ border: "1px solid rgba(239,68,68,0.22)", background: "var(--color-error-subtle, #fee2e2)" }}>
                  <p className="text-xs font-medium" style={{ color: "var(--color-error, #ef4444)" }}>
                    Enter your current TOTP code or a backup code to confirm.
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={20}
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleDisable(); }}
                    className="w-full rounded-lg px-3 py-2.5 text-sm font-mono tracking-widest"
                    style={{ background: "#fff", border: "1px solid rgba(239,68,68,0.22)", color: "var(--color-text)", outline: "none" }}
                    placeholder="000000"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowDisable(false); setDisableCode(""); setError(null); }}
                      className="rounded-lg px-4 py-2 text-sm font-medium"
                      style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void handleDisable()}
                      disabled={loading || !disableCode}
                      className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
                      style={{ background: "var(--color-error, #ef4444)", color: "#fff" }}
                    >
                      {loading ? "Disabling…" : "Confirm disable"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl p-5" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" style={{ color: "var(--color-brand, #1b3b6b)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                Active workspace
              </p>
            </div>
            <p className="mt-3 text-sm font-medium" style={{ color: "var(--color-text)" }}>
              {installationLabel}
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
              Workspace ID: {installation?.installation_id ?? "Unavailable"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "rgba(27,59,107,0.10)", color: "var(--color-brand, #1b3b6b)" }}>
                {installationEnvironment}
              </span>
              {isDefaultInstallation ? (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "rgba(200,137,42,0.12)", color: "var(--color-accent)" }}>
                  <Star className="h-3 w-3" />
                  Default workspace
                </span>
              ) : null}
            </div>
            <p className="mt-4 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              Use the workspace switcher in the sidebar when you need to move between workspaces.
            </p>
          </div>

          <div className="rounded-xl p-5" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                Security status
              </p>
            </div>
            <div className="mt-3 space-y-3">
              <div className="rounded-2xl px-4 py-3" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                  Two-factor authentication
                </p>
                <p className="mt-2 text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  {twoFactorEnabled ? "Enabled" : "Not enabled"}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {twoFactorEnabled
                    ? "Your next sign-ins require your authenticator app."
                    : "Recommended for better account protection."}
                </p>
              </div>
              <div className="rounded-2xl px-4 py-3" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                  Session model
                </p>
                <p className="mt-2 text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  Workspace-scoped access
                </p>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                  Your account signs you into a specific workspace, while workspace provisioning and broader access operations live in admin flows.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-5" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                Change password
              </p>
            </div>
            {cpSuccess ? (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
                style={{ background: "var(--color-success-subtle, #d1fae5)", color: "var(--color-success, #10b981)" }}
              >
                <Check className="h-4 w-4 shrink-0" />
                Password updated successfully.
              </div>
            ) : (
              <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-3">
                {cpError && (
                  <div
                    className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs"
                    style={{ background: "var(--color-error-subtle, #fee2e2)", color: "var(--color-error, #ef4444)", border: "1px solid rgba(239,68,68,0.18)" }}
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{cpError}</span>
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-text)" }}>Current password</label>
                  <input
                    type="password"
                    value={cpCurrentPassword}
                    onChange={(e) => setCpCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                    placeholder="Your current password"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-text)" }}>New password</label>
                  <div className="relative">
                    <input
                      type={cpShowPass ? "text" : "password"}
                      value={cpNewPassword}
                      onChange={(e) => setCpNewPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full rounded-lg px-3 py-2 pr-9 text-sm outline-none"
                      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setCpShowPass((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {cpShowPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-text)" }}>Confirm new password</label>
                  <input
                    type={cpShowPass ? "text" : "password"}
                    value={cpConfirm}
                    onChange={(e) => setCpConfirm(e.target.value)}
                    autoComplete="new-password"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                    placeholder="Repeat new password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={cpLoading || !cpCurrentPassword || !cpNewPassword || !cpConfirm}
                  className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
                  style={{ background: "var(--color-brand, #1b3b6b)", color: "#fff" }}
                >
                  {cpLoading ? "Updating…" : "Update password"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
