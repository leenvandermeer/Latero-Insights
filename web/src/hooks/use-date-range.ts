"use client";

import { useCallback, useMemo, useState } from "react";

export type DateRangePreset = "today" | "3d" | "7d" | "30d" | "custom";

interface UseDateRangeOptions {
  scope?: string;
  defaultPreset?: Exclude<DateRangePreset, "custom">;
}

interface StoredDateRange {
  from: string;
  to: string;
  preset: DateRangePreset;
}

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildPresetRange(preset: Exclude<DateRangePreset, "custom">): { from: string; to: string } {
  const toDate = new Date();
  const fromDate = new Date(toDate);
  if (preset === "today") {
    return { from: formatDateInput(toDate), to: formatDateInput(toDate) };
  }
  if (preset === "3d") {
    fromDate.setDate(fromDate.getDate() - 2);
  } else if (preset === "7d") {
    fromDate.setDate(fromDate.getDate() - 6);
  } else {
    fromDate.setDate(fromDate.getDate() - 29);
  }
  return { from: formatDateInput(fromDate), to: formatDateInput(toDate) };
}

function detectPreset(from: string, to: string): DateRangePreset {
  const todayRange = buildPresetRange("today");
  if (from === todayRange.from && to === todayRange.to) return "today";
  const threeDay = buildPresetRange("3d");
  if (from === threeDay.from && to === threeDay.to) return "3d";
  const sevenDay = buildPresetRange("7d");
  if (from === sevenDay.from && to === sevenDay.to) return "7d";
  const thirtyDay = buildPresetRange("30d");
  if (from === thirtyDay.from && to === thirtyDay.to) return "30d";
  return "custom";
}

function getStorageKey(scope?: string) {
  return `latero-date-range:${scope ?? "monitor"}`;
}

function readStoredRange(scope?: string): StoredDateRange | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getStorageKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDateRange>;
    if (!parsed.from || !parsed.to) return null;
    return {
      from: parsed.from,
      to: parsed.to,
      preset: parsed.preset ?? detectPreset(parsed.from, parsed.to),
    };
  } catch {
    return null;
  }
}

function writeStoredRange(scope: string | undefined, value: StoredDateRange) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getStorageKey(scope), JSON.stringify(value));
}

export function today(): string {
  return formatDateInput(new Date());
}

export function formatDateRangeLabel(from: string, to: string): string {
  if (from === to) return from;
  return `${from} to ${to}`;
}

export function presetLabel(preset: DateRangePreset): string {
  switch (preset) {
    case "today":
      return "Today";
    case "3d":
      return "Last 3 days";
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    default:
      return "Custom";
  }
}

export function useDateRange(initialFrom?: string, initialTo?: string): {
  from: string;
  to: string;
  preset: DateRangePreset;
  setRange: (from: string, to: string) => void;
  setPreset: (preset: Exclude<DateRangePreset, "custom">) => void;
  summaryLabel: string;
};
export function useDateRange(options?: UseDateRangeOptions): {
  from: string;
  to: string;
  preset: DateRangePreset;
  setRange: (from: string, to: string) => void;
  setPreset: (preset: Exclude<DateRangePreset, "custom">) => void;
  summaryLabel: string;
};
export function useDateRange(
  initialFromOrOptions?: string | UseDateRangeOptions,
  initialTo?: string
) {
  const options = typeof initialFromOrOptions === "object" ? initialFromOrOptions : undefined;
  const initialFrom = typeof initialFromOrOptions === "string" ? initialFromOrOptions : undefined;
  const scope = options?.scope;
  const defaultPreset = options?.defaultPreset ?? "7d";

  const initialState = useMemo<StoredDateRange>(() => {
    const stored = readStoredRange(scope);
    if (stored) return stored;
    if (initialFrom && initialTo) {
      return {
        from: initialFrom,
        to: initialTo,
        preset: detectPreset(initialFrom, initialTo),
      };
    }
    const range = buildPresetRange(defaultPreset);
    return { ...range, preset: defaultPreset };
  }, [defaultPreset, initialFrom, initialTo, scope]);

  const [state, setState] = useState<StoredDateRange>(initialState);

  const persist = useCallback(
    (next: StoredDateRange) => {
      setState(next);
      writeStoredRange(scope, next);
    },
    [scope]
  );

  const setRange = useCallback(
    (newFrom: string, newTo: string) => {
      persist({
        from: newFrom,
        to: newTo,
        preset: detectPreset(newFrom, newTo),
      });
    },
    [persist]
  );

  const setPreset = useCallback(
    (preset: Exclude<DateRangePreset, "custom">) => {
      const range = buildPresetRange(preset);
      persist({ ...range, preset });
    },
    [persist]
  );

  return {
    from: state.from,
    to: state.to,
    preset: state.preset,
    setRange,
    setPreset,
    summaryLabel: `${presetLabel(state.preset)} · ${formatDateRangeLabel(state.from, state.to)}`,
  };
}
