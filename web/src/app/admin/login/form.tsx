"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Eye, EyeOff, KeyRound, Lock, Mail, ShieldAlert } from "lucide-react";

export function AdminLoginForm() {
  const router = useRouter();
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

  const fieldStyle = (focused: boolean) => ({
    background: "transparent",
    border: `1px solid ${focused ? "#1e293b" : "#e2e8f0"}`,
    color: "#0f172a",
    outline: "none",
  });

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 dark:bg-white">
          <ShieldAlert className="h-5 w-5 text-white dark:text-slate-900" />
        </div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          Latero Control
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {step === "totp"
            ? "Enter the 6-digit code from your authenticator app."
            : "Platform operator access. Authorised personnel only."}
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700 border border-red-200">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {step === "credentials" ? (
        <form onSubmit={(e) => void handleCredentials(e)} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm"
                style={fieldStyle(emailFocused)}
                placeholder="operator@latero.local"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                className="w-full rounded-lg pl-9 pr-9 py-2.5 text-sm"
                style={fieldStyle(passwordFocused)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim() || !password.trim()}
            className="mt-2 w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => void handleTotp(e)} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Authenticator code
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
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
                className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm font-mono tracking-widest text-center"
                style={fieldStyle(totpFocused)}
                placeholder="000000"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || totpCode.length < 6}
            className="mt-2 w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            {loading ? "Verifying…" : "Verify"}
          </button>

          <button
            type="button"
            onClick={() => { setStep("credentials"); setError(null); setTotpCode(""); }}
            className="w-full text-xs text-slate-500 hover:text-slate-700 py-1"
          >
            ← Back to sign in
          </button>
        </form>
      )}
    </div>
  );
}
