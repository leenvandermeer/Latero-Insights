"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchInstallations } from "@/lib/api";

export interface Installation {
  installation_id: string;
  label: string | null;
  environment: string;
  active: boolean;
}

interface InstallationContextValue {
  installationId: string | null;
  setInstallationId: (id: string | null) => void;
  installations: Installation[];
  isLoading: boolean;
}

const STORAGE_KEY = "insights-installation-v1";

const InstallationContext = createContext<InstallationContextValue | null>(null);

export function InstallationProvider({ children }: { children: ReactNode }) {
  const [installationId, setInstallationIdState] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setInstallationIdState(stored);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["installations"],
    queryFn: fetchInstallations,
    staleTime: 5 * 60 * 1000,
  });

  const installations = (data?.installations ?? []) as Installation[];

  const setInstallationId = (id: string | null) => {
    setInstallationIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <InstallationContext.Provider value={{ installationId, setInstallationId, installations, isLoading }}>
      {children}
    </InstallationContext.Provider>
  );
}

export function useInstallation() {
  const ctx = useContext(InstallationContext);
  if (!ctx) throw new Error("useInstallation must be used within InstallationProvider");
  return ctx;
}
