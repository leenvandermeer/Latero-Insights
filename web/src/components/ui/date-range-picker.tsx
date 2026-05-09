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
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {onPresetChange && (
        <div
          className="flex h-9 items-center gap-1 rounded-full border px-1"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
        >
          {PRESETS.map((option) => {
            const active = preset === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onPresetChange(option)}
                className="flex h-7 items-center rounded-full px-3 text-sm font-medium leading-none transition-colors"
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
        className="flex h-9 flex-wrap items-center gap-2 rounded-lg border px-2.5"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <Calendar className="h-4 w-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
        {preset === "custom" && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none"
            style={{ background: "var(--color-surface-raised)", color: "var(--color-text-muted)" }}
          >
            Custom
          </span>
        )}
        <input
          type="date"
          value={localFrom}
          onChange={handleFromChange}
          max={localTo}
          className="h-7 rounded-md border px-2 text-sm focus:outline-none"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-raised)", color: "var(--color-text)" }}
          aria-label="Start date"
        />
        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>to</span>
        <input
          type="date"
          value={localTo}
          onChange={handleToChange}
          min={localFrom}
          className="h-7 rounded-md border px-2 text-sm focus:outline-none"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-raised)", color: "var(--color-text)" }}
          aria-label="End date"
        />
      </div>
    </div>
  );
}
