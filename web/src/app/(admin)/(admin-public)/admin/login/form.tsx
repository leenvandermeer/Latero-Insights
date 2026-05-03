"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, Eye, EyeOff, KeyRound, Lock, Mail } from "lucide-react";

export function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"credentials" | "totp">("credentials");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [totpFocused, setTotpFocused] = useState(false);


  async function handleCredentials(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json() as { authenticated?: boolean; pending_2fa?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Sign-in failed. Check your credentials.");
        return;
      }
      if (data.pending_2fa) {
        setStep("totp");
        return;
      }
      if (data.authenticated) {
        // Verify the session belongs to a break-glass account
        const sessionRes = await fetch("/api/auth/session", { credentials: "include" });
        const sessionData = await sessionRes.json() as { user?: { is_admin?: boolean }; authenticated?: boolean };
        if (!sessionData.authenticated) {
          setError("Authentication failed. Please try again.");
          return;
        }
        // The /admin layout will reject non-break_glass accounts
        window.location.href = "/admin";
        return;
      }
      setError("Sign-in failed. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTotp(e: FormEvent) {
    e.preventDefault();
    const code = totpCode.trim().replace(/\s/g, "");
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json() as { authenticated?: boolean; error?: string };
      if (!res.ok || !data.authenticated) {
        setError(data.error ?? "Invalid code. Please try again.");
        setTotpCode("");
        return;
      }
      window.location.href = "/admin";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle = (focused: boolean): React.CSSProperties => ({
    background: "var(--color-bg)",
    border: `1px solid ${focused ? "var(--color-border-focus)" : "var(--color-border)"}`,
    color: "var(--color-text)",
    outline: "none",
    borderRadius: 12,
    padding: "0.625rem 0.75rem",
  });

  return (
    <div className="w-full max-w-sm rounded-2xl p-8 shadow-sm" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      {/* Header */}
      <div className="mb-8 flex flex-col items-center gap-2">
        {/* Logo: CSS-only theme switching via data-theme — geen JS, geen hydration mismatch */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/latero-mark-light.svg" alt="Latero" width={40} height={40} className="mb-1 block [html[data-theme=dark]_&]:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/latero-mark-dark.svg" alt="" width={40} height={40} className="mb-1 hidden [html[data-theme=dark]_&]:block" aria-hidden="true" />
        <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--color-text)", fontFamily: "var(--font-display)" }}>
          Latero Control
        </h1>
        <p className="text-sm text-center" style={{ color: "var(--color-text-muted)" }}>
          {step === "totp"
            ? "Enter the 6-digit code from your authenticator app."
            : "Platform operator access. Authorised personnel only."}
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs" style={{ background: "var(--color-error-subtle)", color: "var(--color-error)", border: "1px solid var(--color-error)" }}>
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {step === "credentials" ? (
        <form onSubmit={(e) => void handleCredentials(e)} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--color-text-subtle)" }} />
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                className="w-full pl-11 pr-3 text-sm"
                style={fieldStyle(emailFocused)}
                placeholder="operator@latero.local"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--color-text-subtle)" }} />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                className="w-full pl-11 pr-10 text-sm"
                style={fieldStyle(passwordFocused)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--color-text-subtle)" }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim() || !password.trim()}
            className="mt-2 w-full rounded-full py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: "var(--color-brand)", color: "var(--color-text-on-dark)" }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => void handleTotp(e)} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              Authenticator code
            </label>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--color-text-subtle)" }} />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                onFocus={() => setTotpFocused(true)}
                onBlur={() => setTotpFocused(false)}
                className="w-full pl-11 pr-3 text-sm font-mono tracking-widest text-center"
                style={fieldStyle(totpFocused)}
                placeholder="000000"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || totpCode.length < 6}
            className="mt-2 w-full rounded-full py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: "var(--color-brand)", color: "var(--color-text-on-dark)" }}
          >
            {loading ? "Verifying…" : "Verify"}
          </button>

          <button
            type="button"
            onClick={() => { setStep("credentials"); setError(null); setTotpCode(""); }}
            className="w-full text-xs py-1"
            style={{ color: "var(--color-text-subtle)" }}
          >
            ← Back to sign in
          </button>
        </form>
      )}
    </div>
  );
}
