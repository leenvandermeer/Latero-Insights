"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface Installation {
  installation_id: string;
  label: string | null;
  environment: string;
  active: boolean;
}

interface SessionUser {
  email: string;
  two_factor_enabled: boolean;
  two_factor_required: boolean;
  is_admin?: boolean;
}

interface SessionResponse {
  authenticated: boolean;
  user?: SessionUser;
  active_installation?: Installation | null;
  installations?: Installation[];
  default_installation_id?: string | null;
}

interface InstallationContextValue {
  installation: Installation | null;
  installations: Installation[];
  user: SessionUser | null;
  validating: boolean;
  authError: string | null;
  defaultInstallationId: string | null;
  authenticate: (email: string, password: string) => Promise<boolean | "pending_2fa">;
  switchInstallation: (installationId: string) => Promise<boolean>;
  setDefaultInstallation: (installationId: string) => Promise<boolean>;
  logout: () => void;
}

const InstallationContext = createContext<InstallationContextValue | null>(null);

async function fetchSession(): Promise<SessionResponse | null> {
  try {
    const res = await fetch("/api/auth/session", { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as SessionResponse;
  } catch {
    return null;
  }
}

export function InstallationProvider({ children }: { children: ReactNode }) {
  const [installation, setInstallation] = useState<Installation | null>(null);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [validating, setValidating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [defaultInstallationId, setDefaultInstallationId] = useState<string | null>(null);

  useEffect(() => {
    fetchSession().then((session) => {
      if (session?.authenticated) {
        setInstallation(session.active_installation ?? null);
        setInstallations(session.installations ?? []);
        setUser(session.user ?? null);
        setDefaultInstallationId(session.default_installation_id ?? null);
      }
      setHydrated(true);
    });
  }, []);

  const authenticate = useCallback(async (email: string, password: string): Promise<boolean | "pending_2fa"> => {
    setValidating(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as SessionResponse & { error?: string; pending_2fa?: boolean };
      if (!res.ok) {
        setAuthError(data.error ?? "Sign-in failed. Please check your credentials.");
        setValidating(false);
        return false;
      }
      if (data.pending_2fa) {
        setValidating(false);
        return "pending_2fa";
      }
      if (!data.authenticated) {
        setAuthError(data.error ?? "Sign-in failed. Please check your credentials.");
        setValidating(false);
        return false;
      }
      setUser(data.user ?? null);
      setInstallation(data.active_installation ?? null);
      setInstallations(data.installations ?? []);
      setValidating(false);
      return true;
    } catch {
      setAuthError("Sign-in failed due to a network error.");
      setValidating(false);
      return false;
    }
  }, []);

  const switchInstallation = useCallback(async (installationId: string): Promise<boolean> => {
    setValidating(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/auth/switch-installation", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installation_id: installationId }),
      });
      const data = (await res.json()) as SessionResponse & { error?: string };
      if (!res.ok || !data.authenticated) {
        setAuthError(data.error ?? "Failed to switch organisation.");
        setValidating(false);
        return false;
      }
      setUser(data.user ?? null);
      setInstallation(data.active_installation ?? null);
      setInstallations(data.installations ?? []);
      setValidating(false);
      return true;
    } catch {
      setAuthError("Failed to switch organisation due to a network error.");
      setValidating(false);
      return false;
    }
  }, []);

  const setDefaultInstallation = useCallback(async (installationId: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/set-default-installation", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installation_id: installationId }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) return false;
      setDefaultInstallationId(installationId);
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    void fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setInstallation(null);
    setInstallations([]);
    setUser(null);
    setAuthError(null);
  }, []);

  if (!hydrated) return null;

  return (
    <InstallationContext.Provider
      value={{
        installation,
        installations,
        user,
        validating,
        authError,
        defaultInstallationId,
        authenticate,
        switchInstallation,
        setDefaultInstallation,
        logout,
      }}
    >
      {children}
    </InstallationContext.Provider>
  );
}

export function useInstallation() {
  const ctx = useContext(InstallationContext);
  if (!ctx) throw new Error("useInstallation must be used within InstallationProvider");
  return ctx;
}
