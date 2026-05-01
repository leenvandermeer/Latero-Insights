"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useInstallation } from "@/contexts/installation-context";
import { Loader2, Mail, Lock, Building2, Eye, EyeOff } from "lucide-react";

export function InstallationGate({ children }: { children: React.ReactNode }) {
  const { installation, validating, authError, authenticate } = useInstallation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as "light" | "dark") ?? "light";
    setTheme(stored);
  }, []);

  const errorReason = searchParams.get("error");
  const redirectTarget = searchParams.get("next");

  useEffect(() => {
    if (installation && (errorReason || redirectTarget)) {
      router.replace(pathname);
    }
  }, [installation, errorReason, redirectTarget, pathname, router]);

  if (installation) return <>{children}</>;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    const ok = await authenticate(email.trim(), password);
    if (ok && redirectTarget?.startsWith("/")) {
      router.push(redirectTarget);
      router.refresh();
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--color-bg)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 shadow-lg"
        style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
      >
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={theme === "dark" ? "/logo/latero-mark-dark.svg" : "/logo/latero-mark-light.svg"} alt="Latero" width={40} height={40} className="mb-3" />
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--color-text)" }}>
            Latero Control
          </h1>
          <p className="text-sm mt-1 text-center" style={{ color: "var(--color-text-muted)" }}>
            Sign in with your email and password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
              style={{
                background: "var(--color-input, var(--color-bg))",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--color-brand, #1B3B6B)"; }}
              onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--color-border)"; }}
              disabled={validating}
            />
          </div>

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
              className="w-full pl-9 pr-10 py-2.5 rounded-lg text-sm outline-none transition-colors"
              style={{
                background: "var(--color-input, var(--color-bg))",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--color-brand, #1B3B6B)"; }}
              onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--color-border)"; }}
              disabled={validating}
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
              {authError}
            </p>
          )}

          <button
            type="submit"
            disabled={validating || !email.trim() || !password.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: "var(--color-brand, #1B3B6B)", color: "#fff" }}
          >
            {validating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4" /> Sign in</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
