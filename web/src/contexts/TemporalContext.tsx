"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface TemporalContextValue {
  asOf: Date | null;
  setAsOf: (d: Date | null) => void;
  isHistorical: boolean;
}

const TemporalContext = createContext<TemporalContextValue>({
  asOf: null,
  setAsOf: () => void 0,
  isHistorical: false,
});

export function TemporalProvider({ children }: { children: ReactNode }) {
  const [asOf, setAsOf] = useState<Date | null>(null);
  return (
    <TemporalContext.Provider value={{ asOf, setAsOf, isHistorical: asOf !== null }}>
      {children}
    </TemporalContext.Provider>
  );
}

export function useTemporal() {
  return useContext(TemporalContext);
}
