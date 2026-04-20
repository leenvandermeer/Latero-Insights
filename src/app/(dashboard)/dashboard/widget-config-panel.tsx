"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui";
import type { WidgetSlot } from "@/types/dashboard";

interface WidgetConfigPanelProps {
  widget: WidgetSlot | null;
  currentSize?: { w: number; h: number };
  onClose: () => void;
  onSave: (instanceId: string, patch: Partial<Pick<WidgetSlot, "titleOverride" | "dateFrom" | "dateTo">>, size?: { w: number; h: number }) => void;
}

export function WidgetConfigPanel({ widget, onClose, onSave }: WidgetConfigPanelProps) {
  const open = widget !== null;

  const [title, setTitle] = useState("");
  const [overrideDate, setOverrideDate] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (widget) {
      setTitle(widget.titleOverride ?? "");
      setOverrideDate(Boolean(widget.dateFrom));
      setDateFrom(widget.dateFrom ?? "");
      setDateTo(widget.dateTo ?? "");
    }
  }, [widget]);

  const handleSave = () => {
    if (!widget) return;
    onSave(widget.instanceId, {
      titleOverride: title.trim() || undefined,
      dateFrom: overrideDate && dateFrom ? dateFrom : undefined,
      dateTo: overrideDate && dateTo ? dateTo : undefined,
    });
    onClose();
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden="true" />
      )}

      <div
        className="fixed top-0 right-0 h-full w-72 z-50 flex flex-col"
        style={{
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-drawer, -4px 0 24px rgba(27,59,107,0.12))",
          transition: "transform 0.2s ease-out",
          transform: open ? "translateX(0)" : "translateX(100%)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <h2 className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>Widget Settings</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 transition-colors"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              Custom title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Leave blank to use default"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                id="override-date"
                type="checkbox"
                checked={overrideDate}
                onChange={(e) => setOverrideDate(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="override-date" className="text-xs font-medium cursor-pointer" style={{ color: "var(--color-text-muted)" }}>
                Override date range
              </label>
            </div>

            {overrideDate && (
              <div className="space-y-2 pl-5">
                <div className="space-y-1">
                  <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    max={dateTo}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
                    style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>To</label>
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
                    style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className="px-5 py-4 flex gap-2 shrink-0"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <Button variant="primary" className="flex-1 justify-center py-2" onClick={handleSave}>
            Save
          </Button>
          <Button variant="secondary" className="flex-1 justify-center py-2" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
}
