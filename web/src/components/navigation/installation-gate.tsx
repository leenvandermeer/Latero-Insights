"use client";

import { useState, type FormEvent } from "react";
import { useInstallation } from "@/contexts/installation-context";
import { Loader2, KeyRound } from "lucide-react";

export function InstallationGate({ children }: { children: React.ReactNode }) {
  const { installation, validating, authError, authenticate } = useInstallation();
  const [key, setKey] = useState("");

  if (installation) return <>{children}</>;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    await authenticate(key.trim());
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
        {/* Logo + title */}
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/latero-mark-light.svg" alt="Latero" width={40} height={40} className="mb-3" />
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--color-text)" }}>
            Latero Meta Insights
          </h1>
          <p className="text-sm mt-1 text-center" style={{ color: "var(--color-text-muted)" }}>
            Voer je installation API key in om verder te gaan.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <KeyRound
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
              style={{ color: "var(--color-text-muted)" }}
            />
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sk_live_..."
              autoComplete="current-password"
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

          {authError && (
            <p className="text-sm" style={{ color: "var(--color-error, #dc2626)" }}>
              {authError}
            </p>
          )}

          <button
            type="submit"
            disabled={validating || !key.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: "var(--color-brand, #1B3B6B)", color: "#fff" }}
          >
            {validating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Valideren...
              </>
            ) : (
              "Inloggen"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
