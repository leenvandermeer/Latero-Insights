"use client";

import { useState } from "react";
import { Globe, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [collapsed, setCollapsed] = useState(false);
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
    <>
      {/* Backdrop — hidden when collapsed */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width: collapsed ? 36 : 320,
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-drawer)",
          transition: "width 0.3s ease-in-out",
          animation: "slideInRight 0.2s ease-out",
          overflow: "hidden",
        }}
      >
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -left-3.5 top-6 z-10 flex h-7 w-7 items-center justify-center rounded-full"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
            boxShadow: "var(--shadow-sm)",
          }}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        {!collapsed && (
          <>
            {/* Header */}
            <div
              className="flex items-center gap-2 px-4 py-4 shrink-0"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <div className="rounded-lg p-2" style={{ background: "rgba(200,137,42,0.1)" }}>
                <Globe className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
              </div>
              <h2 className="font-display font-semibold text-base flex-1" style={{ color: "var(--color-text)" }}>
                Publish to library
              </h2>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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
                    background: "var(--color-bg)",
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
                    background: "var(--color-bg)",
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
            </div>

            {/* Footer */}
            <div
              className="flex gap-2 px-4 py-4 shrink-0"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              <button
                onClick={() => { setCollapsed(false); onClose(); }}
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
          </>
        )}
      </div>
    </>
  );
}
