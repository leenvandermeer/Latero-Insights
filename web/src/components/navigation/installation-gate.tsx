"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useInstallation } from "@/contexts/installation-context";
import { Loader2, Mail, Lock, Building2, Eye, EyeOff, ArrowRight, AlertTriangle } from "lucide-react";

type AuthMode = "local_only" | "sso_only" | "sso_with_break_glass" | "sso_with_local_fallback";

interface PolicyResult {
  auth_mode: AuthMode;
  sso_available: boolean;
  sso_label: string | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  callback_failed: "We couldn't complete your sign-in. This may happen if the link expired or was used before.",
  state_mismatch: "We couldn't complete your sign-in. This may happen if the link expired or was used before.",
  unauthorized: "Your identity was verified, but you don't have access to this organisation yet. Ask your administrator to grant you access, then try again.",
  local_disabled: "Your organisation requires sign-in through your identity provider.",
  sso_config_missing: "SSO is not configured for your organisation. Contact your administrator.",
  session_expired: "Your session has expired. Please sign in again to continue.",
  rate_limited: "Too many attempts. Please wait a moment before trying again.",
};

// Mapping voor API-foutcodes die terugkomen als authError vanuit de login-context.
const AUTH_API_ERRORS: Record<string, string> = {
  local_login_disabled: "Your organisation requires sign-in through your identity provider. Use the SSO option above.",
};

function inputStyle(focused: boolean) {
  return {
    background: "var(--color-input, var(--color-bg))",
    border: `1px solid ${focused ? "var(--color-brand, #1B3B6B)" : "var(--color-border)"}`,
    color: "var(--color-text)",
  };
}

