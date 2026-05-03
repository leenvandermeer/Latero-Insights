"use client";

import { useState, useRef } from "react";
import { KeyRound, ShieldCheck, ShieldOff, Copy, Check, AlertTriangle } from "lucide-react";
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

export function AccountDashboard() {
  const { user } = useInstallation();

  const [step, setStep] = useState<SetupStep>("idle");
  const [setupState, setSetupState] = useState<SetupState | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [confirmCode, setConfirmCode] = useState("");
  const [disableCode, setDisableCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDisable, setShowDisable] = useState(false);

  const codeInputRef = useRef<HTMLInputElement>(null);

  const twoFactorEnabled = user?.two_factor_enabled ?? false;

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
      // Reload page to refresh session state
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

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Account"
        description="Manage your personal account settings."
      />

      {/* 2FA card */}
      <div
        className="rounded-xl p-6 space-y-4"
        style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{ background: twoFactorEnabled ? "var(--color-success-bg, #dcfce7)" : "var(--color-muted, #f3f4f6)" }}
            >
              <KeyRound
                className="h-4 w-4"
                style={{ color: twoFactorEnabled ? "var(--color-success, #16a34a)" : "var(--color-text-muted)" }}
              />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                Two-factor authentication
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                {twoFactorEnabled
                  ? "Enabled — your account is protected with an authenticator app."
                  : "Not enabled — add an extra layer of security to your account."}
              </p>
            </div>
          </div>
          {twoFactorEnabled ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shrink-0"
              style={{ background: "var(--color-success-bg, #dcfce7)", color: "var(--color-success, #16a34a)" }}
            >
              <ShieldCheck className="h-3 w-3" />
              Active
            </span>
          ) : null}
        </div>

        {error && (
          <div
            className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs"
            style={{ background: "var(--color-error-bg, #fef2f2)", color: "var(--color-error, #dc2626)", border: "1px solid var(--color-error-border, #fecaca)" }}
          >
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Idle state — not enabled */}
        {!twoFactorEnabled && step === "idle" && (
          <button
            onClick={handleInitiate}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-foreground, #fff)" }}
          >
            {loading ? "Loading…" : "Enable two-factor authentication"}
          </button>
        )}

        {/* Step: QR code */}
        {step === "qr" && setupState && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy, 1Password).
            </p>
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setupState.qrCode} alt="TOTP QR code" width={200} height={200} className="rounded-lg" />
            </div>
            <div>
              <p className="text-xs mb-1.5" style={{ color: "var(--color-text-muted)" }}>
                Or enter this code manually:
              </p>
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{ background: "var(--color-muted, #f3f4f6)", border: "1px solid var(--color-border)" }}
              >
                <code className="flex-1 text-xs font-mono tracking-widest break-all" style={{ color: "var(--color-text)" }}>
                  {setupState.secret}
                </code>
                <button
                  onClick={copySecret}
                  className="shrink-0 p-1 rounded transition-opacity hover:opacity-70"
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
                className="w-full rounded-lg px-3 py-2.5 text-sm font-mono tracking-widest text-center"
                style={{
                  background: "var(--color-input-bg, #fff)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  outline: "none",
                }}
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
                style={{ background: "var(--color-primary)", color: "var(--color-primary-foreground, #fff)" }}
              >
                {loading ? "Verifying…" : "Verify and enable"}
              </button>
            </div>
          </div>
        )}

        {/* Step: Backup codes */}
        {step === "backup" && (
          <div className="space-y-4">
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs"
              style={{ background: "var(--color-warning-bg, #fffbeb)", color: "var(--color-warning, #d97706)", border: "1px solid var(--color-warning-border, #fde68a)" }}
            >
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                <strong>Save these backup codes now.</strong> They are shown only once and cannot be recovered. Use one if you lose access to your authenticator.
              </span>
            </div>
            <div
              className="rounded-lg p-4 grid grid-cols-1 gap-1.5"
              style={{ background: "var(--color-muted, #f3f4f6)", border: "1px solid var(--color-border)" }}
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
                style={{ background: "var(--color-primary)", color: "var(--color-primary-foreground, #fff)" }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Enabled state — disable flow */}
        {twoFactorEnabled && step === "idle" && (
          <div className="space-y-3">
            {!showDisable ? (
              <button
                onClick={() => { setShowDisable(true); setError(null); }}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
                style={{ border: "1px solid var(--color-error-border, #fecaca)", color: "var(--color-error, #dc2626)" }}
              >
                <ShieldOff className="h-3.5 w-3.5" />
                Disable two-factor authentication
              </button>
            ) : (
              <div className="space-y-3 rounded-lg p-4" style={{ border: "1px solid var(--color-error-border, #fecaca)", background: "var(--color-error-bg, #fef2f2)" }}>
                <p className="text-xs font-medium" style={{ color: "var(--color-error, #dc2626)" }}>
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
                  style={{
                    background: "var(--color-input-bg, #fff)",
                    border: "1px solid var(--color-error-border, #fecaca)",
                    color: "var(--color-text)",
                    outline: "none",
                  }}
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
                    style={{ background: "var(--color-error, #dc2626)", color: "#fff" }}
                  >
                    {loading ? "Disabling…" : "Confirm disable"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
