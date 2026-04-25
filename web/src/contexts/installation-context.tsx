"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface Installation {
  installation_id: string;
  label: string | null;
  environment: string;
  active: boolean;
}

interface InstallationContextValue {
  installation: Installation | null;
  apiKey: string | null;
  validating: boolean;
  authError: string | null;
  authenticate: (key: string) => Promise<boolean>;
  logout: () => void;
}

const STORAGE_KEY = "insights-installation-v1";
const API_KEY_STORAGE = "insights-api-key-v1";

const InstallationContext = createContext<InstallationContextValue | null>(null);

async function validateKey(key: string): Promise<Installation | null> {
  try {
    const res = await fetch("/api/v1/me", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.installation_id) return null;
    return {
      installation_id: data.installation_id,
      label: data.label ?? data.installation_id,
      environment: data.environment ?? "production",
      active: true,
    };
  } catch {
    return null;
  }
}

export function InstallationProvider({ children }: { children: ReactNode }) {
  const [installation, setInstallation] = useState<Installation | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedKey = localStorage.getItem(API_KEY_STORAGE);
    if (storedKey) {
      setApiKey(storedKey);
      validateKey(storedKey).then((inst) => {
        if (inst) {
          setInstallation(inst);
        } else {
          localStorage.removeItem(API_KEY_STORAGE);
          localStorage.removeItem(STORAGE_KEY);
          setApiKey(null);
        }
        setHydrated(true);
      });
    } else {
      setHydrated(true);
    }
  }, []);

  const authenticate = useCallback(async (key: string): Promise<boolean> => {
    setValidating(true);
    setAuthError(null);
    const inst = await validateKey(key);
    setValidating(false);
    if (!inst) {
      setAuthError("Ongeldige API key. Controleer de key en probeer opnieuw.");
      return false;
    }
    setApiKey(key);
    setInstallation(inst);
    localStorage.setItem(API_KEY_STORAGE, key);
    localStorage.setItem(STORAGE_KEY, inst.installation_id);
    return true;
  }, []);

  const logout = useCallback(() => {
    setApiKey(null);
    setInstallation(null);
    setAuthError(null);
    localStorage.removeItem(API_KEY_STORAGE);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  if (!hydrated) return null;

  return (
    <InstallationContext.Provider value={{ installation, apiKey, validating, authError, authenticate, logout }}>
      {children}
    </InstallationContext.Provider>
  );
}

export function useInstallation() {
  const ctx = useContext(InstallationContext);
  if (!ctx) throw new Error("useInstallation must be used within InstallationProvider");
  return ctx;
}