export function InstallationGate({ children }: { children: React.ReactNode }) {
  const { installation, validating, authError, authenticate } = useInstallation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Step 1: email input; Step 2: policy-driven login
  const [step, setStep] = useState<"email" | "login">("email");
  const [email, setEmail] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLocalForm, setShowLocalForm] = useState(false);
  const [policy, setPolicy] = useState<PolicyResult | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as "light" | "dark") ?? "light";
    setTheme(stored);
  }, []);

  const errorParam = searchParams.get("error");
  const redirectTarget = searchParams.get("next");
  const errorMessage = errorParam ? (ERROR_MESSAGES[errorParam] ?? ERROR_MESSAGES.callback_failed) : null;

  useEffect(() => {
    if (installation && (errorParam || redirectTarget)) {
      router.replace(pathname);
    }
  }, [installation, errorParam, redirectTarget, pathname, router]);

  if (installation) return <>{children}</>;

  // ── Step 1: e-mailinvoer en policy-check ──
  async function handleEmailContinue(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) return;

    setPolicyLoading(true);
    try {
      const domain = trimmed.split("@")[1];
      const res = await fetch(`/api/auth/policy?hint=${encodeURIComponent(domain)}`);
      const data: PolicyResult = res.ok ? await res.json() : { auth_mode: "local_only", sso_available: false, sso_label: null };
      setPolicy(data);
      setShowLocalForm(data.auth_mode === "local_only" || data.auth_mode === "sso_with_local_fallback");
      setStep("login");
    } catch {
      setPolicy({ auth_mode: "local_only", sso_available: false, sso_label: null });
      setShowLocalForm(true);
      setStep("login");
    } finally {
      setPolicyLoading(false);
    }
  }

  // ── Step 2: lokale login ──
  async function handleLocalSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    const ok = await authenticate(email.trim(), password);
    if (ok && redirectTarget?.startsWith("/")) {
      router.push(redirectTarget);
      router.refresh();
    }
  }

  // ── SSO-redirect ──
  function handleSsoClick() {
    const domain = email.trim().toLowerCase().split("@")[1] ?? "";
    const next = redirectTarget?.startsWith("/") ? redirectTarget : "/pipelines";
    window.location.href = `/api/auth/sso/initiate?hint=${encodeURIComponent(domain)}&next=${encodeURIComponent(next)}`;
  }

  const isSsoAvailable = policy?.sso_available && policy.auth_mode !== "local_only";
  const subtitle =
    step === "email"
      ? "Enter your work email to continue."
      : isSsoAvailable
        ? "Your organisation uses single sign-on (SSO)."
        : "Sign in with your email and password.";

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--color-bg)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 shadow-lg"
        style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={theme === "dark" ? "/logo/latero-mark-dark.svg" : "/logo/latero-mark-light.svg"}
            alt="Latero"
            width={40}
            height={40}
            className="mb-3"
          />
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--color-text)", fontFamily: "var(--font-display)" }}>
            Latero Control
          </h1>
          <p className="text-sm mt-1 text-center" style={{ color: "var(--color-text-muted)" }}>
            {subtitle}
          </p>
        </div>

        {/* SSO error (van callback) */}
        {errorMessage && !authError && (
          <div
            className="flex gap-2 items-start rounded-lg p-3 mb-4 text-sm"
            style={{ background: "var(--color-error-subtle, #fef2f2)", color: "var(--color-error, #dc2626)" }}
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ── Stap 1: e-mail ── */}
        {step === "email" && (
          <form onSubmit={handleEmailContinue} className="space-y-4">
            <div className="relative">
              <Mail
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                style={{ color: "var(--color-text-muted)" }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@organisation.com"
                autoComplete="email"
                className="w-full pl-9 pr-4 py-2.5 text-sm outline-none transition-colors"
                style={{ ...inputStyle(emailFocused), borderRadius: 12 }}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                disabled={policyLoading}
              />
            </div>

            <button
              type="submit"
              disabled={policyLoading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ background: "var(--color-brand, #1B3B6B)", color: "#fff", borderRadius: 100 }}
            >
              {policyLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Checking…</>
              ) : (
                <><span>Continue</span><ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </form>
        )}

        {/* ── Stap 2: login-variant op basis van policy ── */}
        {step === "login" && (
          <div className="space-y-4">
            {/* E-mail + change link */}
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--color-text)" }}>{email}</span>
              <button
                type="button"
                onClick={() => { setStep("email"); setPolicy(null); setShowLocalForm(false); setPassword(""); }}
                className="underline"
                style={{ color: "var(--color-brand, #1B3B6B)" }}
              >
                change
              </button>
            </div>

            {/* SSO CTA (primair) */}
            {isSsoAvailable && (
              <button
                type="button"
                onClick={handleSsoClick}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold"
                style={{ background: "var(--color-brand, #1B3B6B)", color: "#fff", borderRadius: 100 }}
              >
                Continue with SSO
                <ArrowRight className="h-4 w-4" />
              </button>
            )}

            {/* Scheidingslijn als zowel SSO als lokaal beschikbaar zijn */}
            {isSsoAvailable && (policy?.auth_mode === "sso_with_break_glass" || policy?.auth_mode === "sso_with_local_fallback") && (
              <div className="flex items-center gap-3 text-xs" style={{ color: "var(--color-text-subtle)" }}>
                <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
                <span>or</span>
                <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
              </div>
            )}

            {/* Lokale login toggle (secundair, voor break-glass en local_fallback) */}
            {isSsoAvailable && !showLocalForm && (policy?.auth_mode === "sso_with_break_glass" || policy?.auth_mode === "sso_with_local_fallback") && (
              <button
                type="button"
                onClick={() => setShowLocalForm(true)}
                className="w-full py-2.5 text-sm transition-opacity"
                style={{
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-muted)",
                  background: "transparent",
                  borderRadius: 100,
                }}
              >
                Sign in with password
              </button>
            )}

            {/* Lokaal wachtwoordformulier */}
            {showLocalForm && (
              <form onSubmit={handleLocalSubmit} className="space-y-4">
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    autoComplete="current-password"
                    className="w-full pl-9 pr-10 py-2.5 text-sm outline-none transition-colors"
                    style={{ ...inputStyle(passwordFocused), borderRadius: 12 }}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    disabled={validating}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
                    style={{ color: "var(--color-text-muted)" }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {authError && (
                  <p className="text-sm" style={{ color: "var(--color-error, #dc2626)" }}>
                    {AUTH_API_ERRORS[authError] ?? authError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={validating || !password.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
                  style={{
                    background: isSsoAvailable ? "transparent" : "var(--color-brand, #1B3B6B)",
                    color: isSsoAvailable ? "var(--color-text)" : "#fff",
                    border: isSsoAvailable ? "1px solid var(--color-border)" : "none",
                    borderRadius: 100,
                  }}
                >
                  {validating ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
                  ) : (
                    <><Building2 className="h-4 w-4" /> Sign in</>
                  )}
                </button>
              </form>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
