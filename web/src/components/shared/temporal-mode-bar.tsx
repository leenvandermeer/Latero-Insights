"use client";

import { Clock, X } from "lucide-react";
import { useTemporal } from "@/contexts/TemporalContext";

export function TemporalModeBar() {
  const { asOf, setAsOf, isHistorical } = useTemporal();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setAsOf(v ? new Date(v) : null);
  };

  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 text-xs"
      style={{
        background: isHistorical ? "#1d4ed8" : "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        color: isHistorical ? "#fff" : "var(--color-text-muted)",
      }}
    >
      <Clock className="h-3.5 w-3.5 shrink-0" />
      {isHistorical ? (
        <>
          <span className="font-semibold">
            Viewing historical state as of {asOf!.toLocaleDateString()}
          </span>
          <span className="opacity-70">— All mutations are disabled</span>
          <button
            onClick={() => setAsOf(null)}
            className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            <X className="h-3 w-3" /> Back to current
          </button>
        </>
      ) : (
        <>
          <span>Time-travel:</span>
          <input
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            onChange={handleChange}
            className="rounded px-1.5 py-0.5 text-xs outline-none"
            style={{
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
          <span className="opacity-60">Select a date to view the historical state</span>
        </>
      )}
    </div>
  );
}
