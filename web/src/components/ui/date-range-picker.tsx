"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRangePreset } from "@/hooks/use-date-range";
import { presetLabel } from "@/hooks/use-date-range";

interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  preset?: DateRangePreset;
  onPresetChange?: (preset: Exclude<DateRangePreset, "custom">) => void;
  className?: string;
}

const PRESETS: Array<Exclude<DateRangePreset, "custom">> = ["today", "3d", "7d", "30d"];

export function DateRangePicker({
  from,
  to,
  onChange,
  preset,
  onPresetChange,
  className,
}: DateRangePickerProps) {
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);

  useEffect(() => {
    setLocalFrom(from);
  }, [from]);

  useEffect(() => {
    setLocalTo(to);
  }, [to]);

  const handleFromChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalFrom(val);
      if (val && localTo) onChange(val, localTo);
    },
    [localTo, onChange]
  );

  const handleToChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalTo(val);
      if (localFrom && val) onChange(localFrom, val);
    },
    [localFrom, onChange]
  );

  return (
    <div className={cn("flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center", className)}>
      {onPresetChange && (
        <div
          className="flex min-h-[var(--touch-target-min)] w-full items-center gap-1 overflow-x-auto rounded-full border px-1 py-1 sm:h-9 sm:min-h-0 sm:w-auto sm:overflow-visible"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
        >
          {PRESETS.map((option) => {
            const active = preset === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onPresetChange(option)}
                className="flex h-8 shrink-0 items-center rounded-full px-3 text-sm font-medium leading-none transition-colors sm:h-7"
                style={{
                  background: active ? "var(--color-brand)" : "transparent",
                  color: active ? "#fff" : "var(--color-text-muted)",
                }}
              >
                {presetLabel(option)}
              </button>
            );
          })}
        </div>
      )}

      <div
        className="flex min-h-[var(--touch-target-min)] w-full flex-col items-stretch gap-2 rounded-lg border px-2.5 py-2 sm:h-9 sm:min-h-0 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:py-0"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
          {preset === "custom" && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none"
              style={{ background: "var(--color-surface-raised)", color: "var(--color-text-muted)" }}
            >
              Custom
            </span>
          )}
        </div>
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
          <input
            type="date"
            value={localFrom}
            onChange={handleFromChange}
            max={localTo}
            className="h-9 min-w-0 rounded-md border px-2 text-sm focus:outline-none sm:h-7"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface-raised)", color: "var(--color-text)" }}
            aria-label="Start date"
          />
          <span className="hidden text-sm sm:inline" style={{ color: "var(--color-text-muted)" }}>to</span>
          <input
            type="date"
            value={localTo}
            onChange={handleToChange}
            min={localFrom}
            className="h-9 min-w-0 rounded-md border px-2 text-sm focus:outline-none sm:h-7"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface-raised)", color: "var(--color-text)" }}
            aria-label="End date"
          />
        </div>
      </div>
    </div>
  );
}
