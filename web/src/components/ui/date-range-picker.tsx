"use client";

import { useState, useCallback } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  className?: string;
}

export function DateRangePicker({ from, to, onChange, className }: DateRangePickerProps) {
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);

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
    <div className={cn("flex items-center gap-2", className)}>
      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
      <input
        type="date"
        value={localFrom}
        onChange={handleFromChange}
        max={localTo}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Start date"
      />
      <span className="text-muted-foreground text-sm">–</span>
      <input
        type="date"
        value={localTo}
        onChange={handleToChange}
        min={localFrom}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="End date"
      />
    </div>
  );
}
