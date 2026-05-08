"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, CheckCircle, AlertTriangle } from "lucide-react";

type Step = "form" | "success" | "error";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [step, setStep] = useState<Step>(token ? "form" : "error");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. The link may have expired.");
        return;
      }
      setStep("success");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--color-bg)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 shadow-lg"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--color-text)", fontFamily: "var(--font-display)" }}>
            Reset password
          </h1>
          <p className="text-sm mt-1 text-center" style={{ color: "var(--color-text-muted)" }}>
            {step === "form"
              ? "Choose a new password for your account."
              : step === "success"
                ? "Your password has been updated."
                : "This reset link is invalid or has expired."}
          </p>
        </div>

        {step === "error" && (
          <div className="space-y-4 text-center">
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
              style={{ background: "var(--color-error-subtle, #fee2e2)", color: "var(--color-error, #ef4444)" }}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>No valid reset token found. Request a new reset link.</span>
            </div>
            <Link
              href="/"
              className="inline-block text-sm underline"
              style={{ color: "var(--color-brand, #1B3B6B)" }}
            >
              Back to sign in
            </Link>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-4 text-center">
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
              style={{ background: "var(--color-success-subtle, #d1fae5)", color: "var(--color-success, #10b981)" }}
            >
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>Password updated. Please sign in with your new password.</span>
            </div>
            <Link
              href="/"
              className="inline-block w-full rounded-full py-2.5 text-sm font-semibold text-center"
              style={{ background: "var(--color-brand, #1B3B6B)", color: "#fff" }}
            >
              Go to sign in
            </Link>
          </div>
        )}

        {step === "form" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
                style={{ background: "var(--color-error-subtle, #fee2e2)", color: "var(--color-error, #ef4444)" }}
              >
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--color-text)" }}>
                New password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                  style={{ color: "var(--color-text-muted)" }}
                />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className="w-full rounded-xl pr-10 py-2.5 text-sm outline-none"
                  style={{
                    paddingLeft: "2.5rem",
                    background: "var(--color-input, var(--color-bg))",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--color-text)" }}>
                Confirm new password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                  style={{ color: "var(--color-text-muted)" }}
                />
                <input
                  type={showPass ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat your new password"
                  autoComplete="new-password"
                  className="w-full rounded-xl py-2.5 text-sm outline-none"
                  style={{
                    paddingLeft: "2.5rem",
                    background: "var(--color-input, var(--color-bg))",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !password || !confirm}
              className="w-full rounded-full py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ background: "var(--color-brand, #1B3B6B)", color: "#fff" }}
            >
              {loading ? "Updating…" : "Set new password"}
            </button>

            <p className="text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
              <Link href="/" className="underline" style={{ color: "var(--color-brand, #1B3B6B)" }}>
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
