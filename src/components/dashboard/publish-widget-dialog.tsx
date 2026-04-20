"use client";

import { useState } from "react";
import { X, Globe } from "lucide-react";
import { usePublishWidget } from "@/hooks/use-shared-widgets";
import type { CustomWidget } from "@/types/dashboard";

interface PublishWidgetDialogProps {
  widget: CustomWidget | null;
  onClose: () => void;
  onPublished?: () => void;
}

export function PublishWidgetDialog({ widget, onClose, onPublished }: PublishWidgetDialogProps) {
  const [label, setLabel] = useState(widget?.label ?? "");
  const [description, setDescription] = useState(widget?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync: publish, isPending } = usePublishWidget();

  if (!widget) return null;

  const handlePublish = async () => {
    if (!label.trim()) return;
    setError(null);
    try {
      await publish({
        label: label.trim(),
        description: description.trim() || undefined,
        queryConfig: widget.queryConfig,
        visualType: widget.visualType,
        defaultSize: { w: 3, h: 3, minW: 2, minH: 2 },
      });
      onPublished?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-elevated, 0 24px 48px rgba(27,59,107,0.18))",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg p-2" style={{ background: "rgba(200,137,42,0.1)" }}>
              <Globe className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
            </div>
            <h2 className="font-display font-semibold text-base" style={{ color: "var(--color-text)" }}>
              Publish to library
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5"
            style={{ color: "var(--color-text-muted)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          This widget will appear in the <strong style={{ color: "var(--color-text)" }}>Shared</strong> section
          of the widget library and be available to all dashboards in this deployment.
        </p>

        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
            Name <span style={{ color: "var(--color-error)" }}>*</span>
          </label>
          <input
            autoFocus
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePublish()}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{
              background: "var(--color-card)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional — shown in palette"
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{
              background: "var(--color-card)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </div>

        {error && (
          <p className="text-xs rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.08)", color: "var(--color-error, #EF4444)" }}>
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg py-2 text-sm font-medium"
            style={{ background: "var(--color-sidebar-hover)", color: "var(--color-text-muted)" }}
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={!label.trim() || isPending}
            className="flex-1 rounded-lg py-2 text-sm font-medium transition-opacity disabled:opacity-40"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            {isPending ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
